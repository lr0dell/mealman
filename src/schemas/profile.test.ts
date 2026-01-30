import { describe, it, expect } from 'vitest';
import { ProfileSchema } from './profile';

describe('ProfileSchema', () => {
  it('validates a complete profile', () => {
    const validProfile = {
      household: {
        size: 2,
        members: [
          { name: 'User', dietaryRestrictions: [] },
          { name: 'Partner', dietaryRestrictions: ['vegetarian'] },
        ],
      },
      goals: {
        dailyCalories: { min: 1800, max: 2200 },
        macros: {
          protein: { min: 120, max: 160 },
          carbs: { min: 180, max: 240 },
          fat: { min: 60, max: 80 },
          fiber: { min: 25, max: 40 },
        },
        weeklyBudget: 150,
      },
      dietary: {
        restrictions: ['nut-allergy'],
        dislikes: ['olives', 'blue cheese'],
      },
      preferences: {
        cuisines: ['thai', 'mexican', 'mediterranean'],
        maxPrepTime: {
          monday: 30,
          tuesday: 30,
          wednesday: 30,
          thursday: 30,
          friday: 30,
          saturday: 60,
          sunday: 60,
        },
        complexityTolerance: 'medium',
      },
      constraints: {
        kitchenware: ['instant-pot', 'air-fryer', 'basic'],
        skillLevel: 'intermediate',
      },
      learned: {
        lovedMeals: [],
        dislikedMeals: [],
        patterns: [],
      },
    };

    const result = ProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it('rejects profile with missing required fields', () => {
    const invalidProfile = {
      household: { size: 2 },
    };

    const result = ProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
});
