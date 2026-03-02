import { describe, it, expect } from 'vitest';
import { WeeklyPlanSchema, MealSchema } from './plan.js';

describe('Plan Schemas', () => {
  it('validates a meal entry', () => {
    const meal = {
      name: 'Greek yogurt with berries',
      recipe: 'Mix yogurt with fresh berries',
      ingredients: [
        { name: 'greek yogurt', amount: 1, unit: 'cup' },
        { name: 'mixed berries', amount: 0.5, unit: 'cup' },
      ],
      prepTime: 5,
      calories: 350,
      macros: { protein: 20, carbs: 40, fat: 10, fiber: 3 },
      estimatedCost: 3.5,
      servings: 1,
      leftoverOf: null,
    };

    const result = MealSchema.safeParse(meal);
    expect(result.success).toBe(true);
  });

  it('validates a weekly plan', () => {
    const plan = {
      week: '2026-01-27--2026-02-02',
      generatedAt: '2026-01-29T10:00:00Z',
      days: [
        {
          date: '2026-01-27',
          meals: {
            breakfast: {
              name: 'Oatmeal',
              recipe: 'Cook oats with water',
              ingredients: [{ name: 'oats', amount: 0.5, unit: 'cup' }],
              prepTime: 10,
              calories: 300,
              macros: { protein: 10, carbs: 50, fat: 5, fiber: 8 },
              estimatedCost: 0.5,
              servings: 1,
              leftoverOf: null,
            },
            lunch: null,
            dinner: null,
          },
        },
      ],
      totals: {
        calories: 2100,
        macros: { protein: 150, carbs: 200, fat: 70, fiber: 25 },
        estimatedCost: 142.5,
      },
    };

    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});
