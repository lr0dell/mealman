import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createToolHandlers } from './tool-handlers.js';
import { PLANNING_TOOLS } from './tools.js';
import { PlanState } from '../services/plan-state.js';
import { IngredientDatabase } from '../services/ingredient-database.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 30,
        saturday: 60,
        sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: {
      size: 2,
      members: [
        {
          name: 'User',
          dietaryRestrictions: [],
        },
        {
          name: 'Partner',
          dietaryRestrictions: ['vegetarian'],
        },
      ],
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };

  const mockPantry: Pantry = { items: [] };

  const testDir = join(process.cwd(), 'test-data-tool-handlers');
  let planState: PlanState;
  let ingredientDb: IngredientDatabase;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(async () => {
    // Create fresh test database
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });

    planState = new PlanState(
      '2026-01-26--2026-02-01',
      mockProfile,
      mockPantry
    );
    ingredientDb = new IngredientDatabase(join(testDir, 'test-ingredients.db'));
    await ingredientDb.init();

    // Add test ingredients
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

    handlers = createToolHandlers(planState, ingredientDb);
  });

  afterEach(() => {
    ingredientDb.close();
    rmSync(testDir, { recursive: true });
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
    it('returns ingredient from database if found', async () => {
      const result = await handlers.handle('lookup_ingredient', {
        name: 'chicken breast',
      });

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
      expect(
        (result as { ingredient: { similarity: number } }).ingredient.similarity
      ).toBeGreaterThan(0);
    });

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
        name: 'breast of chicken',
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
      expect((result as { message: string }).message).toContain(
        'more specific'
      );
    });
  });

  describe('check_weekly_totals (removed)', () => {
    it('returns unknown tool error since check_weekly_totals was removed', async () => {
      const result = await handlers.handle('check_weekly_totals', {});
      expect(result).toMatchObject({
        error: 'Unknown tool: check_weekly_totals',
      });
    });
  });

  describe('add_meal duplicate slot protection', () => {
    it('rejects add_meal when slot is already filled', async () => {
      const mealInput = {
        date: '2026-01-27',
        slot: 'breakfast',
        name: 'First Meal',
        recipe: 'Cook it',
        ingredients: [{ name: 'chicken breast', amountGrams: 200 }],
        prepTime: 20,
        servings: 1,
      };

      await handlers.handle('add_meal', mealInput);

      const result = await handlers.handle('add_meal', {
        ...mealInput,
        name: 'Second Meal',
      });

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('already'),
      });
    });

    it('keeps the original meal when a duplicate add_meal is rejected', async () => {
      const mealInput = {
        date: '2026-01-27',
        slot: 'breakfast',
        name: 'First Meal',
        recipe: 'Cook it',
        ingredients: [{ name: 'chicken breast', amountGrams: 200 }],
        prepTime: 20,
        servings: 1,
      };

      await handlers.handle('add_meal', mealInput);
      await handlers.handle('add_meal', { ...mealInput, name: 'Second Meal' });

      const state = await handlers.handle('get_plan_state', {});
      expect((state as { mealsPlanned: number }).mealsPlanned).toBe(1);
    });

    it('allows modify_meal to overwrite an existing slot', async () => {
      const mealInput = {
        date: '2026-01-27',
        slot: 'breakfast',
        name: 'First Meal',
        recipe: 'Cook it',
        ingredients: [{ name: 'chicken breast', amountGrams: 200 }],
        prepTime: 20,
        servings: 1,
      };

      await handlers.handle('add_meal', mealInput);

      const result = await handlers.handle('modify_meal', {
        ...mealInput,
        name: 'Updated Meal',
      });

      expect(result).toMatchObject({ success: true });
    });
  });

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
      expect(
        (result as { shoppingList: { count: number } }).shoppingList.count
      ).toBe(2);
    });
  });

  describe('get_plan_state with pantry', () => {
    it('includes unused pantry items in response', async () => {
      // Create handlers with pantry items
      const pantryState = new PlanState('2026-01-26--2026-02-01', mockProfile, {
        items: [
          {
            ingredientId: 1,
            name: 'eggs',
            quantity: 600,
            unit: 'g',
            addedDate: '2026-02-03',
          },
        ],
      });
      const handlersWithPantry = createToolHandlers(pantryState, ingredientDb);

      const result = await handlersWithPantry.handle('get_plan_state', {});

      expect(result).toHaveProperty('pantryStatus');
      expect(
        (result as { pantryStatus: { unusedItems: string[] } }).pantryStatus
          .unusedItems
      ).toContain('eggs');
    });
  });

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
      expect(typedResult.autoNotes).toContain('Calories');
    });
  });
});

describe('PLANNING_TOOLS', () => {
  it('does not include check_weekly_totals (redundant with add_meal/modify_meal response)', () => {
    const toolNames = PLANNING_TOOLS.map((t) => t.name);
    expect(toolNames).not.toContain('check_weekly_totals');
  });

  it('includes essential tools', () => {
    const toolNames = PLANNING_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('get_plan_state');
    expect(toolNames).toContain('add_meal');
    expect(toolNames).toContain('modify_meal');
    expect(toolNames).toContain('finalize_plan');
  });
});
