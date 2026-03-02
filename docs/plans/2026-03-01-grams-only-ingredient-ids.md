# Grams-Only Units & Ingredient ID Linking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lock all ingredient units to grams across the entire system and require meal ingredients to reference ingredient database entries by ID.

**Architecture:** Remove `unit`/`unitWeightGrams` fields from the ingredient DB, rename `pricePerUnit` to `pricePerGram` everywhere, constrain pantry and meal ingredient `unit` to `z.literal('g')`, add `ingredientId` to meal ingredients, and simplify cost calculation to `amountGrams * pricePerGram`.

**Tech Stack:** TypeScript, Zod, SQLite (better-sqlite3), Vitest

---

### Task 1: Update knowledge schema types

**Files:**
- Modify: `src/schemas/knowledge.ts`
- Test: `src/schemas/knowledge.test.ts`

**Step 1: Update the test fixtures**

In `src/schemas/knowledge.test.ts`, replace both test fixtures. Change `pricePerUnit` → `pricePerGram` with the value divided by 1000, remove `unit` and `unitWeightGrams`:

```typescript
import { describe, it, expect } from 'vitest';
import { IngredientEntrySchema } from './knowledge.js';

describe('Knowledge Schemas', () => {
  describe('IngredientEntrySchema with confidence', () => {
    it('validates ingredient with usda confidence', () => {
      const ingredient = {
        name: 'chicken breast',
        pricePerGram: 0.01,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'usda',
        usdaFdcId: 171477,
        lastUpdated: '2026-01-30',
      };
      const result = IngredientEntrySchema.safeParse(ingredient);
      expect(result.success).toBe(true);
    });

    it('validates ingredient with ai-estimate confidence', () => {
      const ingredient = {
        name: 'homemade granola',
        pricePerGram: 0.008,
        proteinPer100g: 10,
        carbsPer100g: 65,
        fatPer100g: 18,
        fiberPer100g: 7,
        confidence: 'ai-estimate',
        lastUpdated: '2026-01-30',
      };
      const result = IngredientEntrySchema.safeParse(ingredient);
      expect(result.success).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/schemas/knowledge.test.ts`
Expected: FAIL — schema still expects `pricePerUnit`, `unit`, `unitWeightGrams`

**Step 3: Update the schema and interfaces**

In `src/schemas/knowledge.ts`:
- `IngredientEntrySchema`: Replace `pricePerUnit`, `unit`, `unitWeightGrams` with `pricePerGram: z.number().nonnegative()`
- `Ingredient` interface: Replace `pricePerUnit`, `unit`, `unitWeightGrams` with `pricePerGram: number`
- `NewIngredient` interface: Replace `pricePerUnit`, `unit`, `unitWeightGrams` with `pricePerGram: number`

