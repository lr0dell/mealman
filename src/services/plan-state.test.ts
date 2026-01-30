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
