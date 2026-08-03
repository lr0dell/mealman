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

Token counts below are Sonnet 5's, measured with `count_tokens` on the week of
2026-07-27. See section 6 for the model change.

| Region | Changes | Tokens | Contents |
| --- | --- | --- | --- |
| `tools` | never | ~2,041 | `DAY_PLANNING_TOOLS`, 7 schemas |
| `system` | never; `buildDaySystemPrompt` takes only `profile` | ~608 | targets, process, naming rules |
| `messages[0]` | **every day** | ~2,089 | date, `paceCalories`, `paceCost`, prior meals, pantry, shopping list |
| `messages[1..]` | every iteration | grows | tool calls and results |

Sonnet 5's minimum cacheable prefix is 1024 tokens, so use **two breakpoints**:

1. **End of the `system` block.** Prefix is `tools` plus `system`, 2,649 tokens,
   byte-identical for the whole week. Written once and read by all 69 iterations
   of a 7-day run, which completes in about 3 minutes and so stays inside a
   single 5-minute TTL.
2. **Last content block of `messages[0]`.** Prefix is 4,738 tokens, rewritten
   each day and read by that day's remaining iterations.

The split is what makes the per-day calorie budget safe. `paceCalories` and
`paceCost` live in `messages[0]`, behind breakpoint 2, so breakpoint 1 never
contains a per-day number and each day writes its own entry at breakpoint 2. No
day can read another day's budget.

The pace targets must not be hoisted into the `system` block to enlarge the
week-stable prefix. That would place a per-day number in the region that is
byte-identical across days, which either invalidates breakpoint 1 daily or
serves a stale budget. The prefix is already well clear of the floor, so there
is no reason to.

Two further constraints:

- Top-level `cache_control` on `messages.create()` auto-places on the last
  cacheable block, which each iteration is the newest `tool_result`, paying a
  write premium every turn. Use explicit placement on the two blocks above.
  Explicit placement is also robust to the history pruning at
  `src/ai/client.ts:136`, which keeps `messages[0]` and drops the middle,
  rewriting any prefix deeper in the conversation.
- `tools` renders before `system`, so removing `search_knowledge_base`
  (section 1) changes breakpoint 1's prefix. That is a one-time invalidation at
  deploy, not a per-request concern.

Verification: `usage.cache_read_input_tokens` is greater than zero from
iteration 2 onward, and greater than zero on day 2's first iteration (proving
breakpoint 1 survived the day boundary). A zero reading on the latter means
volatile content leaked into `tools` or `system`.

For the record, this design depends on the model change and is not available on
Haiku 4.5, whose floor is 4096 tokens against a measured `tools` plus `system`
prefix of 2,143 and a full anchored prefix of 3,148 to 3,793 across the seven
days. Both breakpoints would silently cache nothing there. If the model is ever
rolled back, remove the breakpoints rather than leaving them as no-ops.

### 6. Model upgrade to Sonnet 5

The planning agent moves from `claude-haiku-4-5-20251001` to `claude-sonnet-5`.

**Collapse the model id to one source of truth.** Three hardcoded strings exist
today and two already disagree:

| Location | Value | Role |
| --- | --- | --- |
| `src/ai/client.ts:101` | `claude-haiku-4-5-20251001` | the agent loop's actual default |
| `src/services/agent-planner.ts:171` | `claude-haiku-4-5-20251001` | passed to the tracker for the debug log header only |
| `src/ai/client.ts:42` | `claude-sonnet-4-20250514` | legacy `complete` path; deprecated model |

The tracker's copy is a duplicate of the real value, so the debug log header
silently lies whenever the two drift. Export one constant, use it for the
request and for the tracker, and migrate the deprecated `claude-sonnet-4` in the
legacy path as well.

**Thinking is explicitly disabled.** On Haiku 4.5 omitting the `thinking`
parameter means no thinking; on Sonnet 5 omitting it runs adaptive thinking. To
preserve current behavior the request must pass `thinking: { type: 'disabled' }`
rather than continue to omit it.

Two consequences follow:

- Sonnet 5 reaches for tools less readily with thinking off. This agent does all
  of its work through tools, so add an explicit trigger instruction to the
  system prompt's process section, in the style the API guidance recommends:
  state when each tool must be called rather than only what it does. This
  applies to `lookup_ingredient` and `check_daily_totals` in particular, since
  those are the calls the agent can most plausibly skip.
- No `thinking` blocks are returned, so `assistantContent` at
  `src/ai/client.ts:150-165` needs no change. That code rebuilds the assistant
  turn from scratch handling only `text` and `tool_use`, and would have silently
  dropped `thinking` blocks before pushing the turn back into `messages`.
  Dropping them can trigger ordering and signature errors on replay. Disabling
  thinking avoids the problem rather than fixing it, so record this as a
  precondition: **re-enabling thinking later requires updating that loop and the
  `MessageContent` union first.**

**Effort.** Sonnet 5 defaults to `high`. Set `output_config: { effort: 'medium' }`
explicitly. This workload is structured and tool-driven rather than
reasoning-heavy, and per the migration guidance Sonnet 5 at `medium` is
comparable to Sonnet 4.6 at `high`. Sweep `low` and `medium` against a real week
before settling.

**`max_tokens` stays at 4096.** With thinking disabled it is not shared with a
thinking budget. The call is non-streaming, which is fine below roughly 16,000.

**Nothing else in the codebase breaks.** No sampling parameters
(`temperature`, `top_p`, `top_k`) and no assistant-turn prefills are used, which
are the two changes that would otherwise return a 400.

**Cost.** Sonnet 5 tokenizes this prompt about 1.25x higher than Haiku 4.5
(`tools` plus `system` 2,143 to 2,649; full prefix 3,793 to 4,738). Measured
baseline for the week of 2026-07-27 was 594,394 input and 15,016 output tokens,
costing $0.67 on Haiku 4.5. The same workload on Sonnet 5 is roughly $2.51 at
standard rates and $1.67 at the introductory rate in effect through 2026-08-31.
The reductions in sections 1 through 3 cut input by roughly 60% on their own,
and the two cache breakpoints in section 5 cut it further, so the expected
steady-state figure is well below those numbers. Disabling thinking keeps output
tokens near the measured baseline instead of adding thinking tokens at $15 per
million.

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
- Caching: `messages[0]` is byte-identical across a day's iterations and differs
  between two days, while `tools` and `system` are byte-identical across days.
  Assert on the rendered request rather than on live `usage` counters.
- The request sets `thinking: { type: 'disabled' }` and
  `output_config: { effort: 'medium' }`.
- The model id resolves from one constant, and the value the tracker writes into
  the debug log header is the value actually sent on the request.

Existing cases in `src/agent/tool-handlers.test.ts` need updating for the new
schema. `src/ai/client.agent.test.ts` and `src/ai/client.test.ts` need updating
for the model id, the `thinking` parameter, and the cache breakpoints.

## Out of scope

- A `find_in_pantry` tool wrapping the currently unused
  `IngredientDatabase.searchIngredientsInPantry`. ID-based binding already
  addresses the correctness problem it would serve.
- `src/ai/prompts.ts` and `src/services/planner.ts`, the legacy single-shot
  planning path, which the agent planner does not use.
- Reintroducing pantry-usage bookkeeping in tool results.
