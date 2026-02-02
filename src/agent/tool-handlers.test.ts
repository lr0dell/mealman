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

    planState = new PlanState('2026-W05', mockProfile, mockPantry);
    ingredientDb = new IngredientDatabase(join(testDir, 'test-ingredients.db'));
    await ingredientDb.init();

    // Add test ingredients
    await ingredientDb.addIngredient({
      name: 'chicken breast',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'meat',
    });

    await ingredientDb.addIngredient({
      name: 'brown rice',
      proteinPer100g: 2.7,
      carbsPer100g: 23,
      fatPer100g: 0.9,
      fiberPer100g: 1.8,
      pricePerUnit: 3,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'grains',
    });

    await ingredientDb.addIngredient({
      name: 'broccoli',
      proteinPer100g: 2.8,
      carbsPer100g: 7,
      fatPer100g: 0.4,
      fiberPer100g: 2.6,
      pricePerUnit: 4,
      unit: 'kg',
      unitWeightGrams: 1000,
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
          pricePerUnit: 10,
          unit: 'kg',
        },
      });
      expect(
        (result as { ingredient: { similarity: number } }).ingredient.similarity
      ).toBeGreaterThan(0);
    });

    it('returns best semantic match even for unusual queries', async () => {
      const result = await handlers.handle('lookup_ingredient', {
        name: 'poultry',
      });

      expect(result).toMatchObject({
        found: true,
        ingredient: {
          matchedName: 'chicken breast', // Should match chicken due to semantic similarity
          proteinPer100g: 31,
        },
      });
      // Similarity should be decent but not perfect
      const similarity = (result as { ingredient: { similarity: number } })
        .ingredient.similarity;
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
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
