import { describe, it, expect } from 'vitest';
import { IngredientEntrySchema } from './knowledge.js';

describe('Knowledge Schemas', () => {
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
});
