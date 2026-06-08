import type { Profile, Pantry } from './index.js';

export function createDefaultProfile(): Profile {
  return {
    household: {
      size: 1,
      members: [{ name: 'User', dietaryRestrictions: [] }],
    },
    goals: {
      dailyCalories: 2000,
      macros: {
        protein: { min: 120, max: 160 },
        carbs: { min: 180, max: 240 },
        fat: { min: 60, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 100,
    },
    dietary: {
      restrictions: [],
      dislikes: [],
    },
    preferences: {
      cuisines: [],
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
      kitchenware: ['basic'],
      skillLevel: 'beginner',
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };
}

export function createDefaultPantry(): Pantry {
  return {
    items: [],
  };
}
