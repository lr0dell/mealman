import { describe, it, expect, beforeEach } from 'vitest';
import { PlanState } from './plan-state.js';
import type { Profile, Pantry } from '../schemas/index.js';
import type { Meal } from '../schemas/plan.js';

describe('PlanState', () => {
  const mockProfile: Profile = {
    goals: {
      dailyCalories: 2000,
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
        monday: { breakfast: 10, lunch: 15, dinner: 45 },
        tuesday: { breakfast: 10, lunch: 15, dinner: 45 },
        wednesday: { breakfast: 10, lunch: 15, dinner: 45 },
        thursday: { breakfast: 10, lunch: 15, dinner: 45 },
        friday: { breakfast: 10, lunch: 15, dinner: 45 },
        saturday: { breakfast: 30, lunch: 30, dinner: 60 },
        sunday: { breakfast: 30, lunch: 30, dinner: 60 },
      },
      slotNotes: { breakfast: '', lunch: '', dinner: '' },
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

  it('weekly calorie budget uses dailyCalories*7 with a ±500 band', () => {
    const remaining = state.getRemainingBudget();
    // 2000*7 = 14000, band ±500 => [13500, 14500], nothing planned yet
    expect(remaining.calories.min).toBe(13500);
    expect(remaining.calories.max).toBe(14500);
    expect(remaining.calories.status).toBe('under');
    expect(remaining.macros.protein.status).toBe('under');
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

    // Weekly targets: 2000*7 ± 500 = 13500-14500 cal
    // After 500 cal: 13000-14000 remaining
    expect(remaining.calories.min).toBe(13500 - 500);
    expect(remaining.cost).toBe(150 - 10);
  });

  describe('getRemainingBudget status field', () => {
    it('returns "in_range" status when between min and max', () => {
      // Add meals to put protein in range (700-1050 weekly)
      // Need ~750g protein total (7 meals at ~107g each)
      for (let day = 1; day <= 7; day++) {
        const meal: Meal = {
          name: `Day ${day} Protein Meal`,
          recipe: 'High protein',
          ingredients: [],
          prepTime: 10,
          calories: 2000, // Daily target (2000*7=14000, within band 13500-14500)
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

  const sampleMeal = (calories: number, cost: number): Meal => ({
    name: 'Big Breakfast',
    recipe: 'cook',
    ingredients: [{ ingredientId: 1, name: 'eggs', amount: 100, unit: 'g' }],
    prepTime: 10,
    calories,
    macros: { protein: 50, carbs: 50, fat: 50, fiber: 10 },
    estimatedCost: cost,
    servings: 1,
    leftoverOf: null,
  });

  describe('getPaceContext', () => {
    it('first day paces toward the weekly calorie target evenly', () => {
      const pace = state.getPaceContext('2026-01-26');
      expect(pace.weeklyCalTarget).toBe(14000);
      expect(pace.daysRemaining).toBe(7);
      expect(pace.caloriesSoFar).toBe(0);
      expect(pace.paceCalories).toBe(2000); // 14000 / 7
      expect(pace.calorieBand).toEqual({ min: 13500, max: 14500 });
      expect(pace.weeklyBudget).toBe(150);
    });

    it('corrects for prior-day drift', () => {
      state.addMeal('2026-01-26', 'breakfast', sampleMeal(2500, 30));
      const pace = state.getPaceContext('2026-01-27');
      expect(pace.caloriesSoFar).toBe(2500);
      expect(pace.costSoFar).toBe(30);
      expect(pace.daysRemaining).toBe(6);
      expect(pace.paceCalories).toBe(1917); // round((14000 - 2500) / 6)
      expect(pace.paceCost).toBeCloseTo(20, 5); // (150 - 30) / 6
    });
  });

  describe('getMealsSummaryBefore', () => {
    it('lists meal names for days before the given date', () => {
      state.addMeal('2026-01-26', 'breakfast', sampleMeal(500, 5));
      const summary = state.getMealsSummaryBefore('2026-01-27');
      expect(summary).toContain('2026-01-26');
      expect(summary).toContain('Big Breakfast');
    });

    it('is empty for the first day of the week', () => {
      state.addMeal('2026-01-26', 'breakfast', sampleMeal(500, 5));
      expect(state.getMealsSummaryBefore('2026-01-26')).toBe('');
    });
  });

  describe('available pantry and shopping list', () => {
    const mealWith = (
      name: string,
      ingredients: { ingredientId: number; name: string; amount: number }[]
    ): Meal => ({
      name,
      recipe: 'cook',
      ingredients: ingredients.map((i) => ({ ...i, unit: 'g' as const })),
      prepTime: 10,
      calories: 100,
      macros: { protein: 1, carbs: 1, fat: 1, fiber: 1 },
      estimatedCost: 1,
      servings: 1,
      leftoverOf: null,
    });

    const pantry: Pantry = {
      items: [
        {
          ingredientId: 1,
          name: 'chicken breast',
          quantity: 500,
          unit: 'g',
          addedDate: '2026-01-20',
        },
        {
          ingredientId: 2,
          name: 'rice',
          quantity: 300,
          unit: 'g',
          addedDate: '2026-01-20',
        },
      ],
    };

    it('getAvailablePantry deducts planned meals by ingredientId', () => {
      const s = new PlanState('2026-01-26--2026-02-01', mockProfile, pantry);
      s.addMeal(
        '2026-01-26',
        'dinner',
        mealWith('Chicken & Rice', [
          { ingredientId: 1, name: 'chicken breast', amount: 200 },
          { ingredientId: 2, name: 'rice', amount: 300 },
        ])
      );

      const available = s.getAvailablePantry();
      // rice fully consumed (300/300) -> dropped; chicken 500-200=300 remains
      expect(available).toHaveLength(1);
      expect(available[0]).toMatchObject({
        ingredientId: 1,
        name: 'chicken breast',
        quantity: 300,
      });
    });

    it('getAvailablePantry matches by id even when names differ', () => {
      const s = new PlanState('2026-01-26--2026-02-01', mockProfile, pantry);
      s.addMeal(
        '2026-01-26',
        'lunch',
        mealWith('Grilled', [
          { ingredientId: 1, name: 'chicken breasts', amount: 100 },
        ])
      );

      const chicken = s.getAvailablePantry().find((i) => i.ingredientId === 1);
      expect(chicken?.quantity).toBe(400);
    });

    it('getShoppingList reports ingredients the pantry cannot cover', () => {
      const s = new PlanState('2026-01-26--2026-02-01', mockProfile, pantry);
      s.addMeal(
        '2026-01-26',
        'dinner',
        mealWith('Stir fry', [
          { ingredientId: 1, name: 'chicken breast', amount: 600 }, // shortfall: 600-500=100
          { ingredientId: 9, name: 'soy sauce', amount: 40 }, // missing entirely
        ])
      );

      const shopping = s.getShoppingList();
      expect(shopping).toContainEqual({
        ingredientId: 1,
        name: 'chicken breast',
        amount: 100,
      });
      expect(shopping).toContainEqual({
        ingredientId: 9,
        name: 'soy sauce',
        amount: 40,
      });
      expect(shopping).toHaveLength(2);
    });

    it('getShoppingList is empty when the pantry covers everything', () => {
      const s = new PlanState('2026-01-26--2026-02-01', mockProfile, pantry);
      s.addMeal(
        '2026-01-26',
        'lunch',
        mealWith('Small', [
          { ingredientId: 1, name: 'chicken breast', amount: 100 },
        ])
      );
      expect(s.getShoppingList()).toEqual([]);
    });

    it('getShoppingListLimit scales as max(30 - pantry size, 10)', () => {
      const barren = new PlanState('2026-01-26--2026-02-01', mockProfile, {
        items: [],
      });
      expect(barren.getShoppingListLimit()).toBe(30);

      const big: Pantry = {
        items: Array.from({ length: 45 }, (_, i) => ({
          ingredientId: i + 1,
          name: `item-${i}`,
          quantity: 100,
          unit: 'g' as const,
          addedDate: '2026-01-20',
        })),
      };
      const stocked = new PlanState('2026-01-26--2026-02-01', mockProfile, big);
      expect(stocked.getShoppingListLimit()).toBe(10); // max(30 - 45, 10)
    });
  });
});
