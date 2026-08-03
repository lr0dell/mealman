# ID-Based Ingredient Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the meal-planning agent bind meal ingredients by numeric id instead of free-text name, so a pantry ingredient can never silently resolve to a different one, while cutting tool calls and token spend.

**Architecture:** `add_meal` currently re-runs a global top-1 vector search on the model's free-text ingredient name, discarding the id that `lookup_ingredient` already returned. We replace that write path with a primary-key read, move nutrition facts for pantry and shopping-list items directly into the planning message so they need no lookup at all, and make `lookup_ingredient` batch. Separately we move the agent to Sonnet 5 with thinking explicitly disabled and add two prompt-cache breakpoints positioned so each day's calorie budget stays behind the per-day one.

**Tech Stack:** TypeScript (ESM, `node16` resolution), Vitest, better-sqlite3 + sqlite-vec, `@anthropic-ai/sdk`, Zod.

**Spec:** `docs/superpowers/specs/2026-08-02-id-based-ingredient-binding-design.md`

## Global Constraints

- Planning model is `claude-sonnet-5`. No date suffix.
- `thinking` must always be sent explicitly. On Sonnet 5, omitting it enables adaptive thinking.
- Shipped default is `thinking: { type: 'disabled' }` and `output_config: { effort: 'medium' }`.
- `max_tokens` stays `4096`. The call is non-streaming.
- Never send `temperature`, `top_p`, or `top_k`. They return 400 on Sonnet 5.
- Never send an assistant-turn prefill. It returns 400 on Sonnet 5.
- The model id has exactly one definition. The debug log header must show the value actually sent.
- Do not reintroduce pantry-usage bookkeeping into tool results. It was removed deliberately in commits `0ff7d8b` and `abf56d5`.
- Do not modify `src/ai/prompts.ts` or `src/services/planner.ts`. That is the legacy single-shot planner, not the agent path.
- Run tests with `npx vitest run` (not `mise test`, which watches).
- Typecheck with `npx tsc`. Lint with `mise check`.

## File Structure

**Created**
- `src/ai/model-config.ts` — the single definition of model, thinking mode, and effort, with env overrides for the validation sweep.
- `src/ai/model-config.test.ts`
- `scripts/analyze-plan-run.ts` — extracts the validation metrics from a completed run.

**Modified**
- `src/agent/types.ts` — `AddMealInput`/`ModifyMealInput` ingredients take ids; `LookupIngredientInput` takes an array; `SearchKnowledgeBaseInput` deleted.
- `src/agent/tools.ts` — schemas for the above; `search_knowledge_base` removed.
- `src/agent/tool-handlers.ts` — `storeMeal` becomes a primary-key read; `handleLookupIngredient` becomes batch; `handleSearchKnowledgeBase` deleted.
- `src/services/agent-planner.ts` — nutrition inline in pantry and shopping-list lines; system prompt process section rewritten for ids; model config wired through.
- `src/ai/client.ts` — model/thinking/effort from config; two `cache_control` breakpoints.
- `src/agent/tool-handlers.test.ts`, `src/ai/client.agent.test.ts`, `src/services/agent-planner.test.ts` — updated for the above.
- `package.json`, `package-lock.json` — SDK upgrade.

---

### Task 1: Upgrade `@anthropic-ai/sdk` to 0.115.0

The installed 0.72.1 cannot express this design. Its `OutputConfig` has only `format` (no `effort`), and `ThinkingConfigParam` is `ThinkingConfigEnabled | ThinkingConfigDisabled` with no adaptive variant. 0.115.0 adds `OutputConfig.effort`, `ThinkingConfigAdaptive`, and types `usage.cache_read_input_tokens`.

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `Anthropic.OutputConfig.effort?: 'low'|'medium'|'high'|'xhigh'|'max'|null`, `Anthropic.ThinkingConfigAdaptive`, `Anthropic.Usage.cache_read_input_tokens`. Every later task depends on these existing.

- [ ] **Step 1: Record the current baseline so regressions are attributable**

Run: `npx vitest run 2>&1 | tail -20`
Expected: note the passing/failing counts. Everything should pass before you change anything. If something already fails, stop and report it rather than folding it into this task.

- [ ] **Step 2: Upgrade the SDK**

```bash
npm install @anthropic-ai/sdk@0.115.0
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc`
Expected: clean exit.

This is a 43-minor-version jump, so breakage is plausible. The surface this repo touches is small: `new Anthropic({ apiKey })`, `client.messages.create(...)`, and the `content` block union (`text`, `tool_use`) in `src/ai/client.ts`. If `tsc` reports errors, fix them in place without changing runtime behavior. Do not add `any` or `@ts-expect-error` to silence them.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: same passing count as Step 1.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade @anthropic-ai/sdk to 0.115.0

0.72.1 has no OutputConfig.effort and no ThinkingConfigAdaptive, both of
which the Sonnet 5 migration needs."
```

---

### Task 2: Central planning-model configuration

**Files:**
- Create: `src/ai/model-config.ts`
- Create: `src/ai/model-config.test.ts`
- Modify: `src/ai/client.ts` (the `model` field at line 42, `AgentLoopOptions` at lines 9-19, and the `messages.create` call at lines 141-147)
- Modify: `src/services/agent-planner.ts` (the hardcoded model at line 171)

**Interfaces:**
- Consumes: SDK types from Task 1.
- Produces:
  - `DEFAULT_PLANNING_MODEL: string` (`'claude-sonnet-5'`)
  - `PLANNING_MAX_TOKENS: number` (`4096`)
  - `type ThinkingMode = 'disabled' | 'adaptive'`
  - `type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'`
  - `interface PlanningModelConfig { model: string; thinking: ThinkingMode; effort: EffortLevel }`
  - `resolvePlanningModelConfig(env?: NodeJS.ProcessEnv): PlanningModelConfig`
  - `AgentLoopOptions.modelConfig?: PlanningModelConfig` replaces `AgentLoopOptions.model?: string`

- [ ] **Step 1: Write the failing test**

