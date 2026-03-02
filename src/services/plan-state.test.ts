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

  let state: PlanState;

  beforeEach(() => {
    state = new PlanState('2026-01-26--2026-02-01', mockProfile, mockPantry);
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
        { ingredientId: 1, name: 'chicken breast', amount: 200, unit: 'g' },
        { ingredientId: 2, name: 'mixed greens', amount: 100, unit: 'g' },
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

  describe('getRemainingBudget status field', () => {
    it('returns "under" status when below minimum', () => {
      // No meals added, protein is 0, weekly min is 700 (100*7)
      const remaining = state.getRemainingBudget();

      expect(remaining.macros.protein.status).toBe('under');
      expect(remaining.calories.status).toBe('under');
    });

    it('returns "in_range" status when between min and max', () => {
      // Add meals to put protein in range (700-1050 weekly)
      // Need ~750g protein total (7 meals at ~107g each)
      for (let day = 1; day <= 7; day++) {
        const meal: Meal = {
          name: `Day ${day} Protein Meal`,
          recipe: 'High protein',
          ingredients: [],
          prepTime: 10,
          calories: 1800, // Daily min
          macros: { protein: 110, carbs: 220, fat: 55, fiber: 28 }, // All in range
          estimatedCost: 15,
          servings: 1,
          leftoverOf: null,
        };
        state.addMeal(`2026-02-0${day}`, 'lunch', meal);
      }

      const remaining = state.getRemainingBudget();

      // protein: 770g total, range is 700-1050, so in_range
      expect(remaining.macros.protein.status).toBe('in_range');
      expect(remaining.calories.status).toBe('in_range');
    });

    it('returns "over" status when above maximum', () => {
      // Add excessive protein meals
      for (let day = 1; day <= 7; day++) {
        const meal: Meal = {
          name: `Day ${day} Excessive Protein`,
          recipe: 'Too much protein',
          ingredients: [],
          prepTime: 10,
          calories: 3000,
          macros: { protein: 200, carbs: 300, fat: 100, fiber: 50 }, // All over max
          estimatedCost: 20,
          servings: 1,
          leftoverOf: null,
        };
        state.addMeal(`2026-02-0${day}`, 'lunch', meal);
      }

      const remaining = state.getRemainingBudget();

      // protein: 1400g total, max is 1050 (150*7), so over
      expect(remaining.macros.protein.status).toBe('over');
      expect(remaining.calories.status).toBe('over');
    });

    it('correctly identifies mixed statuses across macros', () => {
      // Add meals that are in range for protein but under for fiber
      for (let day = 1; day <= 7; day++) {
        const meal: Meal = {
          name: `Day ${day} Low Fiber`,
          recipe: 'Good protein, low fiber',
          ingredients: [],
          prepTime: 10,
          calories: 2000,
          macros: { protein: 120, carbs: 250, fat: 65, fiber: 10 }, // protein in range, fiber under
          estimatedCost: 18,
          servings: 1,
          leftoverOf: null,
        };
        state.addMeal(`2026-02-0${day}`, 'lunch', meal);
      }

      const remaining = state.getRemainingBudget();

      // protein: 840g, range 700-1050 = in_range
      expect(remaining.macros.protein.status).toBe('in_range');
      // fiber: 70g, range 175-280 = under
      expect(remaining.macros.fiber.status).toBe('under');
    });
  });

  describe('ingredient tracking', () => {
    it('tracks unique ingredients across all meals', () => {
      const state = new PlanState(
        '2026-01-26--2026-02-01',
        mockProfile,
        mockPantry
      );

      state.addMeal('2026-01-27', 'breakfast', {
        name: 'Eggs',
        recipe: 'Scrambled',
        ingredients: [
          { ingredientId: 1, name: 'whole egg', amount: 100, unit: 'g' },
          { ingredientId: 2, name: 'butter', amount: 10, unit: 'g' },
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
          { ingredientId: 3, name: 'chicken breast', amount: 200, unit: 'g' },
          { ingredientId: 2, name: 'butter', amount: 10, unit: 'g' }, // duplicate
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
      const state = new PlanState(
        '2026-01-26--2026-02-01',
        mockProfile,
        mockPantry
      );

      // Add meal with many ingredients
      state.addMeal('2026-01-27', 'breakfast', {
        name: 'Complex meal',
        recipe: 'Cook it',
        ingredients: Array.from({ length: 18 }, (_, i) => ({
          ingredientId: i,
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
      expect(status.warning).toBe(
        'Approaching limit: 18/20 unique ingredients'
      );
    });
  });

  describe('pantry tracking', () => {
    it('tracks when pantry items are used in meals', () => {
      const pantryWithItems: Pantry = {
        items: [
          {
            ingredientId: 1,
            name: 'eggs',
            quantity: 12,
            unit: 'g',
            addedDate: '2026-02-03',
          },
          {
            ingredientId: 2,
            name: 'butter',
            quantity: 500,
            unit: 'g',
            addedDate: '2026-02-03',
          },
        ],
      };

      const state = new PlanState(
        '2026-01-26--2026-02-01',
        mockProfile,
        pantryWithItems
      );

      state.addMeal('2026-01-27', 'breakfast', {
        name: 'Eggs',
        recipe: 'Scrambled',
        ingredients: [
          { ingredientId: 1, name: 'eggs', amount: 100, unit: 'g' },
          { ingredientId: 2, name: 'butter', amount: 20, unit: 'g' },
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

      const eggsStatus = status.find((s) => s.name === 'eggs');
      expect(eggsStatus?.used).toBe(true);

      const butterStatus = status.find((s) => s.name === 'butter');
      expect(butterStatus?.used).toBe(true);
    });

    it('identifies unused pantry items', () => {
      const pantryWithItems: Pantry = {
        items: [
          {
            ingredientId: 1,
            name: 'eggs',
            quantity: 12,
            unit: 'g',
            addedDate: '2026-02-03',
          },
          {
            ingredientId: 2,
            name: 'milk',
            quantity: 1000,
            unit: 'g',
            addedDate: '2026-02-03',
          },
        ],
      };

      const state = new PlanState(
        '2026-01-26--2026-02-01',
        mockProfile,
        pantryWithItems
      );

      // Only use eggs
      state.addMeal('2026-01-27', 'breakfast', {
        name: 'Eggs',
        recipe: 'Boiled',
        ingredients: [
          { ingredientId: 1, name: 'eggs', amount: 100, unit: 'g' },
        ],
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
});
