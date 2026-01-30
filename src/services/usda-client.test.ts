import { describe, it, expect } from 'vitest';
import { USDAClient } from './usda-client.js';

describe('USDAClient', () => {
  describe('parseNutrients', () => {
    it('extracts macros from USDA food nutrients array', () => {
      const foodNutrients = [
        { nutrientId: 1003, value: 31 }, // Protein
        { nutrientId: 1005, value: 0 }, // Carbs
        { nutrientId: 1004, value: 3.6 }, // Fat
        { nutrientId: 1079, value: 0 }, // Fiber
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