Create `src/ai/model-config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  resolvePlanningModelConfig,
  DEFAULT_PLANNING_MODEL,
} from './model-config.js';

describe('resolvePlanningModelConfig', () => {
  it('defaults to Sonnet 5 with thinking disabled and medium effort', () => {
    expect(resolvePlanningModelConfig({})).toEqual({
      model: DEFAULT_PLANNING_MODEL,
      thinking: 'disabled',
      effort: 'medium',
    });
  });

  it('defaults the model to claude-sonnet-5', () => {
    expect(DEFAULT_PLANNING_MODEL).toBe('claude-sonnet-5');
  });

  it('applies env overrides for the validation sweep', () => {
    expect(
      resolvePlanningModelConfig({
        MEAL_MODEL: 'claude-haiku-4-5-20251001',
        MEAL_THINKING: 'adaptive',
        MEAL_EFFORT: 'high',
      })
    ).toEqual({
      model: 'claude-haiku-4-5-20251001',
      thinking: 'adaptive',
      effort: 'high',
    });
  });

  it('rejects an unknown thinking mode instead of silently defaulting', () => {
    expect(() => resolvePlanningModelConfig({ MEAL_THINKING: 'on' })).toThrow(
      /MEAL_THINKING/
    );
  });

  it('rejects an unknown effort level', () => {
    expect(() => resolvePlanningModelConfig({ MEAL_EFFORT: 'turbo' })).toThrow(
      /MEAL_EFFORT/
    );
  });

  it('treats empty strings as unset', () => {
    expect(resolvePlanningModelConfig({ MEAL_MODEL: '  ' }).model).toBe(
      DEFAULT_PLANNING_MODEL
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/model-config.test.ts`
Expected: FAIL, cannot resolve `./model-config.js`.

- [ ] **Step 3: Write the implementation**

Create `src/ai/model-config.ts`:

```typescript
/**
 * The single definition of which model the planning agent runs on and how.
 *
 * Env overrides exist so the validation runs in the design doc can sweep
 * model, thinking, and effort without patching source.
 */

export const DEFAULT_PLANNING_MODEL = 'claude-sonnet-5';

/** Non-streaming request, so this stays well under the SDK HTTP timeout. */
export const PLANNING_MAX_TOKENS = 4096;

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export type ThinkingMode = 'disabled' | 'adaptive';

export interface PlanningModelConfig {
  model: string;
  thinking: ThinkingMode;
  effort: EffortLevel;
}

/**
 * Thinking defaults to 'disabled'. This must always be sent explicitly:
 * on Sonnet 5, omitting the thinking parameter enables adaptive thinking,
 * unlike Haiku 4.5 where omitting it meant no thinking.
 */
export function resolvePlanningModelConfig(
  env: NodeJS.ProcessEnv = process.env
): PlanningModelConfig {
  const model = env.MEAL_MODEL?.trim() || DEFAULT_PLANNING_MODEL;

  const thinking = (env.MEAL_THINKING?.trim() || 'disabled').toLowerCase();
  if (thinking !== 'disabled' && thinking !== 'adaptive') {
    throw new Error(
      `MEAL_THINKING must be "disabled" or "adaptive", got "${thinking}"`
    );
  }

  const effort = (env.MEAL_EFFORT?.trim() || 'medium').toLowerCase();
  if (!(EFFORT_LEVELS as readonly string[]).includes(effort)) {
    throw new Error(
      `MEAL_EFFORT must be one of ${EFFORT_LEVELS.join(', ')}, got "${effort}"`
    );
  }

  return { model, thinking, effort: effort as EffortLevel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ai/model-config.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the config into the agent loop**

In `src/ai/client.ts`, add to the imports at the top:

```typescript
import {
  resolvePlanningModelConfig,
  DEFAULT_PLANNING_MODEL,
  PLANNING_MAX_TOKENS,
  type PlanningModelConfig,
} from './model-config.js';
```

Replace the `model?: string;` line in `AgentLoopOptions` (line 15) with:

```typescript
  modelConfig?: PlanningModelConfig;
```

Replace the legacy field at line 42:

```typescript
  private model = DEFAULT_PLANNING_MODEL;
```

In `runAgentLoop`, remove `model = 'claude-haiku-4-5-20251001',` from the destructuring block (line 101) and add this immediately after the destructuring closes:

```typescript
    const modelConfig = options.modelConfig ?? resolvePlanningModelConfig();
```

Replace the `messages.create` call (lines 141-147) with:

```typescript
      const response = await this.client.messages.create({
        model: modelConfig.model,
        max_tokens: PLANNING_MAX_TOKENS,
        system: systemPrompt,
        thinking: { type: modelConfig.thinking },
        output_config: { effort: modelConfig.effort },
        tools: tools as Anthropic.Tool[],
        messages: contextMessages as Anthropic.MessageParam[],
      });
```

- [ ] **Step 6: Make the debug log header show the model actually used**

In `src/services/agent-planner.ts`, add to the imports:

```typescript
import { resolvePlanningModelConfig } from '../ai/model-config.js';
```

In `generateWeeklyPlan`, immediately after `const debugDir = join(dataDir, 'debug');`, add:

```typescript
    const modelConfig = resolvePlanningModelConfig();
```

Replace the hardcoded `'claude-haiku-4-5-20251001',` argument at line 171 with `modelConfig.model,` and add `modelConfig,` to the `runAgentLoop` options object so the tracker and the request cannot drift.

- [ ] **Step 7: Assert the request carries the config**

Add to `src/ai/client.agent.test.ts`, inside the existing `describe('AIClient.runAgentLoop', ...)` block:

```typescript
  it('sends the resolved model, thinking mode, and effort', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'go',
      tools,
      toolHandler: async () => ({}),
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.output_config).toEqual({ effort: 'medium' });
    expect(request.max_tokens).toBe(4096);
  });

  it('never sends sampling parameters, which 400 on Sonnet 5', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'go',
      tools,
      toolHandler: async () => ({}),
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    expect(request).not.toHaveProperty('top_k');
  });
```

- [ ] **Step 8: Verify**

Run: `npx vitest run src/ai/ && npx tsc`
Expected: PASS, clean typecheck.

- [ ] **Step 9: Commit**

```bash
git add src/ai/model-config.ts src/ai/model-config.test.ts src/ai/client.ts src/ai/client.agent.test.ts src/services/agent-planner.ts
git commit -m "feat: move planning agent to Sonnet 5 with explicit thinking config

