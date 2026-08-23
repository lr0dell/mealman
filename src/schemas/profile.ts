import { z } from 'zod';

export const RangeSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  })
  .refine((v) => v.max >= v.min, {
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

export const MacroGoalsSchema = z.object({
  protein: RangeSchema,
  carbs: RangeSchema,
  fat: RangeSchema,
  fiber: RangeSchema,
});

export const GoalsSchema = z.object({
  dailyCalories: z.number().positive(),
  macros: MacroGoalsSchema,
  weeklyBudget: z.number().positive(),
});

export const DietarySchema = z.object({
  restrictions: z.array(z.string()),
  dislikes: z.array(z.string()),
});

export const SlotPrepTimeSchema = z.object({
  breakfast: z.number().positive(),
  lunch: z.number().positive(),
  dinner: z.number().positive(),
});

export const PrepTimeSchema = z.object({
  monday: SlotPrepTimeSchema,
  tuesday: SlotPrepTimeSchema,
  wednesday: SlotPrepTimeSchema,
  thursday: SlotPrepTimeSchema,
  friday: SlotPrepTimeSchema,
  saturday: SlotPrepTimeSchema,
  sunday: SlotPrepTimeSchema,
});

export const SlotNotesSchema = z.object({
  breakfast: z.string(),
  lunch: z.string(),
  dinner: z.string(),
});

export const PreferencesSchema = z.object({
  cuisines: z.array(z.string()),
  maxPrepTime: PrepTimeSchema,
  slotNotes: SlotNotesSchema,
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
export type SlotPrepTime = z.infer<typeof SlotPrepTimeSchema>;
export type SlotNotes = z.infer<typeof SlotNotesSchema>;
