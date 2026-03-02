import { z } from 'zod';

export const MealIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().positive(),
  unit: z.string(),
});

export const MacrosSchema = z.object({
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
});

export const MealSchema = z.object({
  name: z.string(),
  recipe: z.string(),
  ingredients: z.array(MealIngredientSchema),
  prepTime: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  macros: MacrosSchema,
  estimatedCost: z.number().nonnegative(),
  servings: z.number().positive(),
  leftoverOf: z.string().nullable(),
});

export const DayMealsSchema = z.object({
  breakfast: MealSchema.nullable(),
  lunch: MealSchema.nullable(),
  dinner: MealSchema.nullable(),
});

export const DayPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meals: DayMealsSchema,
});

export const PlanTotalsSchema = z.object({
  calories: z.number().nonnegative(),
  macros: MacrosSchema,
  estimatedCost: z.number().nonnegative(),
});

export const WeeklyPlanSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string(),
  days: z.array(DayPlanSchema),
  totals: PlanTotalsSchema,
});

export type Meal = z.infer<typeof MealSchema>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>;
export type Macros = z.infer<typeof MacrosSchema>;