Collapses three hardcoded model ids into one constant. The debug log header
was a separate copy of the model string and would silently lie whenever the
two drifted.

Thinking is sent explicitly as disabled: on Sonnet 5 an omitted thinking
parameter enables adaptive thinking, unlike Haiku 4.5."
```

---

### Task 3: Inline nutrition in pantry and shopping-list lines

Pantry and shopping-list entries currently print only a name, id, and quantity, so the agent must look each one up to see its macros. Putting the facts on the line removes those lookups entirely.

`PantryItem` and `IngredientRequirement` carry no nutrition, so the facts have to come from the ingredient database. We pass them in as a map rather than having the formatter reach for the database, which keeps `buildDayInitialMessage` a pure function and testable without a database fixture.

**Files:**
- Modify: `src/services/agent-planner.ts` (`formatAvailablePantry` at lines 89-94, `formatShoppingList` at lines 96-108, `buildDayInitialMessage` at lines 110-137, `generateWeeklyPlan` at lines 139-199)
- Modify: `src/services/agent-planner.test.ts`

**Interfaces:**
- Consumes: `PlanningModelConfig` wiring from Task 2.
- Produces:
  - `export interface IngredientFacts { proteinPer100g: number; carbsPer100g: number; fatPer100g: number; fiberPer100g: number; pricePerGram: number }`
  - `buildDayInitialMessage(availablePantry, shoppingList, shoppingLimit, date, pace, mealsSoFar, facts: Map<number, IngredientFacts>): string` — note the new seventh parameter.

- [ ] **Step 1: Write the failing test**

Add to `src/services/agent-planner.test.ts`, inside the existing `describe('AgentPlanner', ...)` block:

```typescript
  it('prints per-100g nutrition and price on pantry lines', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const facts = new Map([
      [
        5964,
        {
          proteinPer100g: 20.8,
          carbsPer100g: 0,
          fatPer100g: 7,
          fiberPer100g: 0,
          pricePerGram: 0.012,
        },
      ],
    ]);

    const message = planner.buildDayInitialMessage(
      [
        {
          ingredientId: 5964,
          name: 'beef, ground, 93% lean meat / 7% fat, raw',
          quantity: 650,
          unit: 'g',
          addedDate: '2026-07-27',
        },
      ],
      [],
      10,
      '2026-08-02',
      {
        caloriesSoFar: 0,
        costSoFar: 0,
        daysRemaining: 7,
        weeklyCalTarget: 14000,
        paceCalories: 2000,
        paceCost: 21.43,
        calorieBand: { min: 13500, max: 14500 },
        weeklyBudget: 150,
      },
      '',
      facts
    );

    expect(message).toContain('(id 5964): 650 g');
    expect(message).toContain('per 100g P20.8 C0 F7 Fb0');
    expect(message).toContain('$0.012/g');
  });

  it('omits nutrition for an id missing from the facts map', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const message = planner.buildDayInitialMessage(
      [
        {
          ingredientId: 999999,
          name: 'mystery item',
          quantity: 10,
          unit: 'g',
          addedDate: '2026-07-27',
        },
      ],
      [],
      10,
      '2026-08-02',
      {
        caloriesSoFar: 0,
        costSoFar: 0,
        daysRemaining: 7,
        weeklyCalTarget: 14000,
        paceCalories: 2000,
        paceCost: 21.43,
        calorieBand: { min: 13500, max: 14500 },
        weeklyBudget: 150,
      },
      '',
      new Map()
    );

    expect(message).toContain('mystery item (id 999999): 10 g');
    expect(message).not.toContain('per 100g');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/agent-planner.test.ts -t 'per-100g nutrition'`
Expected: FAIL. `buildDayInitialMessage` takes 6 arguments, and the output has no `per 100g` text.

- [ ] **Step 3: Implement the formatters**

In `src/services/agent-planner.ts`, add the exported type near the top, after the existing imports:

```typescript
export interface IngredientFacts {
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
}
```

Replace `formatAvailablePantry` and `formatShoppingList` with:

```typescript
  private formatFacts(
    ingredientId: number,
    facts: Map<number, IngredientFacts>
  ): string {
    const f = facts.get(ingredientId);
    if (!f) return '';
    return (
      ` | per 100g P${f.proteinPer100g} C${f.carbsPer100g}` +
      ` F${f.fatPer100g} Fb${f.fiberPer100g} | $${f.pricePerGram}/g`
    );
  }

  private formatAvailablePantry(
    items: PantryItem[],
    facts: Map<number, IngredientFacts>
  ): string {
    if (items.length === 0) return 'Empty';
    return items
      .map(
        (i) =>
          `- ${i.name} (id ${i.ingredientId}): ${i.quantity} ${i.unit}` +
          this.formatFacts(i.ingredientId, facts)
      )
      .join('\n');
  }

  private formatShoppingList(
    items: IngredientRequirement[],
    limit: number,
    facts: Map<number, IngredientFacts>
  ): string {
    if (items.length === 0) {
      return 'Nothing yet — the pantry covers everything planned so far.';
    }
    const lines = items.map(
      (i) =>
        `- ${i.name} (id ${i.ingredientId}): ${i.amount} g` +
        this.formatFacts(i.ingredientId, facts)
    );
    lines.push(`${items.length} items (aim to stay under ${limit}).`);
    return lines.join('\n');
  }
```

- [ ] **Step 4: Thread the map through `buildDayInitialMessage`**

Add `facts: Map<number, IngredientFacts>` as the seventh parameter of `buildDayInitialMessage`, and update the two formatter calls in its body to pass it:

```typescript
    return `Plan all meals for ${date}.

Today's pace targets (to stay on track for the weekly goals):
- Calories: ~${pace.paceCalories} kcal
- Cost: ~$${pace.paceCost.toFixed(2)}

${priorSection}

Available pantry (quantities remaining after meals already planned this week):
${this.formatAvailablePantry(availablePantry, facts)}

Shopping list so far (ingredients planned this week the pantry does not cover):
${this.formatShoppingList(shoppingList, shoppingLimit, facts)}

Add today's breakfast, lunch, and dinner with add_meal (date ${date}). Call finalize_plan when the day is complete.`;
```

- [ ] **Step 5: Build the map in `generateWeeklyPlan`**

Add this private method to `AgentPlanner`:

```typescript
  private collectFacts(ids: number[]): Map<number, IngredientFacts> {
    const facts = new Map<number, IngredientFacts>();
    for (const id of new Set(ids)) {
      const ing = this.ingredientDb.getIngredientById(id);
      if (!ing) continue;
      facts.set(id, {
        proteinPer100g: ing.proteinPer100g,
        carbsPer100g: ing.carbsPer100g,
        fatPer100g: ing.fatPer100g,
        fiberPer100g: ing.fiberPer100g,
        pricePerGram: ing.pricePerGram,
      });
    }
    return facts;
  }
```

Inside the `for (const date of dates)` loop, replace the `buildDayInitialMessage` call with:

```typescript
      const availablePantry = planState.getAvailablePantry();
      const shoppingList = planState.getShoppingList();
      const facts = this.collectFacts([
        ...availablePantry.map((i) => i.ingredientId),
        ...shoppingList.map((i) => i.ingredientId),
      ]);
      const initialMessage = this.buildDayInitialMessage(
        availablePantry,
        shoppingList,
        planState.getShoppingListLimit(),
        date,
        pace,
        mealsSoFar,
        facts
      );
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/services/agent-planner.test.ts && npx tsc`
Expected: PASS, clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add src/services/agent-planner.ts src/services/agent-planner.test.ts
git commit -m "feat: put per-100g nutrition on pantry and shopping-list lines

The agent had to look up every pantry item just to see its macros, even
though the planning message already named it. Facts are passed in as a map
so buildDayInitialMessage stays pure and needs no database fixture."
```

---

### Task 4: Batch `lookup_ingredient`, remove `search_knowledge_base`

Suggestions currently carry only a name and similarity, so acting on one costs a second round trip. Returning ids makes a near miss recoverable in place. `search_knowledge_base` was called zero times across all seven logged sessions and its schema is re-sent on every iteration.

**Files:**
- Modify: `src/agent/types.ts` (`LookupIngredientInput` at lines 44-46, `SearchKnowledgeBaseInput` at lines 48-50)
- Modify: `src/agent/tools.ts` (`lookup_ingredient` at lines 112-123, `search_knowledge_base` at lines 124-135)
- Modify: `src/agent/tool-handlers.ts` (`handleLookupIngredient` at lines 218-279, `handleSearchKnowledgeBase` at lines 281-298, the switch at lines 374-377)
- Modify: `src/agent/tool-handlers.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces:
  - `interface LookupIngredientInput { names: string[] }`
  - `lookup_ingredient` returns `{ results: Array<LookupHit | LookupMiss> }` where
    `LookupHit = { query: string; found: true; id: number; name: string; similarity: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; fiberPer100g: number; pricePerGram: number }`
    and `LookupMiss = { query: string; found: false; message: string; suggestions: Array<{ id: number; name: string; similarity: number }> }`
  - `SearchKnowledgeBaseInput` no longer exists.

- [ ] **Step 1: Write the failing test**

In `src/agent/tool-handlers.test.ts`, replace the whole `describe('lookup_ingredient', ...)` block with:

```typescript
  describe('lookup_ingredient', () => {
    it('returns one result per query, in request order', async () => {
      const result = (await handlers.handle('lookup_ingredient', {
        names: ['chicken breast', 'brown rice'],
      })) as { results: Array<{ query: string }> };

      expect(result.results).toHaveLength(2);
      expect(result.results[0].query).toBe('chicken breast');
      expect(result.results[1].query).toBe('brown rice');
    });

    it('returns an id and full macros for a confident match', async () => {
      const result = (await handlers.handle('lookup_ingredient', {
        names: ['chicken breast'],
      })) as { results: Array<Record<string, unknown>> };

      expect(result.results[0]).toMatchObject({
        query: 'chicken breast',
        found: true,
        name: 'chicken breast',
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        pricePerGram: 0.01,
      });
      expect(typeof result.results[0].id).toBe('number');
    });

    it('carries ids on suggestions so a near miss needs no second call', async () => {
      const result = (await handlers.handle('lookup_ingredient', {
        names: ['eggs'],
      })) as {
        results: Array<{
          found: boolean;
          suggestions: Array<{ id: number; name: string }>;
        }>;
      };

      expect(result.results[0].found).toBe(false);
      expect(result.results[0].suggestions.length).toBeGreaterThan(0);
      for (const s of result.results[0].suggestions) {
        expect(typeof s.id).toBe('number');
        expect(typeof s.name).toBe('string');
      }
    });

    it('handles an empty list without calling the database', async () => {
      const result = (await handlers.handle('lookup_ingredient', {
        names: [],
      })) as { results: unknown[] };

      expect(result.results).toEqual([]);
    });
  });

  describe('search_knowledge_base', () => {
    it('is no longer a registered tool', async () => {
      const result = await handlers.handle('search_knowledge_base', {
        query: 'chicken',
      });
      expect(result).toMatchObject({
        error: 'Unknown tool: search_knowledge_base',
      });
    });

    it('is absent from both tool lists', () => {
      const names = [...PLANNING_TOOLS, ...DAY_PLANNING_TOOLS].map(
        (t) => t.name
      );
      expect(names).not.toContain('search_knowledge_base');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/tool-handlers.test.ts -t 'lookup_ingredient'`
Expected: FAIL. The handler reads `input.name`, so `result.results` is undefined.

- [ ] **Step 3: Update the types**

In `src/agent/types.ts`, replace `LookupIngredientInput` with:

```typescript
export interface LookupIngredientInput {
  names: string[];
}
```

Delete the `SearchKnowledgeBaseInput` interface entirely.

- [ ] **Step 4: Update the tool schemas**

In `src/agent/tools.ts`, replace the `lookup_ingredient` entry with:

```typescript
  {
    name: 'lookup_ingredient',
    description:
      'Look up ingredients by name. Pass every name you need in one call. Returns, for each name, the numeric id to use in add_meal plus nutrition per 100g and price. Do not call this for items already listed in the pantry or shopping list, which include their id and nutrition.',
    input_schema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ingredient names to look up, all in one call',
        },
      },
      required: ['names'],
    },
  },
```

Delete the entire `search_knowledge_base` entry.

- [ ] **Step 5: Rewrite the handler**

In `src/agent/tool-handlers.ts`, remove `SearchKnowledgeBaseInput` from the type import block. Replace `handleLookupIngredient` and delete `handleSearchKnowledgeBase` entirely:

```typescript
  interface LookupHit {
    query: string;
    found: true;
    id: number;
    name: string;
    similarity: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    fiberPer100g: number;
    pricePerGram: number;
  }

  interface LookupMiss {
    query: string;
    found: false;
    message: string;
    suggestions: Array<{ id: number; name: string; similarity: number }>;
  }

  async function handleLookupIngredient(
    input: LookupIngredientInput
  ): Promise<{ results: Array<LookupHit | LookupMiss> }> {
    const results: Array<LookupHit | LookupMiss> = [];

    for (const query of input.names) {
      const matches = await ingredientDb.searchIngredients(query, 5);

      if (matches.length === 0) {
        results.push({
          query,
          found: false,
          message: `No ingredients found for "${query}".`,
          suggestions: [],
        });
        continue;
      }

      const top = matches[0];

      if (top.similarity >= MINIMUM_SIMILARITY) {
        results.push({
          query,
          found: true,
          id: top.ingredient.id,
          name: top.ingredient.name,
          similarity: top.similarity,
          proteinPer100g: top.ingredient.proteinPer100g,
          carbsPer100g: top.ingredient.carbsPer100g,
          fatPer100g: top.ingredient.fatPer100g,
          fiberPer100g: top.ingredient.fiberPer100g,
          pricePerGram: top.ingredient.pricePerGram,
        });
        continue;
      }

      results.push({
        query,
        found: false,
        message: `No confident match for "${query}". Use one of the suggested ids, or retry with a more specific name (e.g. "black beans" instead of "beans").`,
        suggestions: matches.map((m) => ({
          id: m.ingredient.id,
          name: m.ingredient.name,
          similarity: m.similarity,
        })),
      });
    }

    return { results };
  }
```

In the `handle` switch, delete the `case 'search_knowledge_base':` line and its return.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/agent/tool-handlers.test.ts && npx tsc`
Expected: PASS, clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add src/agent/types.ts src/agent/tools.ts src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: make lookup_ingredient batch and drop search_knowledge_base

Suggestions now carry ids, so a low-confidence match is recoverable without
a second round trip. search_knowledge_base was never called in any logged
session and its schema was re-sent every iteration."
```

---

### Task 5: Bind meal ingredients by id

This is the fix. `storeMeal` stops searching and starts reading by primary key, so a pantry id can only ever resolve to that pantry item.

**Files:**
- Modify: `src/agent/types.ts` (`AddMealInput` at lines 11-23, `ModifyMealInput` at lines 25-37)
- Modify: `src/agent/tools.ts` (`add_meal` ingredients at lines 25-35, `modify_meal` ingredients at lines 68-78)
- Modify: `src/agent/tool-handlers.ts` (`storeMeal` at lines 49-140)
- Modify: `src/services/agent-planner.ts` (`buildDaySystemPrompt` at lines 40-87)
- Modify: `src/agent/tool-handlers.test.ts`

**Interfaces:**
- Consumes: `LookupHit.id` from Task 4; the pantry and shopping-list ids rendered in Task 3.
- Produces:
  - `interface MealIngredientInput { ingredientId: number; amountGrams: number }`
  - `AddMealInput.ingredients: MealIngredientInput[]`, `type ModifyMealInput = AddMealInput`
  - `add_meal`/`modify_meal` success result gains `ingredients: Array<{ ingredientId: number; name: string; amountGrams: number }>`

- [ ] **Step 1: Write the failing regression test**

In `src/agent/tool-handlers.test.ts`, add two ingredients to the `beforeEach` fixture, immediately after the `broccoli` block. These reproduce the exact pair from the production logs:

```typescript
    // The pair from the 2026-07-27 logs. Embeddings cannot discriminate the
    // numerals, so a name search for "ground beef, 93% lean" ranks the 97%
    // entry first by 0.0028.
    await ingredientDb.addIngredient({
      name: 'beef, ground, 93% lean meat / 7% fat, raw',
      proteinPer100g: 20.8,
      carbsPer100g: 0,
      fatPer100g: 7,
      fiberPer100g: 0,
      pricePerGram: 0.012,
      category: 'meat',
    });

    await ingredientDb.addIngredient({
      name: 'beef, ground, 97% lean meat / 3% fat, raw',
      proteinPer100g: 22,
      carbsPer100g: 0,
      fatPer100g: 3,
      fiberPer100g: 0,
      pricePerGram: 0.012,
      category: 'meat',
    });
```

Then add this describe block:

```typescript
  describe('add_meal ingredient binding', () => {
    async function idOf(name: string): Promise<number> {
      const match = await ingredientDb.searchIngredient(name);
      if (!match) throw new Error(`fixture missing: ${name}`);
      return match.ingredient.id;
    }

    it('binds exactly the id it was given, never a near neighbour', async () => {
      const lean93 = await idOf('beef, ground, 93% lean meat / 7% fat, raw');
      const lean97 = await idOf('beef, ground, 97% lean meat / 3% fat, raw');
      expect(lean93).not.toBe(lean97);

      const result = (await handlers.handle('add_meal', {
        date: '2026-01-26',
        slot: 'dinner',
        name: 'Beef bowl',
        recipe: 'Brown the beef.',
        ingredients: [{ ingredientId: lean93, amountGrams: 200 }],
        prepTime: 15,
        servings: 1,
      })) as {
        success: boolean;
        ingredients: Array<{ ingredientId: number; name: string }>;
      };

      expect(result.success).toBe(true);
      expect(result.ingredients[0].ingredientId).toBe(lean93);
      expect(result.ingredients[0].name).toBe(
        'beef, ground, 93% lean meat / 7% fat, raw'
      );

      const meal = planState.getMeal('2026-01-26', 'dinner');
      expect(meal?.ingredients[0].ingredientId).toBe(lean93);
    });

    it('computes nutrition from the id, not from a name search', async () => {
      const lean93 = await idOf('beef, ground, 93% lean meat / 7% fat, raw');

      await handlers.handle('add_meal', {
        date: '2026-01-26',
        slot: 'lunch',
        name: 'Plain beef',
        recipe: 'Cook it.',
        ingredients: [{ ingredientId: lean93, amountGrams: 100 }],
        prepTime: 10,
        servings: 1,
      });

      const meal = planState.getMeal('2026-01-26', 'lunch');
      // 93% lean is 20.8g protein and 7g fat per 100g; 97% lean would be 22 and 3.
      expect(meal?.macros.protein).toBeCloseTo(20.8, 5);
      expect(meal?.macros.fat).toBeCloseTo(7, 5);
    });

    it('rejects an unknown id instead of binding something close', async () => {
      const result = (await handlers.handle('add_meal', {
        date: '2026-01-26',
        slot: 'breakfast',
        name: 'Nonsense',
        recipe: 'n/a',
        ingredients: [{ ingredientId: 987654, amountGrams: 50 }],
        prepTime: 5,
        servings: 1,
      })) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('987654');
      expect(planState.getMeal('2026-01-26', 'breakfast')).toBeNull();
    });

    it('does not embed anything on the add_meal path', async () => {
      const lean93 = await idOf('beef, ground, 93% lean meat / 7% fat, raw');
      const spy = vi.spyOn(ingredientDb, 'searchIngredients');

      await handlers.handle('add_meal', {
        date: '2026-01-27',
        slot: 'dinner',
        name: 'Beef again',
        recipe: 'Cook.',
        ingredients: [{ ingredientId: lean93, amountGrams: 100 }],
        prepTime: 10,
        servings: 1,
      });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
```

Add `vi` to the vitest import at the top of the file:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/tool-handlers.test.ts -t 'ingredient binding'`
Expected: FAIL. `storeMeal` reads `ing.name`, which is `undefined`, so `searchIngredient(undefined)` either throws or returns an unrelated match.

- [ ] **Step 3: Update the types**

In `src/agent/types.ts`, replace `AddMealInput` and `ModifyMealInput` with:

```typescript
export interface MealIngredientInput {
  /** Numeric id from the pantry list, the shopping list, or lookup_ingredient. */
  ingredientId: number;
  amountGrams: number;
}

export interface AddMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: MealIngredientInput[];
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export type ModifyMealInput = AddMealInput;
```

- [ ] **Step 4: Update the tool schemas**

In `src/agent/tools.ts`, in **both** `add_meal` and `modify_meal`, replace the `ingredients` property with this exact block (repeat it in both; do not factor it into a shared variable, so each schema reads standalone):

```typescript
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
        },
```

Also update the `add_meal` description string to:

```typescript
    description:
      'Add a meal to a specific day and slot (breakfast/lunch/dinner). Ingredients are identified by numeric ingredientId, not by name. The system calculates nutrition from the id.',
```

- [ ] **Step 5: Rewrite `storeMeal`**

In `src/agent/tool-handlers.ts`, replace the ingredient loop at the top of `storeMeal` (lines 79-102) with:

```typescript
    const ingredientIds: number[] = [];
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ing of input.ingredients) {
      const entry = ingredientDb.getIngredientById(ing.ingredientId);
      if (!entry) {
        return {
          success: false,
          error: `Unknown ingredientId ${ing.ingredientId}. Use an id from the pantry list, the shopping list, or lookup_ingredient.`,
        };
      }
      ingredientIds.push(entry.id);
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerGram: entry.pricePerGram,
      });
    }
```

`getIngredientById` is synchronous, so change `storeMeal`, `handleAddMeal`, and `handleModifyMeal` from `async function` to `function` and drop `Promise<...>` from their return type annotations. The `handle` switch is still `async`, so returning plain values from it is fine.

Add the resolved ingredients to the success return, and to the success branch of the return type union on all three functions:

```typescript
    return {
      success: true,
      meal: {
        name: meal.name,
        calories: meal.calories,
        macros: meal.macros,
        cost: meal.estimatedCost,
      },
      ingredients: meal.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        name: i.name,
        amountGrams: i.amount,
      })),
      dayTotals,
      remainingBudget: planState.getRemainingBudget(),
    };
```

The matching addition to each success-branch type annotation is:

```typescript
        ingredients: Array<{
          ingredientId: number;
          name: string;
          amountGrams: number;
        }>;
```

- [ ] **Step 6: Rewrite the system prompt process section**

In `src/services/agent-planner.ts`, in `buildDaySystemPrompt`, replace the `## Process` and `## Ingredient Naming` sections with:

```
## Process
1. Add the day's three meals with add_meal (only for the date in the planning message).
2. Use check_daily_totals after adding meals to confirm protein/carbs/fat/fiber are in range and calories are near the pace target. Call it at least once before finalizing; do not assume the totals.
3. If a macro is out of range, use modify_meal to revise a meal you already added rather than leaving the day off-target.
4. When all three slots are filled, macros and fiber are in range, and calories are near pace: call finalize_plan immediately.

Be efficient with tokens. Don't explain your reasoning, just call tools.

## Ingredients
Every ingredient in add_meal and modify_meal is identified by its numeric ingredientId. Names are not accepted.

- The pantry and shopping-list sections of the planning message already give you the id and the per-100g nutrition for every item they list. Use those ids directly. Do not look those items up.
- For anything not in those lists, call lookup_ingredient ONCE with every name you need in the names array. It returns an id and nutrition for each.
- If a lookup returns found: false, pick one of the suggested ids rather than calling again.

Use recipe-accurate names in lookup queries: "chicken breast" not "chicken", "black beans" not "beans", "salmon" not "fish", "brown rice" not "rice", "olive oil" not "oil".
```

Leave the `## Daily Targets`, `## Calories & Cost`, `## Dietary`, `## Preferences`, `## Variety`, and `## Pantry & Shopping Efficiency` sections unchanged.

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run && npx tsc`
Expected: PASS, clean typecheck. If other tests in `tool-handlers.test.ts` still pass name-shaped ingredients to `add_meal`, update them to ids using the `idOf` helper pattern from Step 1.

- [ ] **Step 8: Commit**

```bash
git add src/agent/types.ts src/agent/tools.ts src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts src/services/agent-planner.ts
git commit -m "fix: bind meal ingredients by id instead of re-searching the name

add_meal discarded the id lookup_ingredient had just returned and re-ran a
global top-1 vector search on the model's free-text name. MiniLM embeddings
cannot discriminate numerals: 'ground beef, 93% lean' ranks the 97% entry
above the 93% one by 0.0028, clearing the 0.8 floor by 0.0001.

Pantry consumption matches on ingredientId, so that one-id miss meant the
pantry item was never drawn down and a near-duplicate went on the shopping
list. Seen in all three saved weekly plans.

storeMeal is now a primary-key read and performs no embedding."
```

---

### Task 6: Prompt cache breakpoints

Two breakpoints. The first covers `tools` plus `system`, which are byte-identical for the whole week. The second covers the planning message, which is rewritten daily and holds the per-day pace targets, so no day can read another day's calorie budget.

**Files:**
- Modify: `src/ai/client.ts` (the `MessageContent` union at lines 116-119, the `messages` initialiser at lines 121-124, the `messages.create` call)
- Modify: `src/ai/client.agent.test.ts`

**Interfaces:**
- Consumes: `modelConfig` wiring from Task 2.
- Produces: no new exports. The request sent to `messages.create` gains `cache_control` markers on the system block and on `messages[0]`.

- [ ] **Step 1: Write the failing test**

Add to `src/ai/client.agent.test.ts`:

```typescript
  it('caches the week-stable system block and the per-day planning message', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'day one',
      tools,
      toolHandler: async () => ({}),
    });

    const request = mockCreate.mock.calls[0][0];

    expect(request.system).toEqual([
      { type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } },
    ]);
    expect(request.messages[0].content[0]).toEqual({
      type: 'text',
      text: 'day one',
      cache_control: { type: 'ephemeral' },
    });
  });

  it('does not mark later turns, so only two breakpoints are ever sent', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(toolUseResponse('t1'));
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'day one',
      tools,
      toolHandler: async () => ({ ok: true }),
    });

    const request = mockCreate.mock.calls[1][0];
    const marked = JSON.stringify(request).match(/cache_control/g) ?? [];
    expect(marked).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/client.agent.test.ts -t 'caches the week-stable'`
Expected: FAIL. `request.system` is the bare string `'sys'`, not an array.

- [ ] **Step 3: Implement**

In `src/ai/client.ts`, add `cache_control` to the text variant of `MessageContent`:

```typescript
    type MessageContent =
      | {
          type: 'text';
          text: string;
          cache_control?: { type: 'ephemeral' };
        }
      | { type: 'tool_use'; id: string; name: string; input: unknown }
      | { type: 'tool_result'; tool_use_id: string; content: string };
```

Mark the planning message when the array is initialised:

```typescript
    const messages: Array<{
      role: 'user' | 'assistant';
      content: MessageContent[];
    }> = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: initialMessage,
            // Breakpoint 2: rewritten each day. The per-day pace targets live
            // in this block, so each day writes its own entry and no day can
            // read another day's calorie budget.
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ];
```

Change the `system` argument of `messages.create` to an array:

```typescript
        system: [
          {
            type: 'text' as const,
            text: systemPrompt,
            // Breakpoint 1: tools render before system, and both are
            // byte-identical for the whole week, so this is read across every
            // day of a run.
            cache_control: { type: 'ephemeral' as const },
          },
        ],
