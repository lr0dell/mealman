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
