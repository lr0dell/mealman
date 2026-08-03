import { PlanState } from '../services/plan-state.js';
import { IngredientDatabase } from '../services/ingredient-database.js';
import {
  calculateMealNutrition,
  type IngredientWithNutrition,
} from '../services/macro-calculator.js';
import type {
  AddMealInput,
  ModifyMealInput,
  RemoveMealInput,
  LookupIngredientInput,
  CheckDailyTotalsInput,
  FinalizePlanInput,
} from './types.js';
import type { Meal } from '../schemas/plan.js';
import { parseWeekKey } from '../utils/week.js';

const MINIMUM_SIMILARITY = 0.8;

export function createToolHandlers(
  planState: PlanState,
  ingredientDb: IngredientDatabase,
  options: { lockedDate?: string } = {}
): {
  handle: (toolName: string, input: unknown) => Promise<unknown>;
} {
  const { lockedDate } = options;
  function handleGetPlanState(): {
    week: string;
    mealsPlanned: number;
    weeklyTotals: {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    };
    remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
  } {
    const summary = planState.getSummary();
    const remaining = planState.getRemainingBudget();
    return {
      week: planState.getWeek(),
      mealsPlanned: summary.mealsPlanned,
      weeklyTotals: summary.weeklyTotals,
      remainingBudget: remaining,
    };
  }

  async function storeMeal(input: AddMealInput): Promise<
    | { success: false; error: string }
    | {
        success: true;
        meal: {
          name: string;
          calories: number;
          macros: {
            protein: number;
            carbs: number;
            fat: number;
            fiber: number;
          };
          cost: number;
        };
        dayTotals:
          | {
              calories: number;
              macros: {
                protein: number;
                carbs: number;
                fat: number;
                fiber: number;
              };
              estimatedCost: number;
            }
          | undefined;
        remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
      }
  > {
    // Look up all ingredients
    const ingredientIds: number[] = [];
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ing of input.ingredients) {
      const match = await ingredientDb.searchIngredient(ing.name);
      if (!match) {
        return {
          success: false,
          error: `Ingredient "${ing.name}" not found. Try a different search term.`,
        };
      }
      const entry = match.ingredient;
      ingredientIds.push(entry.id);
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerGram: entry.pricePerGram,
      });
    }

    // Calculate nutrition
    const nutrition = calculateMealNutrition(ingredientsWithNutrition);

    const meal: Meal = {
      name: input.name,
      recipe: input.recipe,
      ingredients: input.ingredients.map((i, idx) => ({
        ingredientId: ingredientIds[idx],
        name: ingredientsWithNutrition[idx].name,
        amount: i.amountGrams,
        unit: 'g' as const,
      })),
      prepTime: input.prepTime,
      calories: nutrition.calories,
      macros: nutrition.macros,
      estimatedCost: nutrition.estimatedCost,
      servings: input.servings,
      leftoverOf: input.leftoverOf ?? null,
    };

    planState.addMeal(input.date, input.slot, meal);

    const summary = planState.getSummary();
    const dayTotals = summary.dayTotals.get(input.date);

    return {
      success: true,
      meal: {
        name: meal.name,
        calories: meal.calories,
        macros: meal.macros,
        cost: meal.estimatedCost,
      },
      dayTotals,
      remainingBudget: planState.getRemainingBudget(),
    };
  }

  async function handleAddMeal(
    input: AddMealInput
  ): ReturnType<typeof storeMeal> {
    if (lockedDate && input.date !== lockedDate) {
      return {
        success: false,
        error: `This conversation can only plan ${lockedDate}.`,
      };
    }
    if (planState.getMeal(input.date, input.slot)) {
      return {
        success: false,
        error: `Slot ${input.slot} on ${input.date} is already filled. Use modify_meal to replace it.`,
      };
    }
    return storeMeal(input);
  }

  async function handleModifyMeal(input: ModifyMealInput): Promise<
    | { success: false; error: string }
    | {
        success: true;
        meal: {
          name: string;
          calories: number;
          macros: {
            protein: number;
            carbs: number;
            fat: number;
            fiber: number;
          };
          cost: number;
        };
        dayTotals:
          | {
              calories: number;
              macros: {
                protein: number;
                carbs: number;
                fat: number;
                fiber: number;
              };
              estimatedCost: number;
            }
          | undefined;
        remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
      }
  > {
    if (lockedDate && input.date !== lockedDate) {
      return {
        success: false,
        error: `This conversation can only plan ${lockedDate}.`,
      };
    }
    return storeMeal(input);
  }

  function handleRemoveMeal(input: RemoveMealInput):
    | { success: false; error: string }
    | {
        success: true;
        remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
      } {
    if (lockedDate && input.date !== lockedDate) {
      return {
        success: false,
        error: `This conversation can only plan ${lockedDate}.`,
      };
    }
    planState.removeMeal(input.date, input.slot);
    return {
      success: true,
      remainingBudget: planState.getRemainingBudget(),
    };
  }

  interface LookupHit {
    query: string;
    found: true;
    id: number;
    name: string;
    similarity: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
    fiberPer100g: number;
    pricePerGram: number;
  }

  interface LookupMiss {
    query: string;
    found: false;
    message: string;
    suggestions: Array<{ id: number; name: string; similarity: number }>;
  }

  async function handleLookupIngredient(
    input: LookupIngredientInput
  ): Promise<{ results: Array<LookupHit | LookupMiss> }> {
    const results: Array<LookupHit | LookupMiss> = [];

    for (const query of input.names) {
      const matches = await ingredientDb.searchIngredients(query, 5);

      if (matches.length === 0) {
        results.push({
          query,
          found: false,
          message: `No ingredients found for "${query}".`,
          suggestions: [],
        });
        continue;
      }

      const top = matches[0];

      if (top.similarity >= MINIMUM_SIMILARITY) {
        results.push({
          query,
          found: true,
          id: top.ingredient.id,
          name: top.ingredient.name,
          similarity: top.similarity,
          proteinPer100g: top.ingredient.proteinPer100g,
          carbsPer100g: top.ingredient.carbsPer100g,
          fatPer100g: top.ingredient.fatPer100g,
          fiberPer100g: top.ingredient.fiberPer100g,
          pricePerGram: top.ingredient.pricePerGram,
        });
        continue;
      }

      results.push({
        query,
        found: false,
        message: `No confident match for "${query}". Use one of the suggested ids, or retry with a more specific name (e.g. "black beans" instead of "beans").`,
        suggestions: matches.map((m) => ({
          id: m.ingredient.id,
          name: m.ingredient.name,
          similarity: m.similarity,
        })),
      });
    }

    return { results };
  }

  function handleCheckDailyTotals(input: CheckDailyTotalsInput): {
    date: string;
    totals: {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    };
    targets: {
      calories: number;
      macros: {
        protein: { min: number; max: number };
        carbs: { min: number; max: number };
        fat: { min: number; max: number };
        fiber: { min: number; max: number };
      };
    };
  } {
    const summary = planState.getSummary();
    const dayTotals = summary.dayTotals.get(input.date);
    const profile = planState.getProfile();

    return {
      date: input.date,
      totals: dayTotals ?? {
        calories: 0,
        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
        estimatedCost: 0,
      },
      targets: {
        calories: profile.goals.dailyCalories,
        macros: profile.goals.macros,
      },
    };
  }

  function handleFinalizePlan(input: FinalizePlanInput): {
    success: true;
    plan: ReturnType<typeof planState.toWeeklyPlan>;
    notes: string | undefined;
    autoNotes: string;
  } {
    const plan = planState.toWeeklyPlan();
    const summary = planState.getSummary();
    const shoppingList = planState.getShoppingList();
    const { start, end } = parseWeekKey(plan.week);

    const autoNotes = [
      `Plan ${start} to ${end} complete.`,
      `${summary.mealsPlanned} meals planned.`,
      `Calories: ${Math.round(plan.totals.calories)}.`,
      `Protein: ${Math.round(plan.totals.macros.protein)}g.`,
      `Cost: $${plan.totals.estimatedCost.toFixed(2)}.`,
      `Shopping list: ${shoppingList.length} items.`,
    ].join(' ');

    return {
      success: true,
      plan,
      notes: input.notes,
      autoNotes,
    };
  }

  return {
    handle: async (toolName: string, input: unknown): Promise<unknown> => {
      switch (toolName) {
        case 'get_plan_state':
          return handleGetPlanState();
        case 'add_meal':
          return handleAddMeal(input as AddMealInput);
        case 'modify_meal':
          return handleModifyMeal(input as ModifyMealInput);
        case 'remove_meal':
          return handleRemoveMeal(input as RemoveMealInput);
        case 'lookup_ingredient':
          return handleLookupIngredient(input as LookupIngredientInput);
        case 'check_daily_totals':
          return handleCheckDailyTotals(input as CheckDailyTotalsInput);
        case 'finalize_plan':
          return handleFinalizePlan(input as FinalizePlanInput);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    },
  };
}
