import { z } from 'zod';

export const HouseholdMemberSchema = z.object({
  name: z.string(),
  dietaryRestrictions: z.array(z.string()),
});

export const HouseholdSchema = z.object({
  size: z.number().int().positive(),
  members: z.array(HouseholdMemberSchema),
});

export const MacrosSchema = z.object({
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const GoalsSchema = z.object({
  dailyCalories: z.number().positive(),
  macros: MacrosSchema,
  weeklyBudget: z.number().positive(),
});

export const DietarySchema = z.object({
  restrictions: z.array(z.string()),
  dislikes: z.array(z.string()),
});

export const PrepTimeSchema = z.object({
  weekday: z.number().positive(),
  weekend: z.number().positive(),
});

export const PreferencesSchema = z.object({
  cuisines: z.array(z.string()),
  maxPrepTime: PrepTimeSchema,
  complexityTolerance: z.enum(['low', 'medium', 'high']),
});

export const ConstraintsSchema = z.object({
  kitchenware: z.array(z.string()),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
});

export const LearnedSchema = z.object({
  lovedMeals: z.array(z.string()),
  dislikedMeals: z.array(z.string()),
  patterns: z.array(z.string()),
});

export const ProfileSchema = z.object({
  household: HouseholdSchema,
  goals: GoalsSchema,
  dietary: DietarySchema,
  preferences: PreferencesSchema,
  constraints: ConstraintsSchema,
  learned: LearnedSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Macros = z.infer<typeof MacrosSchema>;
