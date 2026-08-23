import { describe, it, expect } from 'vitest';
import { ProfileSchema } from './profile.js';

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
          monday: { breakfast: 10, lunch: 15, dinner: 45 },
          tuesday: { breakfast: 10, lunch: 15, dinner: 45 },
          wednesday: { breakfast: 10, lunch: 15, dinner: 45 },
          thursday: { breakfast: 10, lunch: 15, dinner: 45 },
          friday: { breakfast: 10, lunch: 15, dinner: 45 },
          saturday: { breakfast: 30, lunch: 30, dinner: 60 },
          sunday: { breakfast: 30, lunch: 30, dinner: 60 },
        },
        slotNotes: {
          breakfast: '',
          lunch: 'Packable the night before.',
          dinner: '',
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
