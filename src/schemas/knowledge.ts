import { z } from 'zod';

export const IngredientEntrySchema = z.object({
  pricePerUnit: z.number().nonnegative(),
  unit: z.string(),
  caloriesPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['manual', 'ai-estimate', 'web']),
});

export const IngredientsKnowledgeSchema = z.record(z.string(), IngredientEntrySchema);

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