```

Do **not** pass a top-level `cache_control` to `messages.create`. It auto-places on the last cacheable block, which every iteration is the newest `tool_result`, paying a write premium each turn.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ai/client.agent.test.ts && npx tsc`
Expected: PASS, clean typecheck.

- [ ] **Step 5: Verify against the live API**

This one needs a real call, so it is a manual check rather than a unit test.

```bash
MEAL_DATA_DIR=/tmp/meal-cache-check npx tsx -e "
import { AIClient } from './src/ai/client.js';
const c = new AIClient(process.env.ANTHROPIC_API_KEY);
console.log('run a day and inspect usage; see the note below');
"
```

Simpler and sufficient: add a temporary `console.log(response.usage)` after the `messages.create` call, run one real `plan week` against an isolated `MEAL_DATA_DIR`, and confirm `cache_read_input_tokens` is greater than zero from iteration 2 onward, and greater than zero on day 2's first iteration. The second reading is the one that proves breakpoint 1 survived the day boundary. Remove the `console.log` before committing.

If either reads zero, the cause is one of: the prefix fell under the model's minimum (1024 tokens on Sonnet 5), or something volatile leaked into `tools` or `system`.

- [ ] **Step 6: Commit**

```bash
git add src/ai/client.ts src/ai/client.agent.test.ts
git commit -m "perf: add prompt cache breakpoints to the planning loop

Two breakpoints. The first covers tools plus system, which are identical for
the whole week. The second covers the planning message, which holds the
per-day pace targets, so each day writes its own entry and no day can read
another day's calorie budget.

Explicit placement rather than top-level cache_control, which would
auto-place on the newest tool_result and pay a write premium every turn."
```

