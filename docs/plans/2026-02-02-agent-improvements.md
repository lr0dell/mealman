# Agent Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the meal planning agent's ingredient matching, encourage pantry usage, enforce shopping list limits, and generate accurate finalization notes.

**Architecture:** Four independent improvements to the agent system:
1. Ingredient lookup with similarity threshold and suggestions for low-confidence matches
2. Pantry tracking in PlanState with encouragement (not enforcement) in prompts
3. Shopping list tracking with limit warnings during planning
4. Server-side generation of accurate finalization notes

**Tech Stack:** TypeScript, Vitest, SQLite (sqlite-vec), Anthropic API

---

## Task 1: Add Similarity Threshold to Ingredient Lookup

**Files:**
- Modify: `src/agent/tool-handlers.ts:180-220`
- Test: `src/agent/tool-handlers.test.ts`

**Step 1: Write failing tests for similarity threshold**

Add these tests to `tool-handlers.test.ts` in the `lookup_ingredient` describe block:

```typescript
it('rejects low-confidence matches and returns suggestions', async () => {
  // "eggs" should not match "chicken breast" with high confidence
  const result = await handlers.handle('lookup_ingredient', {
    name: 'eggs',
  });

  expect(result).toMatchObject({
    found: false,
  });
  expect((result as { suggestions: unknown[] }).suggestions).toBeDefined();
});

it('accepts high-confidence matches', async () => {
  const result = await handlers.handle('lookup_ingredient', {
    name: 'chicken',
  });

  expect(result).toMatchObject({
    found: true,
    ingredient: {
      matchedName: 'chicken breast',
    },
  });
});

it('suggests being more specific when match is ambiguous', async () => {
  const result = await handlers.handle('lookup_ingredient', {
    name: 'meat',
  });

  // Should suggest specific options
  expect(result).toHaveProperty('suggestions');
  expect((result as { message: string }).message).toContain('more specific');
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: Tests fail because current implementation always returns `found: true`

**Step 3: Implement similarity threshold with suggestions**

In `src/agent/tool-handlers.ts`, replace `handleLookupIngredient`:

```typescript
const MINIMUM_SIMILARITY = 0.80;

async function handleLookupIngredient(input: LookupIngredientInput): Promise<
  | {
      found: true;
      ingredient: {
        name: string;
        matchedName: string;
        similarity: number;
        proteinPer100g: number;
        carbsPer100g: number;
        fatPer100g: number;
        fiberPer100g: number;
        pricePerUnit: number;
        unit: string;
      };
    }
  | {
      found: false;
      message: string;
      suggestions: Array<{ name: string; similarity: number }>;
    }
