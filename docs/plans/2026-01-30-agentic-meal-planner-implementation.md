# Agentic Meal Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the meal planner from single-shot LLM to an agentic tool-use system that builds weekly plans meal-by-meal with programmatic nutrition calculation.

**Architecture:** Agent loop using Claude Haiku with tools. Agent proposes meals, TypeScript calculates nutrition from verified ingredient data. Knowledge base grows over time with USDA data and AI estimates.

**Tech Stack:** TypeScript, Zod schemas, Anthropic SDK (tool-use), USDA FoodData Central API

---

## Task 1: MacroCalculator - Pure Functions

**Files:**
- Create: `src/services/macro-calculator.ts`
- Create: `src/services/macro-calculator.test.ts`

**Step 1: Write the failing test for calorie calculation**

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
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/macro-calculator.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/services/macro-calculator.ts
import type { Macros } from '../schemas/plan.js';

export interface IngredientWithNutrition {
  name: string;
  amountGrams: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerUnit: number;
  unit: string;
  unitWeightGrams: number; // e.g., 1 "each" egg = 50g
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/macro-calculator.test.ts`
Expected: PASS

**Step 5: Add test for meal nutrition calculation**

```typescript
// Add to src/services/macro-calculator.test.ts
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
          pricePerUnit: 10,
          unit: 'kg',
          unitWeightGrams: 1000,
        },
        {
          name: 'rice',
          amountGrams: 150,
          proteinPer100g: 2.7,
          carbsPer100g: 28,
          fatPer100g: 0.3,
          fiberPer100g: 0.4,
          pricePerUnit: 2,
          unit: 'kg',
          unitWeightGrams: 1000,
        },
      ];

      const result = calculateMealNutrition(ingredients);

      // Calories calculated from macros (not caloriesPer100g):
      // Chicken 200g: 62g protein (248cal) + 7.2g fat (64.8cal) = 312.8 cal
      // Rice 150g: 4.05g protein (16.2cal) + 42g carbs (168cal) + 0.45g fat (4.05cal) = 188.25 cal
      // Total: 501.05 -> 501 cal (rounded)
      expect(result.calories).toBe(501);
      expect(result.macros.protein).toBeCloseTo(66.05, 1);
      expect(result.macros.carbs).toBeCloseTo(42, 1);
      expect(result.macros.fat).toBeCloseTo(7.65, 1);
      expect(result.macros.fiber).toBeCloseTo(0.6, 1);
      // Cost: chicken 200g/1000g * $10 = $2, rice 150g/1000g * $2 = $0.30
      expect(result.estimatedCost).toBeCloseTo(2.3, 2);
    });

    it('handles empty ingredient list', () => {
      const result = calculateMealNutrition([]);
      expect(result.calories).toBe(0);
      expect(result.macros.protein).toBe(0);
      expect(result.estimatedCost).toBe(0);
    });
  });
```

**Step 6: Run test to verify it fails**

Run: `npm run test:run -- src/services/macro-calculator.test.ts`
Expected: FAIL

**Step 7: Implement calculateMealNutrition**

```typescript
// Add to src/services/macro-calculator.ts
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

    // Cost calculation: amountGrams / unitWeightGrams * pricePerUnit
    totalCost += (ing.amountGrams / ing.unitWeightGrams) * ing.pricePerUnit;
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

**Step 8: Run test to verify it passes**

Run: `npm run test:run -- src/services/macro-calculator.test.ts`
Expected: PASS

**Step 9: Export from services index**

```typescript
// Add to src/services/index.ts
export * from './macro-calculator.js';
```

**Step 10: Commit**

```bash
git add src/services/macro-calculator.ts src/services/macro-calculator.test.ts src/services/index.ts
git commit -m "feat: add MacroCalculator with pure nutrition math functions"
```

---

## Task 2: Update IngredientEntry Schema

**Files:**
- Modify: `src/schemas/knowledge.ts`
- Modify: `src/schemas/knowledge.test.ts`

**Step 1: Write failing test for updated schema**

```typescript
// Add to src/schemas/knowledge.test.ts
describe('IngredientEntrySchema with confidence', () => {
  it('validates ingredient with usda confidence', () => {
    const ingredient = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
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
      pricePerUnit: 8,
      unit: 'kg',
      unitWeightGrams: 1000,
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
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/schemas/knowledge.test.ts`
Expected: FAIL (missing name, confidence, unitWeightGrams fields)

**Step 3: Update schema**

```typescript
// src/schemas/knowledge.ts - replace IngredientEntrySchema
// Note: No caloriesPer100g - calories are always computed from macros
export const IngredientEntrySchema = z.object({
  name: z.string(),
  pricePerUnit: z.number().nonnegative(),
  unit: z.string(),
  unitWeightGrams: z.number().positive(), // weight in grams per unit (e.g., 1 kg = 1000g)
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative(),
  confidence: z.enum(['usda', 'ai-estimate', 'manual']),
  usdaFdcId: z.number().optional(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/schemas/knowledge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/knowledge.ts src/schemas/knowledge.test.ts
git commit -m "feat: update IngredientEntrySchema with confidence tracking"
```

---

## Task 3: KnowledgeBase Service

**Files:**
- Create: `src/services/knowledge-base.ts`
- Create: `src/services/knowledge-base.test.ts`

**Step 1: Write failing test for KnowledgeBase**

```typescript
// src/services/knowledge-base.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { KnowledgeBase } from './knowledge-base.js';

describe('KnowledgeBase', () => {
  const testDir = join(process.cwd(), 'test-data-kb');
  let kb: KnowledgeBase;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    kb = new KnowledgeBase(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  it('returns null for unknown ingredient', async () => {
    const result = await kb.getIngredient('unknown-food');
    expect(result).toBeNull();
  });

  it('saves and retrieves ingredient', async () => {
    const ingredient = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      usdaFdcId: 171477,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', ingredient);
    const result = await kb.getIngredient('chicken breast');

    expect(result).toEqual(ingredient);
  });

  it('searches ingredients by partial name', async () => {
    const chicken = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };
    const rice = {
      name: 'white rice',
      pricePerUnit: 2,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', chicken);
    await kb.saveIngredient('white rice', rice);

    const results = await kb.searchIngredients('chick');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('chicken breast');
  });

  it('lists all ingredients', async () => {
    const chicken = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', chicken);
    const all = await kb.getAllIngredients();

    expect(all).toHaveLength(1);
    expect(all[0]).toBe('chicken breast');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/knowledge-base.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement KnowledgeBase**

```typescript
// src/services/knowledge-base.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  IngredientsKnowledgeSchema,
  type IngredientEntry,
} from '../schemas/knowledge.js';

