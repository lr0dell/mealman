import type { Macros } from '../schemas/plan.js';

export interface IngredientWithNutrition {
  name: string;
  amountGrams: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerUnit: number;
  unit: string;
  unitWeightGrams: number; // e.g., 1 "each" egg = 50g
}

export interface MealNutrition {
  calories: number;
  macros: Macros;
  estimatedCost: number;
}

export function calculateCaloriesFromMacros(macros: Macros): number {
  // Standard: protein 4 cal/g, carbs 4 cal/g, fat 9 cal/g
  // Fiber is not counted (indigestible)
  return Math.round(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9);
}

export function calculateMealNutrition(
  ingredients: IngredientWithNutrition[]
): MealNutrition {
  if (ingredients.length === 0) {
    return {
      calories: 0,
      macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      estimatedCost: 0,
    };
  }

  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalCost = 0;

  for (const ing of ingredients) {
    const multiplier = ing.amountGrams / 100;
    totalProtein += ing.proteinPer100g * multiplier;
    totalCarbs += ing.carbsPer100g * multiplier;
    totalFat += ing.fatPer100g * multiplier;
    totalFiber += ing.fiberPer100g * multiplier;

    // Cost calculation: amountGrams / unitWeightGrams * pricePerUnit
    totalCost += (ing.amountGrams / ing.unitWeightGrams) * ing.pricePerUnit;
  }

  const macros = {
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
    fiber: totalFiber,
  };

  return {
    calories: calculateCaloriesFromMacros(macros),
    macros,
    estimatedCost: totalCost,
  };
}