---

### Task 7: Validation-run analyzer

The design doc pre-registers four runs over model, thinking, and effort. This task builds the measurement tool so the runs produce comparable numbers. The runs themselves cost money and are executed by the user.

**Files:**
- Create: `scripts/analyze-plan-run.ts`

**Interfaces:**
- Consumes: the debug logs written by `PlanningProgressTracker`, the plan JSON written by the data store, and `pantry.json`.
- Produces: a CLI printing one metrics block per run directory.

- [ ] **Step 1: Write the analyzer**

Create `scripts/analyze-plan-run.ts`:

```typescript
/**
 * Extracts the validation metrics defined in
 * docs/superpowers/specs/2026-08-02-id-based-ingredient-binding-design.md
 * from a completed `plan week` run.
 *
 * Usage: npx tsx scripts/analyze-plan-run.ts <MEAL_DATA_DIR> [label]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface PantryFile {
  items: Array<{ ingredientId: number; name: string }>;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  const inter = [...ta].filter((w) => tb.has(w)).length;
  return inter / new Set([...ta, ...tb]).size;
}

function main(): void {
  const dataDir = process.argv[2];
  const label = process.argv[3] ?? dataDir;
  if (!dataDir) {
    console.error('usage: analyze-plan-run.ts <MEAL_DATA_DIR> [label]');
    process.exit(1);
  }

  const debugDir = join(dataDir, 'debug');
  const logs = existsSync(debugDir)
    ? readdirSync(debugDir)
        .filter((f) => f.endsWith('.log'))
        .sort()
    : [];

  const toolCounts = new Map<string, number>();
  let iterations = 0;

  for (const f of logs) {
    const log = readFileSync(join(debugDir, f), 'utf8');
    iterations += (log.match(/^ITERATION \d+$/gm) ?? []).length;
    for (const m of log.matchAll(/Tool call: (\w+)/g)) {
      toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1);
    }
  }

  const planDir = join(dataDir, 'plans');
  const planFiles = existsSync(planDir)
    ? readdirSync(planDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];

  let mismatches = 0;
  let distinctIngredients = 0;
  let totals = { calories: 0, cost: 0 };

  if (planFiles.length > 0) {
    const plan = JSON.parse(
      readFileSync(join(planDir, planFiles[planFiles.length - 1]), 'utf8')
    ) as {
      days: Array<{
        meals: Record<
          string,
          { ingredients: Array<{ ingredientId: number; name: string }> } | null
        >;
      }>;
      totals: { calories: number; estimatedCost: number };
    };
    const pantry = JSON.parse(
      readFileSync(join(dataDir, 'pantry.json'), 'utf8')
    ) as PantryFile;

    totals = {
      calories: Math.round(plan.totals.calories),
      cost: plan.totals.estimatedCost,
    };

    const used = new Map<number, string>();
    for (const day of plan.days) {
      for (const meal of Object.values(day.meals)) {
        if (!meal) continue;
        for (const ing of meal.ingredients) {
          used.set(ing.ingredientId, ing.name);
        }
      }
    }
    distinctIngredients = used.size;

    // A mismatch is a planned ingredient that is not a pantry id but is a
    // close name-neighbour of one, i.e. the bug this change removes.
    for (const [id, name] of used) {
      if (pantry.items.some((p) => p.ingredientId === id)) continue;
      const near = pantry.items.some(
        (p) => p.ingredientId !== id && jaccard(name, p.name) >= 0.5
      );
      if (near) mismatches++;
    }
  }

  const line = (k: string, v: string | number) =>
    console.log(`  ${k.padEnd(26)} ${v}`);

  console.log(`\n=== ${label} ===`);
  line('planning sessions', logs.length);
  line('iterations', iterations);
  for (const [tool, n] of [...toolCounts].sort((a, b) => b[1] - a[1])) {
    line(`  ${tool}`, n);
  }
  line('distinct ingredients', distinctIngredients);
  line('PANTRY MISMATCHES', mismatches);
  line('weekly calories', totals.calories);
  line('weekly cost', `$${totals.cost.toFixed(2)}`);
}

main();
```

