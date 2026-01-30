import { z } from 'zod';

export const RangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
}).refine(v => v.max >= v.min, {
  message: 'max must be >= min',
});

export const HouseholdMemberSchema = z.object({
  name: z.string(),
  dietaryRestrictions: z.array(z.string()),
});

export const HouseholdSchema = z.object({
  size: z.number().int().positive(),
  members: z.array(HouseholdMemberSchema),
});

export const MacrosSchema = z.object({
  protein: RangeSchema,
  carbs: RangeSchema,
  fat: RangeSchema,
  fiber: RangeSchema,
});

export const GoalsSchema = z.object({
  dailyCalories: RangeSchema,
  macros: MacrosSchema,
  weeklyBudget: z.number().positive(),
});

export const DietarySchema = z.object({
  restrictions: z.array(z.string()),
  dislikes: z.array(z.string()),
});

export const PrepTimeSchema = z.object({
  monday: z.number().positive(),
  tuesday: z.number().positive(),
  wednesday: z.number().positive(),
  thursday: z.number().positive(),
  friday: z.number().positive(),
  saturday: z.number().positive(),
  sunday: z.number().positive(),
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