> {
  const matches = await ingredientDb.searchIngredients(input.name, 5);

  if (matches.length === 0) {
    return {
      found: false,
      message: `No ingredients found for "${input.name}".`,
      suggestions: [],
    };
  }

  const topMatch = matches[0];

  if (topMatch.similarity >= MINIMUM_SIMILARITY) {
    return {
      found: true,
      ingredient: {
        name: input.name,
        matchedName: topMatch.ingredient.name,
        similarity: topMatch.similarity,
        proteinPer100g: topMatch.ingredient.proteinPer100g,
        carbsPer100g: topMatch.ingredient.carbsPer100g,
        fatPer100g: topMatch.ingredient.fatPer100g,
        fiberPer100g: topMatch.ingredient.fiberPer100g,
        pricePerUnit: topMatch.ingredient.pricePerUnit,
        unit: topMatch.ingredient.unit,
      },
    };
  }

  // Low confidence - return suggestions
  const suggestions = matches.map((m) => ({
    name: m.ingredient.name,
    similarity: m.similarity,
  }));

  return {
    found: false,
    message: `No confident match for "${input.name}". Please be more specific (e.g., "black beans" instead of "beans", "chicken breast" instead of "chicken").`,
    suggestions,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: add similarity threshold to ingredient lookup

Rejects low-confidence matches (<0.80) and returns suggestions.
Encourages agent to use specific ingredient names like 'chicken breast'
instead of 'chicken', improving nutritional data accuracy.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update System Prompt for Specific Ingredient Names

**Files:**
- Modify: `src/services/agent-planner.ts:35-78`
- Test: `src/services/agent-planner.test.ts`

**Step 1: Write failing test for prompt content**

Add to `agent-planner.test.ts`:

```typescript
describe('buildSystemPrompt', () => {
  it('instructs agent to use recipe-accurate ingredient names', () => {
    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('recipe-accurate ingredient names');
    expect(prompt).toContain('chicken breast');
    expect(prompt).toContain('black beans');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: FAIL - prompt doesn't contain those strings

**Step 3: Update the system prompt**

In `src/services/agent-planner.ts`, update `buildSystemPrompt` to add after the Process section:

```typescript
## Ingredient Naming
Use recipe-accurate ingredient names for reliable nutrition matching:
- "chicken breast" or "chicken thigh" not "chicken"
- "black beans" or "kidney beans" not "beans"
- "salmon" or "cod" not "fish"
- "brown rice" or "jasmine rice" not "rice"
- "olive oil" not "oil"

If lookup_ingredient returns found: false, use one of the suggested names.
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/agent-planner.ts src/services/agent-planner.test.ts
git commit -m "feat: update prompt to encourage specific ingredient names

Adds guidance for agent to use recipe-accurate ingredient names
like 'chicken breast' instead of 'chicken' for better matching.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Track Unique Ingredients and Warn on Shopping List Size

**Files:**
- Modify: `src/services/plan-state.ts`
- Modify: `src/agent/tool-handlers.ts`
- Test: `src/services/plan-state.test.ts`

**Step 1: Write failing tests for ingredient tracking**

Add to `plan-state.test.ts`:

```typescript
describe('ingredient tracking', () => {
  it('tracks unique ingredients across all meals', () => {
    const state = new PlanState('2026-W05', mockProfile, mockPantry);

    state.addMeal('2026-01-27', 'breakfast', {
      name: 'Eggs',
      recipe: 'Scrambled',
      ingredients: [
        { name: 'whole egg', amount: 100, unit: 'g' },
        { name: 'butter', amount: 10, unit: 'g' },
      ],
      prepTime: 10,
      calories: 200,
      macros: { protein: 15, carbs: 1, fat: 15, fiber: 0 },
      estimatedCost: 2,
      servings: 1,
      leftoverOf: null,
    });

    state.addMeal('2026-01-27', 'lunch', {
      name: 'Chicken',
      recipe: 'Grilled',
      ingredients: [
        { name: 'chicken breast', amount: 200, unit: 'g' },
        { name: 'butter', amount: 10, unit: 'g' }, // duplicate
      ],
      prepTime: 20,
      calories: 300,
      macros: { protein: 40, carbs: 0, fat: 8, fiber: 0 },
      estimatedCost: 4,
      servings: 1,
      leftoverOf: null,
    });

    const ingredients = state.getUniqueIngredients();
    expect(ingredients).toHaveLength(3); // whole egg, butter, chicken breast
    expect(ingredients).toContain('whole egg');
    expect(ingredients).toContain('butter');
    expect(ingredients).toContain('chicken breast');
  });

  it('returns shopping list status with count and warning', () => {
    const state = new PlanState('2026-W05', mockProfile, mockPantry);

    // Add meal with many ingredients
    state.addMeal('2026-01-27', 'breakfast', {
      name: 'Complex meal',
      recipe: 'Cook it',
      ingredients: Array.from({ length: 18 }, (_, i) => ({
        name: `ingredient-${i}`,
        amount: 100,
        unit: 'g',
      })),
      prepTime: 30,
      calories: 500,
      macros: { protein: 20, carbs: 50, fat: 20, fiber: 5 },
      estimatedCost: 15,
      servings: 1,
      leftoverOf: null,
    });

    const status = state.getShoppingListStatus();
    expect(status.count).toBe(18);
    expect(status.limit).toBe(20);
    expect(status.warning).toBe('Approaching limit: 18/20 unique ingredients');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: FAIL - methods don't exist

**Step 3: Implement ingredient tracking in PlanState**

Add to `src/services/plan-state.ts`:

```typescript
private readonly SHOPPING_LIST_LIMIT = 20;

getUniqueIngredients(): string[] {
  const ingredients = new Set<string>();

  for (const [, day] of this.days) {
    for (const meal of [day.breakfast, day.lunch, day.dinner]) {
      if (meal) {
        for (const ing of meal.ingredients) {
          ingredients.add(ing.name.toLowerCase());
        }
      }
    }
  }

  return Array.from(ingredients);
}

getShoppingListStatus(): {
  count: number;
  limit: number;
  warning: string | null;
} {
  const ingredients = this.getUniqueIngredients();
  const count = ingredients.length;

  let warning: string | null = null;
  if (count >= this.SHOPPING_LIST_LIMIT) {
    warning = `Shopping list limit reached: ${count}/${this.SHOPPING_LIST_LIMIT} unique ingredients. Reuse existing ingredients.`;
  } else if (count >= this.SHOPPING_LIST_LIMIT - 5) {
    warning = `Approaching limit: ${count}/${this.SHOPPING_LIST_LIMIT} unique ingredients`;
  }

  return { count, limit: this.SHOPPING_LIST_LIMIT, warning };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/plan-state.ts src/services/plan-state.test.ts
git commit -m "feat: track unique ingredients and shopping list limits

Tracks all unique ingredients across meals and warns when
approaching 20-item limit to encourage ingredient reuse.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Include Shopping List Status in Tool Responses

**Files:**
- Modify: `src/agent/tool-handlers.ts`
- Test: `src/agent/tool-handlers.test.ts`

**Step 1: Write failing test for shopping list in responses**

Add to `tool-handlers.test.ts`:

```typescript
describe('add_meal shopping list tracking', () => {
  it('includes shopping list status in add_meal response', async () => {
    const result = await handlers.handle('add_meal', {
      date: '2026-01-27',
      slot: 'breakfast',
      name: 'Test meal',
      recipe: 'Cook it',
      ingredients: [
        { name: 'chicken breast', amountGrams: 200 },
        { name: 'brown rice', amountGrams: 150 },
      ],
      prepTime: 20,
      servings: 2,
    });

    expect(result).toHaveProperty('shoppingList');
    expect((result as { shoppingList: { count: number } }).shoppingList.count).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: FAIL - no shoppingList property

**Step 3: Add shopping list to add_meal and modify_meal responses**

In `src/agent/tool-handlers.ts`, update the return type and return statement for `handleAddMeal`:

```typescript
// In the success return, add:
shoppingList: planState.getShoppingListStatus(),
```

Update the return type to include:
```typescript
shoppingList: {
  count: number;
  limit: number;
  warning: string | null;
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: include shopping list status in meal responses

Agent now sees ingredient count and warnings after each meal,
encouraging reuse of existing ingredients.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Pantry Tracking to PlanState

**Files:**
- Modify: `src/services/plan-state.ts`
- Test: `src/services/plan-state.test.ts`

**Step 1: Write failing tests for pantry usage tracking**

Add to `plan-state.test.ts`:

```typescript
describe('pantry tracking', () => {
  it('tracks when pantry items are used in meals', () => {
    const pantryWithItems: Pantry = {
      items: [
        { name: 'eggs', quantity: 12, unit: 'count' },
        { name: 'butter', quantity: 500, unit: 'g' },
      ],
    };

    const state = new PlanState('2026-W05', mockProfile, pantryWithItems);

    state.addMeal('2026-01-27', 'breakfast', {
      name: 'Eggs',
      recipe: 'Scrambled',
      ingredients: [
        { name: 'eggs', amount: 100, unit: 'g' },
        { name: 'butter', amount: 20, unit: 'g' },
      ],
      prepTime: 10,
      calories: 200,
      macros: { protein: 15, carbs: 1, fat: 15, fiber: 0 },
      estimatedCost: 2,
      servings: 1,
      leftoverOf: null,
    });

    const status = state.getPantryStatus();
    expect(status).toHaveLength(2);

    const eggsStatus = status.find(s => s.name === 'eggs');
    expect(eggsStatus?.used).toBe(true);

    const butterStatus = status.find(s => s.name === 'butter');
    expect(butterStatus?.used).toBe(true);
  });

  it('identifies unused pantry items', () => {
    const pantryWithItems: Pantry = {
      items: [
        { name: 'eggs', quantity: 12, unit: 'count' },
        { name: 'milk', quantity: 1000, unit: 'ml' },
      ],
    };

    const state = new PlanState('2026-W05', mockProfile, pantryWithItems);

    // Only use eggs
    state.addMeal('2026-01-27', 'breakfast', {
      name: 'Eggs',
      recipe: 'Boiled',
      ingredients: [{ name: 'eggs', amount: 100, unit: 'g' }],
      prepTime: 10,
      calories: 150,
      macros: { protein: 12, carbs: 1, fat: 10, fiber: 0 },
      estimatedCost: 1,
      servings: 1,
      leftoverOf: null,
    });

    const unused = state.getUnusedPantryItems();
    expect(unused).toHaveLength(1);
    expect(unused[0]).toBe('milk');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: FAIL - methods don't exist

**Step 3: Implement pantry tracking**

Add to `src/services/plan-state.ts`:

```typescript
getPantryStatus(): Array<{ name: string; quantity: number; unit: string; used: boolean }> {
  const usedIngredients = new Set(
    this.getUniqueIngredients().map(i => i.toLowerCase())
  );

  return this.pantry.items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    used: usedIngredients.has(item.name.toLowerCase()),
  }));
}

getUnusedPantryItems(): string[] {
  return this.getPantryStatus()
    .filter(item => !item.used)
    .map(item => item.name);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/plan-state.ts src/services/plan-state.test.ts
git commit -m "feat: track pantry item usage in meal plans

Identifies which pantry items have been incorporated into meals
to encourage (but not require) using available ingredients.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Include Pantry Status in get_plan_state Response

**Files:**
- Modify: `src/agent/tool-handlers.ts`
- Test: `src/agent/tool-handlers.test.ts`

**Step 1: Write failing test**

Add to `tool-handlers.test.ts`:

```typescript
describe('get_plan_state with pantry', () => {
  it('includes unused pantry items in response', async () => {
    // Create handlers with pantry items
    const pantryState = new PlanState('2026-W05', mockProfile, {
      items: [{ name: 'eggs', quantity: 12, unit: 'count' }],
    });
    const handlersWithPantry = createToolHandlers(pantryState, ingredientDb);

    const result = await handlersWithPantry.handle('get_plan_state', {});

    expect(result).toHaveProperty('pantryStatus');
    expect((result as { pantryStatus: { unusedItems: string[] } }).pantryStatus.unusedItems).toContain('eggs');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: FAIL

**Step 3: Add pantry status to get_plan_state**

Update `handleGetPlanState` in `src/agent/tool-handlers.ts`:

```typescript
function handleGetPlanState(): {
  week: string;
  mealsPlanned: number;
  weeklyTotals: { /* ... */ };
  remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
  shoppingList: ReturnType<typeof planState.getShoppingListStatus>;
  pantryStatus: {
    items: ReturnType<typeof planState.getPantryStatus>;
    unusedItems: string[];
  };
} {
  const summary = planState.getSummary();
  const remaining = planState.getRemainingBudget();
  return {
    week: planState.getWeek(),
    mealsPlanned: summary.mealsPlanned,
    weeklyTotals: summary.weeklyTotals,
    remainingBudget: remaining,
    shoppingList: planState.getShoppingListStatus(),
    pantryStatus: {
      items: planState.getPantryStatus(),
      unusedItems: planState.getUnusedPantryItems(),
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: include pantry and shopping list status in plan state

Agent now sees unused pantry items and shopping list count
when checking plan state, encouraging ingredient reuse.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update System Prompt for Pantry and Shopping List

**Files:**
- Modify: `src/services/agent-planner.ts`
- Test: `src/services/agent-planner.test.ts`

**Step 1: Write failing test**

Add to `agent-planner.test.ts`:

```typescript
it('encourages pantry usage without requiring it', () => {
  const prompt = planner.buildSystemPrompt(mockProfile);

  expect(prompt).toContain('pantry');
  expect(prompt).toContain('encouraged');
  expect(prompt).not.toContain('MUST use pantry');
  expect(prompt).not.toContain('required to use');
});

it('mentions shopping list limit', () => {
  const prompt = planner.buildSystemPrompt(mockProfile);

  expect(prompt).toContain('shopping list');
  expect(prompt).toContain('20');
  expect(prompt).toContain('reuse');
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: FAIL

**Step 3: Update system prompt**

Add to `buildSystemPrompt` in `src/services/agent-planner.ts`:

```typescript
## Pantry & Shopping Efficiency
- You are encouraged to incorporate pantry items when they fit naturally
- Check pantryStatus.unusedItems in get_plan_state to see available pantry items
- Keep the shopping list small (under 20 unique ingredients) by reusing ingredients across meals
- When shoppingList.warning appears, prioritize ingredients already in the plan
- A compact shopping list is more economical and practical for the user
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/agent-planner.ts src/services/agent-planner.test.ts
git commit -m "feat: update prompt for pantry and shopping list guidance

Encourages (not requires) using pantry items and keeping
shopping list under 20 items for practicality.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Generate Accurate Finalization Notes Server-Side

**Files:**
- Modify: `src/agent/tool-handlers.ts`
- Test: `src/agent/tool-handlers.test.ts`

**Step 1: Write failing test**

Add to `tool-handlers.test.ts`:

```typescript
describe('finalize_plan', () => {
  it('generates accurate notes from actual plan state', async () => {
    // Add a meal first
    await handlers.handle('add_meal', {
      date: '2026-01-27',
      slot: 'breakfast',
      name: 'Test meal',
      recipe: 'Cook it',
      ingredients: [{ name: 'chicken breast', amountGrams: 200 }],
      prepTime: 20,
      servings: 2,
    });

    const result = await handlers.handle('finalize_plan', {
      notes: 'Agent notes with wrong numbers: 9999 calories',
    });

    const typedResult = result as { autoNotes: string };
    expect(typedResult.autoNotes).toBeDefined();
    expect(typedResult.autoNotes).not.toContain('9999');
    expect(typedResult.autoNotes).toContain('calories');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: FAIL - no autoNotes field

**Step 3: Generate accurate notes in finalize handler**

Update `handleFinalizePlan` in `src/agent/tool-handlers.ts`:

```typescript
function handleFinalizePlan(input: FinalizePlanInput): {
  success: true;
  plan: ReturnType<typeof planState.toWeeklyPlan>;
  notes: string | undefined;
  autoNotes: string;
} {
  const plan = planState.toWeeklyPlan();
  const summary = planState.getSummary();
  const shoppingList = planState.getShoppingListStatus();
  const unusedPantry = planState.getUnusedPantryItems();

  const autoNotes = [
    `Week ${plan.week} complete.`,
    `${summary.mealsPlanned} meals planned.`,
    `Calories: ${Math.round(plan.totals.calories)}.`,
    `Protein: ${Math.round(plan.totals.macros.protein)}g.`,
    `Cost: $${plan.totals.estimatedCost.toFixed(2)}.`,
    `Shopping list: ${shoppingList.count} items.`,
    unusedPantry.length > 0
      ? `Unused pantry: ${unusedPantry.join(', ')}.`
      : 'All pantry items incorporated.',
  ].join(' ');

  return {
    success: true,
    plan,
    notes: input.notes,
    autoNotes,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: generate accurate finalization notes server-side

Replaces agent-generated notes (which may be stale) with
accurate auto-generated summary from actual plan state.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run linting**

Run: `npm run lint`
Expected: No errors

**Step 3: Build project**

Run: `npm run build`
Expected: Compiles successfully

**Step 4: Final commit for any formatting fixes**

```bash
git add -A
git status
# If any files changed from lint/format:
git commit -m "chore: lint and format fixes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/agent/tool-handlers.ts` | Similarity threshold, shopping list in responses, pantry status, accurate finalize notes |
| `src/services/plan-state.ts` | Ingredient tracking, shopping list limits, pantry usage tracking |
| `src/services/agent-planner.ts` | Prompt updates for ingredient naming, pantry encouragement, shopping limits |
| `**/**.test.ts` | Corresponding test coverage |

## Expected Agent Behavior After Changes

1. **Ingredient Lookup**: Agent receives `found: false` with suggestions when using vague terms like "beans", prompting it to use "black beans" or "kidney beans" instead

2. **Shopping List**: Agent sees `shoppingList.warning` after ~15 ingredients, encouraging reuse

3. **Pantry**: Agent sees `pantryStatus.unusedItems` and is encouraged (not forced) to incorporate them

4. **Finalization**: Accurate `autoNotes` field with real calorie/cost numbers regardless of what the agent claims
