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
        dailyCalories: 2000,
        macros: { protein: 150, carbs: 200, fat: 70 },
        weeklyBudget: 150,
      },
      dietary: {
        restrictions: ['nut-allergy'],
        dislikes: ['olives', 'blue cheese'],
      },
      preferences: {
        cuisines: ['thai', 'mexican', 'mediterranean'],
        maxPrepTime: { weekday: 30, weekend: 60 },
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