- [ ] **Step 2: Verify it runs against the existing production data**

Run: `npx tsx scripts/analyze-plan-run.ts ~/.meal-planner/data "baseline (pre-change, Haiku 4.5)"`
Expected: prints a block. `PANTRY MISMATCHES` should be greater than zero, since this data predates the fix. That non-zero reading is what confirms the metric detects the bug.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc && mise check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze-plan-run.ts
git commit -m "test: add analyzer for the pre-registered validation runs

Reports tool calls by tool, iterations, and pantry-mismatch count so the
four model/thinking/effort configurations produce comparable numbers."
```

- [ ] **Step 5: Record the run procedure**

Do not execute the runs. They cost roughly $6 to $10 on the user's API key and are their call. Report to the user that the runs are ready, and give them this procedure:

```bash
# Each run gets an isolated copy so real plans and pantry are never touched.
for cfg in "1 claude-haiku-4-5-20251001 disabled medium" \
           "2 claude-sonnet-5 disabled medium" \
           "3 claude-sonnet-5 adaptive medium" \
           "4 claude-sonnet-5 disabled high"; do
  set -- $cfg
  rm -rf /tmp/meal-run-$1 && cp -r ~/.meal-planner/data /tmp/meal-run-$1
  rm -rf /tmp/meal-run-$1/debug /tmp/meal-run-$1/plans && mkdir -p /tmp/meal-run-$1/plans
  MEAL_DATA_DIR=/tmp/meal-run-$1 MEAL_MODEL=$2 MEAL_THINKING=$3 MEAL_EFFORT=$4 \
    npx tsx src/index.ts plan week
  npx tsx scripts/analyze-plan-run.ts /tmp/meal-run-$1 "run $1: $2 thinking=$3 effort=$4"
