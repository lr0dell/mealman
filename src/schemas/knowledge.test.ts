import { describe, it, expect } from 'vitest';
import { IngredientsKnowledgeSchema, MealsKnowledgeSchema } from './knowledge';

describe('Knowledge Schemas', () => {
  it('validates ingredient knowledge entry', () => {
    const ingredients = {
      'chicken breast': {
        pricePerUnit: 4.5,
        unit: 'lb',
        caloriesPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        lastUpdated: '2026-01-20',
        source: 'manual',
      },
    };

    const result = IngredientsKnowledgeSchema.safeParse(ingredients);
    expect(result.success).toBe(true);
  });

  it('validates meal knowledge entry', () => {
    const meals = {
      'chipotle burrito bowl': {
        estimatedCalories: 800,
        estimatedProtein: 45,
        estimatedCarbs: 70,
        estimatedFat: 35,
        estimatedFiber: 10,
        estimatedCost: 12,
        lastUpdated: '2026-01-15',
        source: 'ai-estimate',
      },
    };

    const result = MealsKnowledgeSchema.safeParse(meals);
    expect(result.success).toBe(true);
  });
});
