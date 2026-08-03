# ID-based ingredient binding

Date: 2026-08-02

## Problem

The planning agent knowingly tries to reuse pantry ingredients and then plans a
slightly different one instead. The pantry item is never drawn down and a
near-duplicate lands on the shopping list.

### Root cause

`add_meal` identifies ingredients by free-text name only. The schema has no id
field (`src/agent/tools.ts:25-35`), and `storeMeal` re-runs a fresh global top-1
semantic search on whatever string the model typed
(`src/agent/tool-handlers.ts:84`). The `lookup_ingredient` call the agent just
made is discarded. The pantry ids printed in the planning message
(`src/services/agent-planner.ts:92`) are decorative, because no parameter
accepts them.

Observed on day 1 of the week of 2026-07-27. The pantry listed
`beef, ground, 93% lean meat / 7% fat, raw (id 5964): 900 g`. The agent looked
up `"ground beef, 93% lean"` and received id 5965,
`Beef, ground, 97% lean meat / 3% fat, raw`, with `found: true`.

Reproduced directly against the shipped database:

```
QUERY: "ground beef, 93% lean"
   id= 5965  sim=0.8001  Beef, ground, 97% lean meat / 3% fat, raw
   id= 5964  sim=0.7973  Beef, ground, 93% lean meat / 7% fat, raw
```

The `all-MiniLM-L6-v2` embeddings cannot discriminate numerals. The wrong item
wins by 0.0028 and clears the 0.8 threshold by 0.0001.

`consumeFromPantry` matches strictly on `ingredientId`
(`src/services/pantry-math.ts:68`), so a one-id miss means the pantry beef is
never consumed and 920 g of near-identical beef is bought instead. The same
pattern appears in all three saved weekly plans: milk 5047 against pantry 5059,
chicken thigh 254 against breast 253, enriched pasta 2590 against unenriched
1781, grated parmesan 12 against hard 3702, Canadian bacon 723 against cured
bacon 1131.

### Contributing factors

1. `storeMeal` applies no similarity floor. `handleLookupIngredient` enforces
   `MINIMUM_SIMILARITY = 0.8`, but `storeMeal` takes `searchIngredient()` top-1
   unconditionally and can bind at any similarity while returning
   `success: true`.
2. The `add_meal` result reports meal name, calories, macros and cost. It never
   echoes the resolved ingredient ids, so a substitution is invisible.
3. The error is self-reinforcing. From day 2 the planning message lists both the
   pantry beef and the wrongly-bought beef, and the system prompt encourages
   reusing shopping-list entries, so the agent keeps selecting the wrong one.
4. 89 of the 8,158 ingredient names are non-unique, so even an exact name string
   cannot pin an id.

### Cost baseline

Per planning day: 11 to 17 `lookup_ingredient` calls, each its own round trip,
plus 3 to 6 `add_meal` calls that each silently re-embed and re-search every
ingredient. Roughly 90 lookups and 130 hidden re-searches per week.
`search_knowledge_base` was called zero times across all seven sessions
examined.

## Design

### 1. Tool schemas

`src/agent/tools.ts`, `src/agent/types.ts`.

`add_meal` and `modify_meal` take ids:

```ts
ingredients: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ingredientId: {
        type: 'number',
        description:
          'Numeric id from the pantry list, the shopping list, or lookup_ingredient',
      },
      amountGrams: { type: 'number', description: 'Amount in grams' },
    },
    required: ['ingredientId', 'amountGrams'],
  },
}
```

`lookup_ingredient` becomes batch, taking `{ names: string[] }` and returning
one result per query in request order. The `found: false` branch returns
suggestions carrying their ids, so a near miss is recoverable without a second
round trip. Today `suggestions` carries only `name` and `similarity`.

`search_knowledge_base` is removed. Batch `lookup_ingredient` covers it, it was
never called, and its schema is re-sent on every iteration.

### 2. Resolution

`src/agent/tool-handlers.ts`.

`storeMeal` becomes a primary-key read:

```ts
const entry = ingredientDb.getIngredientById(ing.ingredientId);
if (!entry) {
  return {
    success: false,
    error: `Unknown ingredientId ${ing.ingredientId}. Use an id from the pantry list, the shopping list, or lookup_ingredient.`,
  };
}
```

`getIngredientById` is synchronous, so the embedder leaves the `add_meal` path
entirely. Fuzzy matching survives in exactly one place, `lookup_ingredient`,
which keeps the 0.8 floor.

### 3. Context

