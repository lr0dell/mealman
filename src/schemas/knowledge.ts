import { z } from 'zod';

export const IngredientEntrySchema = z.object({
  name: z.string(),
  pricePerUnit: z.number().nonnegative(),
  unit: z.string(),
  unitWeightGrams: z.number().positive(), // weight in grams per unit (e.g., 1 kg = 1000g)
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative(),
  confidence: z.enum(['usda', 'ai-estimate', 'manual']),
  usdaFdcId: z.number().optional(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const IngredientsKnowledgeSchema = z.record(
  z.string(),
  IngredientEntrySchema
);

export const MealEntrySchema = z.object({
  estimatedCalories: z.number().nonnegative(),
  estimatedProtein: z.number().nonnegative(),
  estimatedCarbs: z.number().nonnegative(),
  estimatedFat: z.number().nonnegative(),
  estimatedFiber: z.number().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['manual', 'ai-estimate']),
});

export const MealsKnowledgeSchema = z.record(z.string(), MealEntrySchema);

export type IngredientEntry = z.infer<typeof IngredientEntrySchema>;
export type MealEntry = z.infer<typeof MealEntrySchema>;