Full updated `IngredientEntrySchema`:
```typescript
export const IngredientEntrySchema = z.object({
  name: z.string(),
  pricePerGram: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative(),
  confidence: z.enum(['usda', 'ai-estimate', 'manual']),
  usdaFdcId: z.number().optional(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

Full updated `Ingredient` interface:
```typescript
export interface Ingredient {
  id: number;
  name: string;
  searchName: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
  category: IngredientCategory;
  source: 'usda' | 'custom';
  usdaFdcId: number | null;
  createdAt: string;
}
```

Full updated `NewIngredient` interface:
```typescript
export interface NewIngredient {
  name: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
  category: IngredientCategory;
  usdaFdcId?: number;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/schemas/knowledge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/knowledge.ts src/schemas/knowledge.test.ts
git commit -m "refactor: update knowledge schema to use pricePerGram, remove unit/unitWeightGrams"
```

---

### Task 2: Update plan schema (add ingredientId, lock unit to 'g')

**Files:**
- Modify: `src/schemas/plan.ts`

**Step 1: Update MealIngredientSchema**

In `src/schemas/plan.ts`, change `MealIngredientSchema` to:

```typescript
export const MealIngredientSchema = z.object({
  ingredientId: z.number(),
  name: z.string(),
  amount: z.number().positive(),
  unit: z.literal('g'),
});
```

**Step 2: Run type check to see what breaks**

Run: `npx tsc --noEmit`
Expected: Errors in `tool-handlers.ts` (meal construction missing `ingredientId`) — these will be fixed in Task 5.

**Step 3: Commit**

```bash
git add src/schemas/plan.ts
git commit -m "refactor: add ingredientId to MealIngredientSchema, lock unit to 'g'"
```

---

### Task 3: Update pantry schema (lock unit to 'g')

**Files:**
- Modify: `src/schemas/pantry.ts`
- Modify: `src/commands/pantry.ts`

**Step 1: Update PantryItemSchema**

In `src/schemas/pantry.ts`, change the `unit` field:

```typescript
export const PantryItemSchema = z.object({
  ingredientId: z.number(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.literal('g'),
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

**Step 2: Update pantry commands**

In `src/commands/pantry.ts`, the `addPantryItem` function signature has a `unit: string` parameter. Change it to no longer accept a unit parameter — it's always 'g':

Change the function signature from:
```typescript
export async function addPantryItem(
  store: DataStore,
  ingredientId: number,
  name: string,
  quantity: number,
  unit: string,
  expirationDate?: string
): Promise<void> {
```

To:
```typescript
export async function addPantryItem(
  store: DataStore,
  ingredientId: number,
  name: string,
  quantity: number,
  expirationDate?: string
): Promise<void> {
```

And update the function body: change `item.unit === unit` to just `item.ingredientId === ingredientId` in the existing-item check (line 67), and set `unit: 'g'` in the new item object (line 84).

Updated existing-item check:
```typescript
  const existing = pantry.items.find(
    (item) => item.ingredientId === ingredientId
  );
```

Updated new item creation:
```typescript
    const newItem: PantryItem = {
      ingredientId,
      name: name.toLowerCase(),
      quantity,
      unit: 'g',
      addedDate: today,
    };
```

**Step 3: Fix callers of addPantryItem**

Search for all callers of `addPantryItem` and remove the `unit` argument. Check `src/commands/` and `src/` for usages.

Run: `grep -rn 'addPantryItem' src/`

Update each caller to remove the `unit` parameter.

**Step 4: Update pantry display formatting**

In `src/commands/pantry.ts`, the `formatPantryList` and `formatExpiringList` functions display `${item.quantity} ${item.unit}`. Since unit is always 'g', this is fine as-is — it will now display "500 g".

**Step 5: Commit**

```bash
git add src/schemas/pantry.ts src/commands/pantry.ts
git commit -m "refactor: lock pantry unit to 'g', remove unit parameter from addPantryItem"
```

---

### Task 4: Update macro calculator

**Files:**
- Modify: `src/services/macro-calculator.ts`
- Test: `src/services/macro-calculator.test.ts`

**Step 1: Update test fixtures**

In `src/services/macro-calculator.test.ts`, replace the `IngredientWithNutrition` fixtures. Remove `pricePerUnit`, `unit`, `unitWeightGrams` — replace with `pricePerGram`. Update cost calculation comments:

```typescript
// src/services/macro-calculator.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateCaloriesFromMacros,
  calculateMealNutrition,
  type IngredientWithNutrition,
} from './macro-calculator.js';

describe('MacroCalculator', () => {
  describe('calculateCaloriesFromMacros', () => {
    it('calculates calories from macros using standard formula', () => {
      // protein: 4 cal/g, carbs: 4 cal/g, fat: 9 cal/g
      const result = calculateCaloriesFromMacros({
        protein: 25,
        carbs: 50,
        fat: 10,
        fiber: 5,
      });
      // 25*4 + 50*4 + 10*9 = 100 + 200 + 90 = 390
      expect(result).toBe(390);
    });
  });

  describe('calculateMealNutrition', () => {
    it('sums nutrition from multiple ingredients', () => {
      const ingredients: IngredientWithNutrition[] = [
        {
          name: 'chicken breast',
          amountGrams: 200,
          proteinPer100g: 31,
          carbsPer100g: 0,
          fatPer100g: 3.6,
          fiberPer100g: 0,
          pricePerGram: 0.01,
        },
        {
          name: 'rice',
          amountGrams: 150,
          proteinPer100g: 2.7,
          carbsPer100g: 28,
          fatPer100g: 0.3,
          fiberPer100g: 0.4,
          pricePerGram: 0.002,
        },
      ];

      const result = calculateMealNutrition(ingredients);

      // Chicken 200g: 62g protein (248cal) + 7.2g fat (64.8cal) = 312.8 cal
      // Rice 150g: 4.05g protein (16.2cal) + 42g carbs (168cal) + 0.45g fat (4.05cal) = 188.25 cal
      // Total: 501.05 -> 501 cal (rounded)
      expect(result.calories).toBe(501);
      expect(result.macros.protein).toBeCloseTo(66.05, 1);
      expect(result.macros.carbs).toBeCloseTo(42, 1);
      expect(result.macros.fat).toBeCloseTo(7.65, 1);
      expect(result.macros.fiber).toBeCloseTo(0.6, 1);
      // Cost: chicken 200g * $0.01/g = $2, rice 150g * $0.002/g = $0.30
      expect(result.estimatedCost).toBeCloseTo(2.3, 2);
    });

    it('handles empty ingredient list', () => {
      const result = calculateMealNutrition([]);
      expect(result.calories).toBe(0);
      expect(result.macros.protein).toBe(0);
      expect(result.estimatedCost).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/macro-calculator.test.ts`
Expected: FAIL — interface still has `pricePerUnit`, `unit`, `unitWeightGrams`

**Step 3: Update IngredientWithNutrition and cost calculation**

In `src/services/macro-calculator.ts`, update the interface and cost formula:

```typescript
import type { Macros } from '../schemas/plan.js';

export interface IngredientWithNutrition {
  name: string;
  amountGrams: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
}

export interface MealNutrition {
  calories: number;
  macros: Macros;
  estimatedCost: number;
}

export function calculateCaloriesFromMacros(macros: Macros): number {
  // Standard: protein 4 cal/g, carbs 4 cal/g, fat 9 cal/g
  // Fiber is not counted (indigestible)
  return Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9);
}

export function calculateMealNutrition(
  ingredients: IngredientWithNutrition[]
): MealNutrition {
  if (ingredients.length === 0) {
    return {
      calories: 0,
      macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      estimatedCost: 0,
    };
  }

  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalCost = 0;

  for (const ing of ingredients) {
    const multiplier = ing.amountGrams / 100;
    totalProtein += ing.proteinPer100g * multiplier;
    totalCarbs += ing.carbsPer100g * multiplier;
    totalFat += ing.fatPer100g * multiplier;
    totalFiber += ing.fiberPer100g * multiplier;

    totalCost += ing.amountGrams * ing.pricePerGram;
  }

  const macros = {
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    fiber: totalFiber,
  };

  return {
    calories: calculateCaloriesFromMacros(macros),
    macros,
    estimatedCost: totalCost,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/macro-calculator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/macro-calculator.ts src/services/macro-calculator.test.ts
git commit -m "refactor: simplify macro calculator to use pricePerGram"
```

---

### Task 5: Update ingredient database

**Files:**
- Modify: `src/services/ingredient-database.ts`
- Test: `src/services/ingredient-database.test.ts`

**Step 1: Update test fixtures**

In `src/services/ingredient-database.test.ts`, replace all `addIngredient` calls. Remove `unit`/`unitWeightGrams`, change `pricePerUnit` → `pricePerGram` (divide value by 1000). Also update the update test:

Replace every `addIngredient({...})` call. Example for the first one:
```typescript
    const ingredient = await db.addIngredient({
      name: 'Chicken Breast',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerGram: 0.012,
      category: 'meat',
    });
```

Do the same for all other `addIngredient` calls in the file:
- Fish, raw: `pricePerGram: 0.015`
- Fish sticks: `pricePerGram: 0.008`
- Chicken breast, raw: `pricePerGram: 0.012`
- Chicken thigh, raw: `pricePerGram: 0.01`
- Rice: `pricePerGram: 0.003`
- Salmon: `pricePerGram: 0.015`

For the update test (line 141), change:
```typescript
    const updated = db.updateIngredient(ingredient.id, { pricePerGram: 0.018 });
    expect(updated.pricePerGram).toBe(0.018);
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/ingredient-database.test.ts`
Expected: FAIL

**Step 3: Update ingredient-database.ts**

In `src/services/ingredient-database.ts`:

Update `IngredientRow` interface — remove `unit`, `unit_weight_grams`, rename `price_per_unit` → `price_per_gram`:
```typescript
interface IngredientRow {
  id: number;
  name: string;
  search_name: string;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  price_per_gram: number;
  category: string;
  source: string;
  usda_fdc_id: number | null;
  created_at: string;
}
```

Update the `CREATE TABLE` SQL — remove `unit TEXT NOT NULL`, `unit_weight_grams REAL NOT NULL`, rename `price_per_unit` → `price_per_gram`:
```sql
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  protein_per_100g REAL NOT NULL,
  carbs_per_100g REAL NOT NULL,
  fat_per_100g REAL NOT NULL,
  fiber_per_100g REAL NOT NULL,
  price_per_gram REAL NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  usda_fdc_id INTEGER,
  created_at TEXT NOT NULL
);
```

Update `addIngredient` — remove `input.unit`, `input.unitWeightGrams`, rename `input.pricePerUnit` → `input.pricePerGram`. Update the INSERT statement to match (remove the two columns and their `?` placeholders):
```typescript
  async addIngredient(input: NewIngredient): Promise<Ingredient> {
    const searchName = input.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const createdAt = new Date().toISOString().split('T')[0];
    const source = input.usdaFdcId ? 'usda' : 'custom';

    const result = this.db
      .prepare(
        `INSERT INTO ingredients (
          name, search_name, protein_per_100g, carbs_per_100g, fat_per_100g,
          fiber_per_100g, price_per_gram, category,
          source, usda_fdc_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        searchName,
        input.proteinPer100g,
        input.carbsPer100g,
        input.fatPer100g,
        input.fiberPer100g,
        input.pricePerGram,
        input.category,
        source,
        input.usdaFdcId ?? null,
        createdAt
      );

    const id = result.lastInsertRowid;

    // Generate and store embedding
    const embedding = await this.embedder.embed(input.name);
    const idBigInt = typeof id === 'bigint' ? id : BigInt(id);
    this.db
      .prepare(
        'INSERT INTO ingredient_embeddings (ingredient_id, embedding) VALUES (?, ?)'
      )
      .run(idBigInt, Buffer.from(embedding.buffer));

    return this.getIngredientById(id)!;
  }
```

Update `rowToIngredient` — remove `unit`, `unitWeightGrams`, rename:
```typescript
  private rowToIngredient(row: IngredientRow): Ingredient {
    return {
      id: row.id,
      name: row.name,
      searchName: row.search_name,
      proteinPer100g: row.protein_per_100g,
      carbsPer100g: row.carbs_per_100g,
      fatPer100g: row.fat_per_100g,
      fiberPer100g: row.fiber_per_100g,
      pricePerGram: row.price_per_gram,
      category: row.category as IngredientCategory,
      source: row.source as 'usda' | 'custom',
      usdaFdcId: row.usda_fdc_id,
      createdAt: row.created_at,
    };
  }
```

Update `updateIngredient` fieldMap — remove `unit`, `unitWeightGrams`, rename:
```typescript
    const fieldMap: Record<string, string> = {
      name: 'name',
      searchName: 'search_name',
      proteinPer100g: 'protein_per_100g',
      carbsPer100g: 'carbs_per_100g',
      fatPer100g: 'fat_per_100g',
      fiberPer100g: 'fiber_per_100g',
      pricePerGram: 'price_per_gram',
      category: 'category',
      source: 'source',
      usdaFdcId: 'usda_fdc_id',
    };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/ingredient-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/ingredient-database.ts src/services/ingredient-database.test.ts
git commit -m "refactor: update ingredient DB to use price_per_gram, remove unit columns"
```

---

### Task 6: Update tool handlers (add ingredientId to meals, use pricePerGram)

**Files:**
- Modify: `src/agent/tool-handlers.ts`
- Test: `src/agent/tool-handlers.test.ts`

**Step 1: Update test fixtures**

In `src/agent/tool-handlers.test.ts`:

Update all `addIngredient` calls in `beforeEach` — remove `unit`/`unitWeightGrams`, change `pricePerUnit` → `pricePerGram`:
```typescript
    await ingredientDb.addIngredient({
      name: 'chicken breast',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerGram: 0.01,
      category: 'meat',
    });

    await ingredientDb.addIngredient({
      name: 'brown rice',
      proteinPer100g: 2.7,
      carbsPer100g: 23,
      fatPer100g: 0.9,
      fiberPer100g: 1.8,
      pricePerGram: 0.003,
      category: 'grains',
    });

    await ingredientDb.addIngredient({
      name: 'broccoli',
      proteinPer100g: 2.8,
      carbsPer100g: 7,
      fatPer100g: 0.4,
      fiberPer100g: 2.6,
      pricePerGram: 0.004,
      category: 'produce',
    });
```

Update the `lookup_ingredient` test assertion (around line 139-151) — change `pricePerUnit: 10, unit: 'kg'` → `pricePerGram: 0.01`:
```typescript
      expect(result).toMatchObject({
        found: true,
        ingredient: {
          name: 'chicken breast',
          matchedName: 'chicken breast',
          proteinPer100g: 31,
          carbsPer100g: 0,
          fatPer100g: 3.6,
          fiberPer100g: 0,
          pricePerGram: 0.01,
        },
      });
```

Update the pantry test (line 231-238) — change `unit: 'count'` → `unit: 'g'`:
```typescript
          {
            ingredientId: 1,
            name: 'eggs',
            quantity: 600,
            unit: 'g',
            addedDate: '2026-02-03',
          },
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/tool-handlers.test.ts`
Expected: FAIL

**Step 3: Update tool-handlers.ts**

In `src/agent/tool-handlers.ts`:

Update `handleAddMeal` — change the `ingredientsWithNutrition` construction (lines 104-114):
```typescript
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerGram: entry.pricePerGram,
      });
```

Update the meal construction (lines 120-134) — add `ingredientId` from the matched entry. Need to store the entry IDs. Change the loop to also collect entry IDs, then use them:

Replace the ingredient mapping (lines 123-127):
```typescript
      ingredients: input.ingredients.map((i, idx) => ({
        ingredientId: ingredientIds[idx],
        name: ingredientsWithNutrition[idx].name,
        amount: i.amountGrams,
        unit: 'g' as const,
      })),
```

You'll need to collect ingredient IDs. Add a `const ingredientIds: number[] = [];` alongside `ingredientsWithNutrition`, and push `entry.id` in the loop:

After `const entry = match.ingredient;` add:
```typescript
      ingredientIds.push(entry.id);
```

Update `handleLookupIngredient` return type and response (lines 199-246):

Change the `found: true` return type from `pricePerUnit: number; unit: string;` to `pricePerGram: number;`:
```typescript
  async function handleLookupIngredient(input: LookupIngredientInput): Promise<
    | {
        found: true;
        ingredient: {
          id: number;
          name: string;
          matchedName: string;
          similarity: number;
          proteinPer100g: number;
          carbsPer100g: number;
          fatPer100g: number;
          fiberPer100g: number;
          pricePerGram: number;
        };
      }
    | {
        found: false;
        message: string;
        suggestions: Array<{ name: string; similarity: number }>;
      }
  > {
```

And update the return object (lines 233-245):
```typescript
      return {
        found: true,
        ingredient: {
          id: topMatch.ingredient.id,
          name: input.name,
          matchedName: topMatch.ingredient.name,
          similarity: topMatch.similarity,
          proteinPer100g: topMatch.ingredient.proteinPer100g,
          carbsPer100g: topMatch.ingredient.carbsPer100g,
          fatPer100g: topMatch.ingredient.fatPer100g,
          fiberPer100g: topMatch.ingredient.fiberPer100g,
          pricePerGram: topMatch.ingredient.pricePerGram,
        },
      };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "refactor: update tool handlers to use pricePerGram and store ingredientId in meals"
```

---

### Task 7: Update agent integration test fixtures

**Files:**
- Modify: `src/agent/agent.integration.test.ts`

**Step 1: Update fixtures**

Update the `mockPantry` (lines 59-76) — change units to 'g' and adjust quantities:
```typescript
  const mockPantry: Pantry = {
    items: [
      {
        ingredientId: 1,
        name: 'rice',
        quantity: 2000,
        unit: 'g',
        addedDate: '2026-01-30',
      },
      {
        ingredientId: 2,
        name: 'olive oil',
        quantity: 1000,
        unit: 'g',
        addedDate: '2026-01-30',
      },
    ],
  };
```

Update the knowledge base seed data (lines 86-123) — remove `unit`/`unitWeightGrams`, rename `pricePerUnit` → `pricePerGram`:
```typescript
    const ingredients = {
      'chicken breast': {
        name: 'chicken breast',
        pricePerGram: 0.011,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      rice: {
        name: 'rice',
        pricePerGram: 0.0025,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        fiberPer100g: 0.4,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      broccoli: {
        name: 'broccoli',
        pricePerGram: 0.003,
        proteinPer100g: 2.8,
        carbsPer100g: 7,
        fatPer100g: 0.4,
        fiberPer100g: 2.6,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
    };
```

**Step 2: Commit**

```bash
git add src/agent/agent.integration.test.ts
git commit -m "refactor: update agent integration test fixtures for grams-only"
```

---

### Task 8: Update AI prompts

**Files:**
- Modify: `src/ai/prompts.ts`
- Modify: `src/services/agent-planner.ts`

**Step 1: Update prompts.ts**

In `src/ai/prompts.ts`:

Update the meal object output format (line 70) — lock unit to 'g' and add ingredientId:
```typescript
  "ingredients": [{ "ingredientId": <id>, "name": "<name>", "amount": <grams>, "unit": "g" }],
```

Update the shopping list format (line 62) — lock unit to 'g':
```typescript
    { "name": "<ingredient>", "amount": <grams>, "unit": "g", "estimatedCost": <number> }
```

Update `formatPantryForPrompt` (line 86) — since unit is always 'g', the display `${item.quantity} ${item.unit}` still works correctly.

**Step 2: Update agent-planner.ts**

In `src/services/agent-planner.ts`:

Update the pantry formatting (line 103) — `${i.quantity} ${i.unit}` still works since unit is now 'g'. No change needed here.

The agent system prompt doesn't reference units for the `add_meal` tool since that tool uses `amountGrams` already. No prompt changes needed in agent-planner.ts.

**Step 3: Commit**

```bash
git add src/ai/prompts.ts src/services/agent-planner.ts
git commit -m "refactor: update AI prompts to use grams-only ingredient format"
```

---

### Task 9: Update build scripts

**Files:**
- Modify: `scripts/build-ingredient-db.ts`
- Modify: `scripts/embed-ingredients.ts`

**Step 1: Update build-ingredient-db.ts**

In `scripts/build-ingredient-db.ts`, update the ingredient transformation (lines 129-142):

```typescript
  const ingredients = foods.map((food) => {
    const category = getCategory(food);
    return {
      name: food.description,
      usdaFdcId: food.fdcId,
      proteinPer100g: getNutrient(food, NUTRIENT_IDS.PROTEIN),
      carbsPer100g: getNutrient(food, NUTRIENT_IDS.CARBS),
      fatPer100g: getNutrient(food, NUTRIENT_IDS.FAT),
      fiberPer100g: getNutrient(food, NUTRIENT_IDS.FIBER),
      category,
      pricePerGram: CATEGORY_PRICES[category] / 1000,
    };
  });
```

**Step 2: Update embed-ingredients.ts**

In `scripts/embed-ingredients.ts`, update the `USDAIngredient` interface (lines 7-18):

```typescript
interface USDAIngredient {
  name: string;
  usdaFdcId: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  category: string;
  pricePerGram: number;
}
```

Update the `addIngredient` call (lines 54-65):
```typescript
      await db.addIngredient({
        name: ing.name,
        proteinPer100g: ing.proteinPer100g,
        carbsPer100g: ing.carbsPer100g,
        fatPer100g: ing.fatPer100g,
        fiberPer100g: ing.fiberPer100g,
        pricePerGram: ing.pricePerGram,
        category: ing.category as IngredientCategory,
        usdaFdcId: ing.usdaFdcId,
      });
```

**Step 3: Commit**

```bash
git add scripts/build-ingredient-db.ts scripts/embed-ingredients.ts
git commit -m "refactor: update build scripts to use pricePerGram"
```

---

### Task 10: Run full test suite and fix any remaining issues

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors. If there are errors, fix them based on the error messages — they will be about missing `unit`/`unitWeightGrams`/`pricePerUnit` fields or the new `ingredientId`/`pricePerGram` fields.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. If any fail, investigate and fix.

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve remaining type and test issues for grams-only refactor"
```