`src/services/agent-planner.ts`.

`formatAvailablePantry` and `formatShoppingList` carry nutrition inline:

```
- beef, ground, 93% lean meat / 7% fat, raw (id 5964): 650 g | per 100g P20.8 C0 F7 Fb0 | $0.012/g
```

Pantry and shopping-list items then need no lookup at all. The system prompt's
process section changes from "use lookup_ingredient before adding any meal's
ingredients" to: the pantry and shopping-list lines already give you the id and
per-100g nutrition, use them directly; for anything else, call
`lookup_ingredient` once with every name you need. The recipe-accurate naming
guidance stays, since it still governs lookup queries.

Expected effect: roughly 1 lookup call per day in place of 11 to 17.

### 4. Feedback

`add_meal` returns `ingredients: [{ ingredientId, name, amountGrams }]` so the
binding is visible rather than inferred.

Pantry-usage bookkeeping is deliberately not reintroduced into tool results. It
was removed in commits `0ff7d8b` and `abf56d5`, and the per-day planning message
already recomputes remaining pantry from `PlanState`.

### 5. Prompt caching

`src/ai/client.ts` currently sets no `cache_control`, so the prefix is re-sent
at full price on each of a day's 6 to 13 iterations.

Volatility by region, in render order `tools` then `system` then `messages`:

| Region | Changes | Contents |
| --- | --- | --- |
| `tools` | never | 7 tool schemas, ~1,650 tokens |
| `system` | never; `buildDaySystemPrompt` takes only `profile` | ~608 tokens |
| `messages[0]` | every day | date, `paceCalories`, `paceCost`, prior meals, pantry, shopping list |
| `messages[1..]` | every iteration | tool calls and results |

Place one breakpoint on the last content block of `messages[0]`. It is written
once per day and read by that day's remaining iterations. Because the pace
targets sit inside the block the breakpoint terminates, each day writes its own
entry and no day can read another day's calorie budget.

The pace targets must not be hoisted into the system prompt to enlarge the
stable prefix. That places a per-day number in the region that is byte-identical
across days, which either invalidates the cache daily or serves a stale budget.

Two constraints on the placement:

- A breakpoint at the `tools` and `system` boundary would be stable for the
  whole week, but that prefix is ~2,214 tokens against Haiku 4.5's 4096-token
  minimum, so it would silently cache nothing. Measured on the current prompt:
  system alone 608 tokens, system plus planning message 2,258, tools plus system
  plus planning message 3,864. The inline macro lines from section 3 raise the
  anchored prefix to roughly 4,450, clearing the floor. Record the model-floor
  dependency as a code comment: on Sonnet 5 or Opus 5 (floors 1024 and 512) a
  second cross-day breakpoint becomes worthwhile, since the full week runs
  inside a single 5-minute TTL.
- Top-level `cache_control` on `messages.create()` auto-places on the last
  cacheable block, which each iteration is the newest `tool_result`, paying a
  write premium every turn. Use explicit placement on `messages[0]`. That is
  also robust to the history pruning at `src/ai/client.ts:136`, which keeps
  `messages[0]` and drops the middle, rewriting any prefix deeper in the
  conversation.

Verification: `usage.cache_read_input_tokens` is greater than zero from
iteration 2 onward. A zero reading means the prefix fell back under 4096 tokens
or volatile content leaked in ahead of the breakpoint.

## Testing

- Regression, from the logged failure: `storeMeal` given `ingredientId: 5964`
  binds 5964. The equivalent name query binds 5965 under current code.
- Unknown `ingredientId` returns an error rather than binding silently.
- Batch `lookup_ingredient` returns one entry per query in request order, and
  `found: false` results carry ids in `suggestions`.
- `add_meal` echoes resolved `{ ingredientId, name, amountGrams }`.
- `formatAvailablePantry` and `formatShoppingList` include per-100g macros and
  price.
- The `add_meal` path performs no embedding.
- Caching: the planning message is byte-identical across a day's iterations, and
  two different days produce different `messages[0]`.

Existing cases in `src/agent/tool-handlers.test.ts` need updating for the new
schema.

## Out of scope

- A `find_in_pantry` tool wrapping the currently unused
  `IngredientDatabase.searchIngredientsInPantry`. ID-based binding already
  addresses the correctness problem it would serve.
- `src/ai/prompts.ts` and `src/services/planner.ts`, the legacy single-shot
  planning path, which the agent planner does not use.
- Reintroducing pantry-usage bookkeeping in tool results.
