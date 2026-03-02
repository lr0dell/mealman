import { z } from 'zod';

export const IngredientCategorySchema = z.enum([
  'meat',
  'seafood',
  'dairy',
  'produce',
  'grains',
  'legumes',
  'oils',
  'other',
]);

export interface Ingredient {
  id: number;
  name: string;
  searchName: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
  category: IngredientCategory;
  source: 'usda' | 'custom';
  usdaFdcId: number | null;
  createdAt: string;
}

export interface IngredientMatch {
  ingredient: Ingredient;
  similarity: number;
}

export interface NewIngredient {
  name: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
  category: IngredientCategory;
  usdaFdcId?: number;
}

export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;