export class KnowledgeBase {
  private dataDir: string;
  private ingredientsPath: string;
  private cache: Map<string, IngredientEntry> | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ingredientsPath = join(dataDir, 'knowledge', 'ingredients.json');
  }

  private async ensureDir(): Promise<void> {
    const knowledgeDir = join(this.dataDir, 'knowledge');
    if (!existsSync(knowledgeDir)) {
      await mkdir(knowledgeDir, { recursive: true });
    }
  }

  private async load(): Promise<Map<string, IngredientEntry>> {
    if (this.cache) return this.cache;

    await this.ensureDir();

    if (!existsSync(this.ingredientsPath)) {
      this.cache = new Map();
      return this.cache;
    }

    const content = await readFile(this.ingredientsPath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    const validated = IngredientsKnowledgeSchema.parse(data);
    this.cache = new Map(Object.entries(validated));
    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    await this.ensureDir();
    const obj = Object.fromEntries(this.cache);
    await writeFile(this.ingredientsPath, JSON.stringify(obj, null, 2));
  }

  async getIngredient(name: string): Promise<IngredientEntry | null> {
    const data = await this.load();
    return data.get(name.toLowerCase()) ?? null;
  }

  async saveIngredient(name: string, entry: IngredientEntry): Promise<void> {
    const data = await this.load();
    data.set(name.toLowerCase(), entry);
    await this.save();
  }

  async searchIngredients(query: string): Promise<IngredientEntry[]> {
    const data = await this.load();
    const lowerQuery = query.toLowerCase();
    const results: IngredientEntry[] = [];

    for (const [key, entry] of data) {
      if (key.includes(lowerQuery) || entry.name.toLowerCase().includes(lowerQuery)) {
        results.push(entry);
      }
    }

    return results;
  }

  async getAllIngredients(): Promise<string[]> {
    const data = await this.load();
    return Array.from(data.keys());
  }

  clearCache(): void {
    this.cache = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/knowledge-base.test.ts`
Expected: PASS

**Step 5: Export from services index**

```typescript
// Add to src/services/index.ts
export * from './knowledge-base.js';
```

**Step 6: Commit**

```bash
git add src/services/knowledge-base.ts src/services/knowledge-base.test.ts src/services/index.ts
git commit -m "feat: add KnowledgeBase service for ingredient data persistence"
```

---

## Task 4: USDA Client

**Files:**
- Create: `src/services/usda-client.ts`
- Create: `src/services/usda-client.test.ts`

**Step 1: Write failing test for USDA client**

```typescript
// src/services/usda-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { USDAClient, type USDANutrients } from './usda-client.js';

describe('USDAClient', () => {
  describe('parseNutrients', () => {
    it('extracts macros from USDA food nutrients array', () => {
      const foodNutrients = [
        { nutrientId: 1003, value: 31 },  // Protein
        { nutrientId: 1005, value: 0 },   // Carbs
        { nutrientId: 1004, value: 3.6 }, // Fat
        { nutrientId: 1079, value: 0 },   // Fiber
      ];

      const result = USDAClient.parseNutrients(foodNutrients);

      // Note: No caloriesPer100g - calories are computed from macros
      expect(result.proteinPer100g).toBe(31);
      expect(result.carbsPer100g).toBe(0);
      expect(result.fatPer100g).toBe(3.6);
      expect(result.fiberPer100g).toBe(0);
    });

    it('defaults missing nutrients to 0', () => {
      const foodNutrients = [
        { nutrientId: 1003, value: 25 }, // Only protein
      ];

      const result = USDAClient.parseNutrients(foodNutrients);

      expect(result.proteinPer100g).toBe(25);
      expect(result.carbsPer100g).toBe(0);
      expect(result.fatPer100g).toBe(0);
      expect(result.fiberPer100g).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/usda-client.test.ts`
Expected: FAIL

**Step 3: Implement USDA client**

```typescript
// src/services/usda-client.ts
// Note: No caloriesPer100g - calories are always computed from macros
export interface USDANutrients {
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
}

export interface USDASearchResult {
  fdcId: number;
  description: string;
  nutrients: USDANutrients;
}

interface USDAFoodNutrient {
  nutrientId: number;
  value: number;
}

interface USDASearchResponse {
  foods: Array<{
    fdcId: number;
    description: string;
    foodNutrients: USDAFoodNutrient[];
  }>;
}

// USDA nutrient IDs (we skip ENERGY since we compute calories from macros)
const NUTRIENT_IDS = {
  PROTEIN: 1003,   // Protein
  CARBS: 1005,     // Carbohydrate, by difference
  FAT: 1004,       // Total lipid (fat)
  FIBER: 1079,     // Fiber, total dietary
};

export class USDAClient {
  private apiKey: string;
  private baseUrl = 'https://api.nal.usda.gov/fdc/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static parseNutrients(foodNutrients: USDAFoodNutrient[]): USDANutrients {
    const getValue = (nutrientId: number): number => {
      const nutrient = foodNutrients.find((n) => n.nutrientId === nutrientId);
      return nutrient?.value ?? 0;
    };

    return {
      proteinPer100g: getValue(NUTRIENT_IDS.PROTEIN),
      carbsPer100g: getValue(NUTRIENT_IDS.CARBS),
      fatPer100g: getValue(NUTRIENT_IDS.FAT),
      fiberPer100g: getValue(NUTRIENT_IDS.FIBER),
    };
  }

  async searchFood(query: string): Promise<USDASearchResult[]> {
    const url = new URL(`${this.baseUrl}/foods/search`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('dataType', 'Foundation,SR Legacy');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as USDASearchResponse;

    return data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      nutrients: USDAClient.parseNutrients(food.foodNutrients),
    }));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/usda-client.test.ts`
Expected: PASS

**Step 5: Export from services index**

```typescript
// Add to src/services/index.ts
export * from './usda-client.js';
```

**Step 6: Commit**

```bash
git add src/services/usda-client.ts src/services/usda-client.test.ts src/services/index.ts
git commit -m "feat: add USDAClient for FoodData Central API integration"
```

---

## Task 5: PlanState In-Memory State Management

**Files:**
- Create: `src/services/plan-state.ts`
- Create: `src/services/plan-state.test.ts`

**Step 1: Write failing test for PlanState**

```typescript
// src/services/plan-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanState } from './plan-state.js';
import type { Profile, Pantry } from '../schemas/index.js';
import type { Meal } from '../schemas/plan.js';

describe('PlanState', () => {
  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: [],
      maxPrepTime: {
        monday: 30, tuesday: 30, wednesday: 30,
        thursday: 30, friday: 30, saturday: 60, sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: { size: 2 },
  };

  const mockPantry: Pantry = { items: [] };

  let state: PlanState;

  beforeEach(() => {
    state = new PlanState('2026-W05', mockProfile, mockPantry);
  });

  it('initializes with empty days', () => {
    const summary = state.getSummary();
    expect(summary.mealsPlanned).toBe(0);
    expect(summary.weeklyTotals.calories).toBe(0);
  });

  it('adds a meal to a day/slot', () => {
    const meal: Meal = {
      name: 'Grilled Chicken Salad',
      recipe: 'Grill chicken, toss with greens',
      ingredients: [
        { name: 'chicken breast', amount: 200, unit: 'g' },
        { name: 'mixed greens', amount: 100, unit: 'g' },
      ],
      prepTime: 20,
      calories: 350,
      macros: { protein: 45, carbs: 10, fat: 15, fiber: 3 },
      estimatedCost: 5.5,
      servings: 1,
      leftoverOf: null,
    };

    state.addMeal('2026-02-02', 'lunch', meal);
    const summary = state.getSummary();

    expect(summary.mealsPlanned).toBe(1);
    expect(summary.weeklyTotals.calories).toBe(350);
    expect(summary.weeklyTotals.macros.protein).toBe(45);
  });

  it('modifies an existing meal', () => {
    const meal1: Meal = {
      name: 'Heavy Pasta',
      recipe: 'Cook pasta',
      ingredients: [],
      prepTime: 20,
      calories: 800,
      macros: { protein: 20, carbs: 120, fat: 25, fiber: 5 },
      estimatedCost: 4,
      servings: 1,
      leftoverOf: null,
    };

    const meal2: Meal = {
      name: 'Light Salad',
      recipe: 'Toss salad',
      ingredients: [],
      prepTime: 10,
      calories: 200,
      macros: { protein: 10, carbs: 15, fat: 10, fiber: 8 },
      estimatedCost: 3,
      servings: 1,
      leftoverOf: null,
    };

    state.addMeal('2026-02-02', 'dinner', meal1);
    state.modifyMeal('2026-02-02', 'dinner', meal2);

    const summary = state.getSummary();
    expect(summary.weeklyTotals.calories).toBe(200);
    expect(summary.weeklyTotals.macros.carbs).toBe(15);
  });

  it('calculates remaining budget', () => {
    const meal: Meal = {
      name: 'Test Meal',
      recipe: 'Test',
      ingredients: [],
      prepTime: 10,
      calories: 500,
      macros: { protein: 30, carbs: 50, fat: 20, fiber: 5 },
      estimatedCost: 10,
      servings: 1,
      leftoverOf: null,
    };

    state.addMeal('2026-02-02', 'breakfast', meal);
    const remaining = state.getRemainingBudget();

    // Weekly targets: 1800-2200 cal/day * 7 = 12600-15400 cal
    // After 500 cal: 12100-14900 remaining
    expect(remaining.calories.min).toBe(12600 - 500);
    expect(remaining.cost).toBe(150 - 10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: FAIL

**Step 3: Implement PlanState**

```typescript
// src/services/plan-state.ts
import type { Profile, Pantry } from '../schemas/index.js';
import type { Meal, DayPlan, WeeklyPlan } from '../schemas/plan.js';

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

interface DayMeals {
  breakfast: Meal | null;
  lunch: Meal | null;
  dinner: Meal | null;
}

interface PlanSummary {
  mealsPlanned: number;
  weeklyTotals: {
    calories: number;
    macros: { protein: number; carbs: number; fat: number; fiber: number };
    estimatedCost: number;
  };
  dayTotals: Map<string, {
    calories: number;
    macros: { protein: number; carbs: number; fat: number; fiber: number };
    estimatedCost: number;
  }>;
}

interface RemainingBudget {
  calories: { min: number; max: number };
  macros: {
    protein: { min: number; max: number };
    carbs: { min: number; max: number };
    fat: { min: number; max: number };
    fiber: { min: number; max: number };
  };
  cost: number;
}

export class PlanState {
  private week: string;
  private profile: Profile;
  private pantry: Pantry;
  private days: Map<string, DayMeals> = new Map();

  constructor(week: string, profile: Profile, pantry: Pantry) {
    this.week = week;
    this.profile = profile;
    this.pantry = pantry;
  }

  addMeal(date: string, slot: MealSlot, meal: Meal): void {
    if (!this.days.has(date)) {
      this.days.set(date, { breakfast: null, lunch: null, dinner: null });
    }
    const day = this.days.get(date)!;
    day[slot] = meal;
  }

  modifyMeal(date: string, slot: MealSlot, meal: Meal): void {
    this.addMeal(date, slot, meal);
  }

  removeMeal(date: string, slot: MealSlot): void {
    const day = this.days.get(date);
    if (day) {
      day[slot] = null;
    }
  }

  getMeal(date: string, slot: MealSlot): Meal | null {
    return this.days.get(date)?.[slot] ?? null;
  }

  getSummary(): PlanSummary {
    let mealsPlanned = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalCost = 0;

    const dayTotals = new Map<string, {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    }>();

    for (const [date, day] of this.days) {
      let dayCal = 0, dayPro = 0, dayCar = 0, dayFat = 0, dayFib = 0, dayCost = 0;

      for (const meal of [day.breakfast, day.lunch, day.dinner]) {
        if (meal) {
          mealsPlanned++;
          dayCal += meal.calories;
          dayPro += meal.macros.protein;
          dayCar += meal.macros.carbs;
          dayFat += meal.macros.fat;
          dayFib += meal.macros.fiber;
          dayCost += meal.estimatedCost;
        }
      }

      dayTotals.set(date, {
        calories: dayCal,
        macros: { protein: dayPro, carbs: dayCar, fat: dayFat, fiber: dayFib },
        estimatedCost: dayCost,
      });

      totalCalories += dayCal;
      totalProtein += dayPro;
      totalCarbs += dayCar;
      totalFat += dayFat;
      totalFiber += dayFib;
      totalCost += dayCost;
    }

    return {
      mealsPlanned,
      weeklyTotals: {
        calories: totalCalories,
        macros: { protein: totalProtein, carbs: totalCarbs, fat: totalFat, fiber: totalFiber },
        estimatedCost: totalCost,
      },
      dayTotals,
    };
  }

  getRemainingBudget(): RemainingBudget {
    const summary = this.getSummary();
    const { goals } = this.profile;

    // Weekly targets = daily targets * 7
    const weeklyCalMin = goals.dailyCalories.min * 7;
    const weeklyCalMax = goals.dailyCalories.max * 7;

    return {
      calories: {
        min: weeklyCalMin - summary.weeklyTotals.calories,
        max: weeklyCalMax - summary.weeklyTotals.calories,
      },
      macros: {
        protein: {
          min: goals.macros.protein.min * 7 - summary.weeklyTotals.macros.protein,
          max: goals.macros.protein.max * 7 - summary.weeklyTotals.macros.protein,
        },
        carbs: {
          min: goals.macros.carbs.min * 7 - summary.weeklyTotals.macros.carbs,
          max: goals.macros.carbs.max * 7 - summary.weeklyTotals.macros.carbs,
        },
        fat: {
          min: goals.macros.fat.min * 7 - summary.weeklyTotals.macros.fat,
          max: goals.macros.fat.max * 7 - summary.weeklyTotals.macros.fat,
        },
        fiber: {
          min: goals.macros.fiber.min * 7 - summary.weeklyTotals.macros.fiber,
          max: goals.macros.fiber.max * 7 - summary.weeklyTotals.macros.fiber,
        },
      },
      cost: goals.weeklyBudget - summary.weeklyTotals.estimatedCost,
    };
  }

  getProfile(): Profile {
    return this.profile;
  }

  getPantry(): Pantry {
    return this.pantry;
  }

  getWeek(): string {
    return this.week;
  }

  toWeeklyPlan(): WeeklyPlan {
    const summary = this.getSummary();
    const days: DayPlan[] = [];

    for (const [date, dayMeals] of this.days) {
      days.push({
        date,
        meals: {
          breakfast: dayMeals.breakfast,
          lunch: dayMeals.lunch,
          dinner: dayMeals.dinner,
        },
      });
    }

    // Sort by date
    days.sort((a, b) => a.date.localeCompare(b.date));

    return {
      week: this.week,
      generatedAt: new Date().toISOString(),
      days,
      totals: {
        calories: summary.weeklyTotals.calories,
        macros: summary.weeklyTotals.macros,
        estimatedCost: summary.weeklyTotals.estimatedCost,
      },
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/plan-state.test.ts`
Expected: PASS

**Step 5: Export from services index**

```typescript
// Add to src/services/index.ts
export * from './plan-state.js';
```

**Step 6: Commit**

```bash
git add src/services/plan-state.ts src/services/plan-state.test.ts src/services/index.ts
git commit -m "feat: add PlanState for in-memory meal plan state management"
```

---

## Task 6: Tool Definitions and Types

**Files:**
- Create: `src/agent/tools.ts`
- Create: `src/agent/types.ts`

**Step 1: Create types file**

```typescript
// src/agent/types.ts
import type { Meal } from '../schemas/plan.js';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AddMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: Array<{
    name: string;
    amountGrams: number;
  }>;
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export interface ModifyMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: Array<{
    name: string;
    amountGrams: number;
  }>;
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export interface RemoveMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
}

export interface LookupIngredientInput {
  name: string;
}

export interface SearchKnowledgeBaseInput {
  query: string;
}

export interface CheckDailyTotalsInput {
  date: string;
}

export interface FinalizePlanInput {
  notes?: string;
}

export type ToolInput =
  | { tool: 'get_plan_state' }
  | { tool: 'add_meal'; input: AddMealInput }
  | { tool: 'modify_meal'; input: ModifyMealInput }
  | { tool: 'remove_meal'; input: RemoveMealInput }
  | { tool: 'lookup_ingredient'; input: LookupIngredientInput }
  | { tool: 'search_knowledge_base'; input: SearchKnowledgeBaseInput }
  | { tool: 'get_known_ingredients' }
  | { tool: 'check_daily_totals'; input: CheckDailyTotalsInput }
  | { tool: 'check_weekly_totals' }
  | { tool: 'finalize_plan'; input: FinalizePlanInput };
```

**Step 2: Create tool definitions**

```typescript
// src/agent/tools.ts
import type { ToolDefinition } from './types.js';

export const PLANNING_TOOLS: ToolDefinition[] = [
  {
    name: 'get_plan_state',
    description: 'Get the current plan state including meals planned so far, daily totals, weekly totals, and remaining budget. Call this to see what has been planned and what targets remain.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_meal',
    description: 'Add a meal to a specific day and slot (breakfast/lunch/dinner). Provide the meal details and ingredients with amounts in grams. The system will calculate nutrition from the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        name: { type: 'string', description: 'Name of the meal' },
        recipe: { type: 'string', description: 'Brief cooking instructions' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amountGrams: { type: 'number', description: 'Amount in grams' },
            },
            required: ['name', 'amountGrams'],
          },
        },
        prepTime: { type: 'number', description: 'Preparation time in minutes' },
        servings: { type: 'number', description: 'Number of servings' },
        leftoverOf: { type: 'string', description: 'If this uses leftovers, name of original meal' },
      },
      required: ['date', 'slot', 'name', 'recipe', 'ingredients', 'prepTime', 'servings'],
    },
  },
  {
    name: 'modify_meal',
    description: 'Replace an existing meal with a new one. Use this to backtrack and adjust earlier meals if targets are off-track.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        name: { type: 'string', description: 'Name of the meal' },
        recipe: { type: 'string', description: 'Brief cooking instructions' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amountGrams: { type: 'number', description: 'Amount in grams' },
            },
            required: ['name', 'amountGrams'],
          },
        },
        prepTime: { type: 'number', description: 'Preparation time in minutes' },
        servings: { type: 'number', description: 'Number of servings' },
        leftoverOf: { type: 'string', description: 'If this uses leftovers, name of original meal' },
      },
      required: ['date', 'slot', 'name', 'recipe', 'ingredients', 'prepTime', 'servings'],
    },
  },
  {
    name: 'remove_meal',
    description: 'Remove a meal from a slot (e.g., if user skips breakfast).',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
      },
      required: ['date', 'slot'],
    },
  },
  {
    name: 'lookup_ingredient',
    description: 'Look up nutrition data for an ingredient. Returns calories, protein, carbs, fat, fiber per 100g and price. Data comes from knowledge base, USDA, or AI estimate.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Ingredient name to look up' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_knowledge_base',
    description: 'Search for ingredients in the knowledge base by partial name match.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_known_ingredients',
    description: 'List all ingredients currently in the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_daily_totals',
    description: 'Get nutrition totals for a specific day and compare against daily targets.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'check_weekly_totals',
    description: 'Get nutrition totals for the entire week so far and remaining budget.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'finalize_plan',
    description: 'Signal that planning is complete. Call this when all meals are planned or when you cannot meet constraints.',
    input_schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Any notes or warnings about the plan' },
      },
    },
  },
];
```

**Step 3: Create index file**

```typescript
// src/agent/index.ts
export * from './tools.js';
export * from './types.js';
```

**Step 4: Commit**

```bash
git add src/agent/tools.ts src/agent/types.ts src/agent/index.ts
git commit -m "feat: add agent tool definitions and types"
```

---

## Task 7: AIClient runAgentLoop Method

**Files:**
- Modify: `src/ai/client.ts`
- Create: `src/ai/client.agent.test.ts`

**Step 1: Write failing test for agent loop**

```typescript
// src/ai/client.agent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient } from './client.js';
import type { ToolDefinition } from '../agent/types.js';

// We'll test the loop logic by mocking the Anthropic client
describe('AIClient.runAgentLoop', () => {
  it('executes tool calls and returns final result', async () => {
    const client = new AIClient('test-key');

    // Mock the internal client
    const mockCreate = vi.fn();
    (client as unknown as { client: { messages: { create: typeof mockCreate } } }).client = {
      messages: { create: mockCreate },
    };

    // First call: Claude wants to use a tool
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'get_data',
          input: { key: 'test' },
        },
      ],
      stop_reason: 'tool_use',
    });

    // Second call: Claude responds with final answer
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Done!',
        },
      ],
      stop_reason: 'end_turn',
    });

    const tools: ToolDefinition[] = [
      {
        name: 'get_data',
        description: 'Get some data',
        input_schema: { type: 'object', properties: { key: { type: 'string' } } },
      },
    ];

    const toolHandler = vi.fn().mockResolvedValue({ data: 'test-value' });

    const result = await client.runAgentLoop({
      systemPrompt: 'You are a test agent',
      initialMessage: 'Get the data',
      tools,
      toolHandler,
    });

    expect(toolHandler).toHaveBeenCalledWith('get_data', { key: 'test' });
    expect(result.finalText).toBe('Done!');
    expect(result.toolCalls).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/ai/client.agent.test.ts`
Expected: FAIL (runAgentLoop doesn't exist)

**Step 3: Add runAgentLoop to AIClient**

```typescript
// Add to src/ai/client.ts

import type { ToolDefinition } from '../agent/types.js';

export interface AgentLoopOptions {
  systemPrompt: string;
  initialMessage: string;
  tools: ToolDefinition[];
  toolHandler: (name: string, input: unknown) => Promise<unknown>;
  maxIterations?: number;
  model?: string;
}

export interface AgentResult {
  finalText: string;
  toolCalls: number;
  iterations: number;
}

// Add this method to AIClient class:

  async runAgentLoop(options: AgentLoopOptions): Promise<AgentResult> {
    const {
      systemPrompt,
      initialMessage,
      tools,
      toolHandler,
      maxIterations = 100,
      model = 'claude-haiku-3-5-20241022',
    } = options;

    type MessageContent =
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: unknown }
      | { type: 'tool_result'; tool_use_id: string; content: string };

    const messages: Array<{ role: 'user' | 'assistant'; content: MessageContent[] }> = [
      { role: 'user', content: [{ type: 'text', text: initialMessage }] },
    ];

    let iterations = 0;
    let toolCalls = 0;
    let finalText = '';

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages: messages as Anthropic.MessageParam[],
      });

      // Collect assistant response
      const assistantContent: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText = block.text;
          assistantContent.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          assistantContent.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      messages.push({ role: 'assistant', content: assistantContent });

      // If no tool use, we're done
      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Execute tool calls
      const toolResults: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCalls++;
          const result = await toolHandler(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return { finalText, toolCalls, iterations };
  }
```

**Step 4: Add import at top of file**

```typescript
// At top of src/ai/client.ts, add:
import type { ToolDefinition } from '../agent/types.js';
```

**Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/ai/client.agent.test.ts`
Expected: PASS

**Step 6: Export new types from ai/index.ts**

```typescript
// Add to src/ai/index.ts
export type { AgentLoopOptions, AgentResult } from './client.js';
```

**Step 7: Commit**

```bash
git add src/ai/client.ts src/ai/client.agent.test.ts src/ai/index.ts
git commit -m "feat: add runAgentLoop method to AIClient for tool-use conversations"
```

---

## Task 8: Tool Handlers Implementation

**Files:**
- Create: `src/agent/tool-handlers.ts`
- Create: `src/agent/tool-handlers.test.ts`

**Step 1: Write failing test for tool handlers**

```typescript
// src/agent/tool-handlers.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolHandlers } from './tool-handlers.js';
import { PlanState } from '../services/plan-state.js';
import { KnowledgeBase } from '../services/knowledge-base.js';
import type { Profile, Pantry } from '../schemas/index.js';

describe('ToolHandlers', () => {
  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: [],
      maxPrepTime: {
        monday: 30, tuesday: 30, wednesday: 30,
        thursday: 30, friday: 30, saturday: 60, sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: { size: 2 },
  };

  const mockPantry: Pantry = { items: [] };

  let planState: PlanState;
  let kb: KnowledgeBase;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    planState = new PlanState('2026-W05', mockProfile, mockPantry);
    kb = {
      getIngredient: vi.fn(),
      saveIngredient: vi.fn(),
      searchIngredients: vi.fn(),
      getAllIngredients: vi.fn(),
    } as unknown as KnowledgeBase;
    handlers = createToolHandlers(planState, kb, null, null);
  });

  describe('get_plan_state', () => {
    it('returns current plan summary', async () => {
      const result = await handlers.handle('get_plan_state', {});
      expect(result).toHaveProperty('mealsPlanned', 0);
      expect(result).toHaveProperty('weeklyTotals');
      expect(result).toHaveProperty('remainingBudget');
    });
  });

  describe('lookup_ingredient', () => {
    it('returns ingredient from knowledge base if found', async () => {
      const ingredient = {
        name: 'chicken breast',
        pricePerUnit: 10,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'usda' as const,
        lastUpdated: '2026-01-30',
      };
      (kb.getIngredient as ReturnType<typeof vi.fn>).mockResolvedValue(ingredient);

      const result = await handlers.handle('lookup_ingredient', { name: 'chicken breast' });

      expect(result).toEqual({
        found: true,
        source: 'knowledge_base',
        ingredient,
      });
    });

    it('returns not found if ingredient missing and no USDA client', async () => {
      (kb.getIngredient as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await handlers.handle('lookup_ingredient', { name: 'unknown food' });

      expect(result).toEqual({
        found: false,
        message: 'Ingredient not found. No USDA API configured.',
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: FAIL

**Step 3: Implement tool handlers**

```typescript
// src/agent/tool-handlers.ts
import { PlanState } from '../services/plan-state.js';
import { KnowledgeBase } from '../services/knowledge-base.js';
import { USDAClient } from '../services/usda-client.js';
import { AIClient } from '../ai/client.js';
import {
  calculateMealNutrition,
  type IngredientWithNutrition,
} from '../services/macro-calculator.js';
import type {
  AddMealInput,
  ModifyMealInput,
  RemoveMealInput,
  LookupIngredientInput,
  SearchKnowledgeBaseInput,
  CheckDailyTotalsInput,
  FinalizePlanInput,
} from './types.js';
import type { Meal } from '../schemas/plan.js';

export function createToolHandlers(
  planState: PlanState,
  kb: KnowledgeBase,
  usdaClient: USDAClient | null,
  aiClient: AIClient | null
) {
  async function handleGetPlanState() {
    const summary = planState.getSummary();
    const remaining = planState.getRemainingBudget();
    return {
      week: planState.getWeek(),
      mealsPlanned: summary.mealsPlanned,
      weeklyTotals: summary.weeklyTotals,
      remainingBudget: remaining,
    };
  }

  async function handleAddMeal(input: AddMealInput) {
    // Look up all ingredients
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ing of input.ingredients) {
      const entry = await kb.getIngredient(ing.name);
      if (!entry) {
        return {
          success: false,
          error: `Ingredient "${ing.name}" not found in knowledge base. Use lookup_ingredient first.`,
        };
      }
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerUnit: entry.pricePerUnit,
        unit: entry.unit,
        unitWeightGrams: entry.unitWeightGrams,
      });
    }

    // Calculate nutrition
    const nutrition = calculateMealNutrition(ingredientsWithNutrition);

    const meal: Meal = {
      name: input.name,
      recipe: input.recipe,
      ingredients: input.ingredients.map((i) => ({
        name: i.name,
        amount: i.amountGrams,
        unit: 'g',
      })),
      prepTime: input.prepTime,
      calories: nutrition.calories,
      macros: nutrition.macros,
      estimatedCost: nutrition.estimatedCost,
      servings: input.servings,
      leftoverOf: input.leftoverOf ?? null,
    };

    planState.addMeal(input.date, input.slot, meal);

    const summary = planState.getSummary();
    const dayTotals = summary.dayTotals.get(input.date);

    return {
      success: true,
      meal: {
        name: meal.name,
        calories: meal.calories,
        macros: meal.macros,
        cost: meal.estimatedCost,
      },
      dayTotals,
      remainingBudget: planState.getRemainingBudget(),
    };
  }

  async function handleModifyMeal(input: ModifyMealInput) {
    return handleAddMeal(input);
  }

  async function handleRemoveMeal(input: RemoveMealInput) {
    planState.removeMeal(input.date, input.slot);
    return {
      success: true,
      remainingBudget: planState.getRemainingBudget(),
    };
  }

  async function handleLookupIngredient(input: LookupIngredientInput) {
    // Check KB first
    const existing = await kb.getIngredient(input.name);
    if (existing) {
      return {
        found: true,
        source: 'knowledge_base',
        ingredient: existing,
      };
    }

    // Try USDA
    if (usdaClient) {
      try {
        const results = await usdaClient.searchFood(input.name);
        if (results.length > 0) {
          const best = results[0];
          const entry = {
            name: input.name,
            pricePerUnit: 5, // Default estimate
            unit: 'kg',
            unitWeightGrams: 1000,
            ...best.nutrients,
            confidence: 'usda' as const,
            usdaFdcId: best.fdcId,
            lastUpdated: new Date().toISOString().split('T')[0],
          };
          await kb.saveIngredient(input.name, entry);
          return {
            found: true,
            source: 'usda',
            ingredient: entry,
          };
        }
      } catch {
        // Fall through to AI estimate
      }
    }

    // No USDA client or not found
    return {
      found: false,
      message: usdaClient
        ? 'Ingredient not found in USDA database.'
        : 'Ingredient not found. No USDA API configured.',
    };
  }

  async function handleSearchKnowledgeBase(input: SearchKnowledgeBaseInput) {
    const results = await kb.searchIngredients(input.query);
    return {
      results: results.map((r) => ({
        name: r.name,
        confidence: r.confidence,
        proteinPer100g: r.proteinPer100g,
      })),
    };
  }

  async function handleGetKnownIngredients() {
    const ingredients = await kb.getAllIngredients();
    return { ingredients };
  }

  async function handleCheckDailyTotals(input: CheckDailyTotalsInput) {
    const summary = planState.getSummary();
    const dayTotals = summary.dayTotals.get(input.date);
    const profile = planState.getProfile();

    return {
      date: input.date,
      totals: dayTotals ?? { calories: 0, macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 }, estimatedCost: 0 },
      targets: {
        calories: profile.goals.dailyCalories,
        macros: profile.goals.macros,
      },
    };
  }

  async function handleCheckWeeklyTotals() {
    const summary = planState.getSummary();
    const remaining = planState.getRemainingBudget();
    return {
      totals: summary.weeklyTotals,
      remainingBudget: remaining,
      mealsPlanned: summary.mealsPlanned,
    };
  }

  async function handleFinalizePlan(input: FinalizePlanInput) {
    const plan = planState.toWeeklyPlan();
    return {
      success: true,
      plan,
      notes: input.notes,
    };
  }

  return {
    handle: async (toolName: string, input: unknown): Promise<unknown> => {
      switch (toolName) {
        case 'get_plan_state':
          return handleGetPlanState();
        case 'add_meal':
          return handleAddMeal(input as AddMealInput);
        case 'modify_meal':
          return handleModifyMeal(input as ModifyMealInput);
        case 'remove_meal':
          return handleRemoveMeal(input as RemoveMealInput);
        case 'lookup_ingredient':
          return handleLookupIngredient(input as LookupIngredientInput);
        case 'search_knowledge_base':
          return handleSearchKnowledgeBase(input as SearchKnowledgeBaseInput);
        case 'get_known_ingredients':
          return handleGetKnownIngredients();
        case 'check_daily_totals':
          return handleCheckDailyTotals(input as CheckDailyTotalsInput);
        case 'check_weekly_totals':
          return handleCheckWeeklyTotals();
        case 'finalize_plan':
          return handleFinalizePlan(input as FinalizePlanInput);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 5: Export from agent/index.ts**

```typescript
// Add to src/agent/index.ts
export * from './tool-handlers.js';
```

**Step 6: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts src/agent/index.ts
git commit -m "feat: implement tool handlers for agent planning loop"
```

---

## Task 9: AgentPlanner Orchestration Service

**Files:**
- Create: `src/services/agent-planner.ts`
- Create: `src/services/agent-planner.test.ts`

**Step 1: Write failing test**

```typescript
// src/services/agent-planner.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentPlanner } from './agent-planner.js';
import type { Profile, Pantry } from '../schemas/index.js';

describe('AgentPlanner', () => {
  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: [],
      maxPrepTime: {
        monday: 30, tuesday: 30, wednesday: 30,
        thursday: 30, friday: 30, saturday: 60, sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: { size: 2 },
  };

  const mockPantry: Pantry = { items: [] };

  it('can be instantiated with API key and data directory', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: '/tmp/test',
    });
    expect(planner).toBeDefined();
  });

  it('builds system prompt with profile info', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: '/tmp/test',
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('1800');
    expect(prompt).toContain('2200');
    expect(prompt).toContain('150'); // budget
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: FAIL

**Step 3: Implement AgentPlanner**

```typescript
// src/services/agent-planner.ts
import { AIClient } from '../ai/client.js';
import { KnowledgeBase } from './knowledge-base.js';
import { PlanState } from './plan-state.js';
import { USDAClient } from './usda-client.js';
import { createToolHandlers } from '../agent/tool-handlers.js';
import { PLANNING_TOOLS } from '../agent/tools.js';
import type { Profile, Pantry } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';

export interface AgentPlannerOptions {
  anthropicApiKey: string;
  dataDir: string;
  usdaApiKey?: string;
}

export class AgentPlanner {
  private aiClient: AIClient;
  private kb: KnowledgeBase;
  private usdaClient: USDAClient | null;

  constructor(options: AgentPlannerOptions) {
    this.aiClient = new AIClient(options.anthropicApiKey);
    this.kb = new KnowledgeBase(options.dataDir);
    this.usdaClient = options.usdaApiKey
      ? new USDAClient(options.usdaApiKey)
      : null;
  }

  buildSystemPrompt(profile: Profile): string {
    const { goals, dietary, preferences, household } = profile;

    return `You are a meal planning agent. Your task is to create a complete 7-day meal plan by adding meals one at a time using the available tools.

## Targets
- Household size: ${household.size} people
- Daily calories: ${goals.dailyCalories.min}-${goals.dailyCalories.max} per person
- Weekly budget: $${goals.weeklyBudget}
- Protein: ${goals.macros.protein.min}-${goals.macros.protein.max}g/day
- Carbs: ${goals.macros.carbs.min}-${goals.macros.carbs.max}g/day
- Fat: ${goals.macros.fat.min}-${goals.macros.fat.max}g/day
- Fiber: ${goals.macros.fiber.min}-${goals.macros.fiber.max}g/day

## Dietary
- Restrictions: ${dietary.restrictions.length ? dietary.restrictions.join(', ') : 'none'}
- Dislikes: ${dietary.dislikes.length ? dietary.dislikes.join(', ') : 'none'}

## Preferences
- Cuisines: ${preferences.cuisines.length ? preferences.cuisines.join(', ') : 'any'}
- Complexity: ${preferences.complexityTolerance}

## Process
1. Use lookup_ingredient before adding meals to ensure ingredients are in the knowledge base
2. Add meals one at a time with add_meal
3. Check remaining budget after each meal
4. If off-track, use modify_meal to adjust earlier meals
5. Call finalize_plan when complete

Be efficient with tokens. Don't explain your reasoning, just call tools.`;
  }

  buildInitialMessage(profile: Profile, pantry: Pantry, week: string): string {
    const dates = this.getWeekDates(week);
    const pantryItems = pantry.items.length
      ? pantry.items.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n')
      : 'Empty';

    return `Create a meal plan for week ${week} (${dates[0]} to ${dates[6]}).

Pantry:
${pantryItems}

Start by checking get_plan_state, then add meals day by day. Use lookup_ingredient for any ingredient before using it.`;
  }

  private getWeekDates(week: string): string[] {
    // Parse week string like "2026-W05"
    const [year, weekNum] = week.split('-W').map(Number);

    // Get first day of year
    const jan1 = new Date(year, 0, 1);

    // Find first Monday
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);

    // Calculate start of requested week
    const weekStart = new Date(jan1);
    weekStart.setDate(jan1.getDate() + daysToMonday + (weekNum - 1) * 7);

    // Generate 7 dates
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string
  ): Promise<WeeklyPlan> {
    const planState = new PlanState(week, profile, pantry);
    const handlers = createToolHandlers(
      planState,
      this.kb,
      this.usdaClient,
      this.aiClient
    );

    const result = await this.aiClient.runAgentLoop({
      systemPrompt: this.buildSystemPrompt(profile),
      initialMessage: this.buildInitialMessage(profile, pantry, week),
      tools: PLANNING_TOOLS,
      toolHandler: handlers.handle,
      maxIterations: 100,
    });

    console.log(`Planning complete: ${result.toolCalls} tool calls, ${result.iterations} iterations`);

    return planState.toWeeklyPlan();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/services/agent-planner.test.ts`
Expected: PASS

**Step 5: Export from services/index.ts**

```typescript
// Add to src/services/index.ts
export * from './agent-planner.js';
```

**Step 6: Commit**

```bash
git add src/services/agent-planner.ts src/services/agent-planner.test.ts src/services/index.ts
git commit -m "feat: add AgentPlanner orchestration service"
```

---

## Task 10: Seed Knowledge Base with Common Ingredients

**Files:**
- Create: `scripts/seed-kb.ts`
- Create: `data/seed/ingredients.json`

**Step 1: Create seed data file**

```json
// data/seed/ingredients.json
// Note: No caloriesPer100g - calories are always computed from macros
{
  "chicken breast": {
    "name": "chicken breast",
    "pricePerUnit": 11,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 31,
    "carbsPer100g": 0,
    "fatPer100g": 3.6,
    "fiberPer100g": 0,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "white rice": {
    "name": "white rice",
    "pricePerUnit": 2.5,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 2.7,
    "carbsPer100g": 28,
    "fatPer100g": 0.3,
    "fiberPer100g": 0.4,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "eggs": {
    "name": "eggs",
    "pricePerUnit": 0.3,
    "unit": "each",
    "unitWeightGrams": 50,
    "proteinPer100g": 13,
    "carbsPer100g": 1.1,
    "fatPer100g": 11,
    "fiberPer100g": 0,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "olive oil": {
    "name": "olive oil",
    "pricePerUnit": 12,
    "unit": "liter",
    "unitWeightGrams": 920,
    "proteinPer100g": 0,
    "carbsPer100g": 0,
    "fatPer100g": 100,
    "fiberPer100g": 0,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "broccoli": {
    "name": "broccoli",
    "pricePerUnit": 3,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 2.8,
    "carbsPer100g": 7,
    "fatPer100g": 0.4,
    "fiberPer100g": 2.6,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "salmon fillet": {
    "name": "salmon fillet",
    "pricePerUnit": 22,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 20,
    "carbsPer100g": 0,
    "fatPer100g": 13,
    "fiberPer100g": 0,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "whole wheat bread": {
    "name": "whole wheat bread",
    "pricePerUnit": 4,
    "unit": "loaf",
    "unitWeightGrams": 500,
    "proteinPer100g": 13,
    "carbsPer100g": 41,
    "fatPer100g": 3.4,
    "fiberPer100g": 7,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "banana": {
    "name": "banana",
    "pricePerUnit": 0.25,
    "unit": "each",
    "unitWeightGrams": 120,
    "proteinPer100g": 1.1,
    "carbsPer100g": 23,
    "fatPer100g": 0.3,
    "fiberPer100g": 2.6,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "greek yogurt": {
    "name": "greek yogurt",
    "pricePerUnit": 6,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 9,
    "carbsPer100g": 3.6,
    "fatPer100g": 5,
    "fiberPer100g": 0,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  },
  "oats": {
    "name": "oats",
    "pricePerUnit": 3,
    "unit": "kg",
    "unitWeightGrams": 1000,
    "proteinPer100g": 17,
    "carbsPer100g": 66,
    "fatPer100g": 7,
    "fiberPer100g": 11,
    "confidence": "manual",
    "lastUpdated": "2026-01-30"
  }
}
```

**Step 2: Create seed script**

```typescript
// scripts/seed-kb.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

async function seedKnowledgeBase() {
  const dataDir = process.env.MEAL_PLANNER_DATA_DIR || join(process.cwd(), 'data');
  const kbDir = join(dataDir, 'knowledge');
  const kbPath = join(kbDir, 'ingredients.json');
  const seedPath = join(process.cwd(), 'data', 'seed', 'ingredients.json');

  // Ensure directory exists
  if (!existsSync(kbDir)) {
    await mkdir(kbDir, { recursive: true });
  }

  // Read seed data
  const seedData = await readFile(seedPath, 'utf-8');

  // Write to KB (this will overwrite existing)
  await writeFile(kbPath, seedData);

  console.log(`Seeded knowledge base at ${kbPath}`);
}

seedKnowledgeBase().catch(console.error);
```

**Step 3: Add seed script to package.json**

```json
// Add to package.json scripts
"seed-kb": "tsx scripts/seed-kb.ts"
```

**Step 4: Create directories and run seed**

```bash
mkdir -p data/seed scripts
```

**Step 5: Commit**

```bash
git add scripts/seed-kb.ts data/seed/ingredients.json package.json
git commit -m "feat: add seed data and script for knowledge base"
```

---

## Task 11: Integration Test for Full Agent Flow

**Files:**
- Create: `src/agent/agent.integration.test.ts`

**Step 1: Create integration test**

```typescript
// src/agent/agent.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentPlanner } from '../services/agent-planner.js';
import type { Profile, Pantry } from '../schemas/index.js';

// This test requires ANTHROPIC_API_KEY to be set
// Skip in CI by checking for the key
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)('AgentPlanner Integration', () => {
  const testDir = join(process.cwd(), 'test-data-agent');
  let planner: AgentPlanner;

  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: ['italian', 'asian'],
      maxPrepTime: {
        monday: 30, tuesday: 30, wednesday: 30,
        thursday: 30, friday: 30, saturday: 60, sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: ['oven', 'stovetop'] },
    household: { size: 2 },
  };

  const mockPantry: Pantry = {
    items: [
      { name: 'rice', quantity: 2, unit: 'kg' },
      { name: 'olive oil', quantity: 1, unit: 'liter' },
    ],
  };

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'knowledge'), { recursive: true });

    // Seed some ingredients (no caloriesPer100g - computed from macros)
    const ingredients = {
      'chicken breast': {
        name: 'chicken breast',
        pricePerUnit: 11,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      rice: {
        name: 'rice',
        pricePerUnit: 2.5,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        fiberPer100g: 0.4,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      broccoli: {
        name: 'broccoli',
        pricePerUnit: 3,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 2.8,
        carbsPer100g: 7,
        fatPer100g: 0.4,
        fiberPer100g: 2.6,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
    };
    writeFileSync(
      join(testDir, 'knowledge', 'ingredients.json'),
      JSON.stringify(ingredients, null, 2)
    );

    planner = new AgentPlanner({
      anthropicApiKey: ANTHROPIC_API_KEY!,
      dataDir: testDir,
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  it('generates a weekly plan using the agent loop', async () => {
    const plan = await planner.generateWeeklyPlan(
      mockProfile,
      mockPantry,
      '2026-W05'
    );

    expect(plan.week).toBe('2026-W05');
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.totals.calories).toBeGreaterThan(0);
  }, 120000); // 2 minute timeout for API calls
});
```

**Step 2: Commit**

```bash
git add src/agent/agent.integration.test.ts
git commit -m "test: add integration test for full agent planning flow"
```

---

## Task 12: Wire Up CLI Command

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Update plan command to use AgentPlanner**

```typescript
// src/commands/plan.ts
import { AgentPlanner } from '../services/agent-planner.js';
import { DataStore } from '../data/store.js';

export async function generateWeekPlan(dataDir: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const store = new DataStore(dataDir);
  await store.init();

  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  // Calculate current week
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  const week = `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

  console.log(`Generating meal plan for ${week}...`);
  console.log('This may take a minute as the AI plans each meal.');

  const planner = new AgentPlanner({
    anthropicApiKey: apiKey,
    dataDir,
    usdaApiKey: process.env.USDA_API_KEY,
  });

  const plan = await planner.generateWeeklyPlan(profile, pantry, week);

  await store.saveWeeklyPlan(plan);

  console.log(`\nPlan generated for ${week}:`);
  console.log(`- ${plan.days.length} days planned`);
  console.log(`- Total calories: ${plan.totals.calories}`);
  console.log(`- Estimated cost: $${plan.totals.estimatedCost.toFixed(2)}`);
}
```

**Step 2: Update CLI to call new function**

The CLI in `src/cli/index.ts` already has a `plan week` command. Update its action to use the new `generateWeekPlan` function.

**Step 3: Run lint and tests**

```bash
npm run lint
npm run test:run
```

**Step 4: Commit**

```bash
git add src/commands/plan.ts src/cli/index.ts
git commit -m "feat: wire up AgentPlanner to CLI plan command"
```

---

## Summary

This plan implements the agentic meal planner in 12 tasks:

1. **MacroCalculator** - Pure nutrition math functions
2. **IngredientEntry Schema** - Add confidence tracking
3. **KnowledgeBase** - Ingredient data persistence
4. **USDAClient** - USDA API integration
5. **PlanState** - In-memory plan state management
6. **Tool Definitions** - Agent tool schemas
7. **AIClient.runAgentLoop** - Tool-use conversation loop
8. **Tool Handlers** - Tool implementations
9. **AgentPlanner** - Orchestration service
10. **Seed KB** - Pre-populate common ingredients
11. **Integration Test** - Full flow test
12. **CLI Wiring** - Connect to existing commands

Each task follows TDD with failing tests first, then implementation.
