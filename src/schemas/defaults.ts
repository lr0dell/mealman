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
        monday: { breakfast: 15, lunch: 15, dinner: 30 },
        tuesday: { breakfast: 15, lunch: 15, dinner: 30 },
        wednesday: { breakfast: 15, lunch: 15, dinner: 30 },
        thursday: { breakfast: 15, lunch: 15, dinner: 30 },
        friday: { breakfast: 15, lunch: 15, dinner: 30 },
        saturday: { breakfast: 30, lunch: 30, dinner: 60 },
        sunday: { breakfast: 30, lunch: 30, dinner: 60 },
      },
      slotNotes: { breakfast: '', lunch: '', dinner: '' },
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