done
```

**Run 3 has a prerequisite.** Adaptive thinking returns `thinking` blocks, and the assistant-turn rebuild at `src/ai/client.ts:150-165` handles only `text` and `tool_use`, so it would drop them before pushing the turn back into `messages`. Dropping them can trigger ordering and signature errors on replay. Before executing run 3, extend the `MessageContent` union with a `thinking` variant and preserve those blocks verbatim. Do not run 3 against the unfixed loop.

Decision rules are in the spec's "Validation runs" section. Apply them rather than reinterpreting the numbers.

---

## Self-Review

**Spec coverage.** Section 1 (tool schemas) is Tasks 4 and 5. Section 2 (resolution) is Task 5. Section 3 (context) is Task 3, with the system prompt half in Task 5 Step 6 so the prompt and the schema change land together. Section 4 (feedback) is Task 5 Step 5. Section 5 (prompt caching) is Task 6. Section 6 (model upgrade) is Tasks 1 and 2. The Testing section is distributed across the tasks. The Validation runs section is Task 7.

**Ordering.** Tasks 3 and 4 make ids available in the planning message and in lookup results *before* Task 5 makes them mandatory, so the tree is functional at every commit rather than briefly broken between the schema change and the prompt change.

**Type consistency.** `ingredientId` is the field name in `MealIngredientInput`, in the tool schema, in the `add_meal` result, and in `PantryItem`/`IngredientRequirement`, which already use it. `LookupHit` uses bare `id`, matching the existing shape returned by `handleLookupIngredient` and the `getIngredientById` accessor. `IngredientFacts` field names match `Ingredient` exactly, so `collectFacts` is a straight projection.

**Known gap, deliberate.** Task 6 Step 5 is a manual live-API check rather than an automated test, because cache behaviour cannot be asserted against a mocked client. The unit tests cover request shape; only a real call proves the cache is read.
