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
  SearchKnowledgeBaseInput,
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
    shoppingList: ReturnType<typeof planState.getShoppingListStatus>;
    pantryStatus: {
      items: ReturnType<typeof planState.getPantryStatus>;
      unusedItems: string[];
    };
  } {
    const summary = planState.getSummary();
    const remaining = planState.getRemainingBudget();
    return {
      week: planState.getWeek(),
      mealsPlanned: summary.mealsPlanned,
      weeklyTotals: summary.weeklyTotals,
      remainingBudget: remaining,
      shoppingList: planState.getShoppingListStatus(),
      pantryStatus: {
        items: planState.getPantryStatus(),
        unusedItems: planState.getUnusedPantryItems(),
      },
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
        shoppingList: {
          count: number;
          limit: number;
          warning: string | null;
        };
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
      shoppingList: planState.getShoppingListStatus(),
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

  async function handleLookupIngredient(input: LookupIngredientInput): Promise<
    | {
        found: true;
        ingredient: {
          id: number;
          name: string;
          matchedName: string;
          similarity: number;
          proteinPer100g: number;
          carbsPer100g: number;
          fatPer100g: number;
          fiberPer100g: number;
          pricePerGram: number;
        };
      }
    | {
        found: false;
        message: string;
        suggestions: Array<{ name: string; similarity: number }>;
      }
  > {
    const matches = await ingredientDb.searchIngredients(input.name, 5);

    if (matches.length === 0) {
      return {
        found: false,
        message: `No ingredients found for "${input.name}".`,
        suggestions: [],
      };
    }

    const topMatch = matches[0];

    if (topMatch.similarity >= MINIMUM_SIMILARITY) {
      return {
        found: true,
        ingredient: {
          id: topMatch.ingredient.id,
          name: input.name,
          matchedName: topMatch.ingredient.name,
          similarity: topMatch.similarity,
          proteinPer100g: topMatch.ingredient.proteinPer100g,
          carbsPer100g: topMatch.ingredient.carbsPer100g,
          fatPer100g: topMatch.ingredient.fatPer100g,
          fiberPer100g: topMatch.ingredient.fiberPer100g,
          pricePerGram: topMatch.ingredient.pricePerGram,
        },
      };
    }

    // Low confidence - return suggestions
    const suggestions = matches.map((m) => ({
      name: m.ingredient.name,
      similarity: m.similarity,
    }));

    return {
      found: false,
      message: `No confident match for "${input.name}". Please be more specific (e.g., "black beans" instead of "beans", "chicken breast" instead of "chicken").`,
      suggestions,
    };
  }

  async function handleSearchKnowledgeBase(
    input: SearchKnowledgeBaseInput
  ): Promise<{
    results: Array<{
      name: string;
      similarity: number;
      proteinPer100g: number;
    }>;
  }> {
    const matches = await ingredientDb.searchIngredients(input.query, 10);
    return {
      results: matches.map((m) => ({
        name: m.ingredient.name,
        similarity: m.similarity,
        proteinPer100g: m.ingredient.proteinPer100g,
      })),
    };
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
    const shoppingList = planState.getShoppingListStatus();
    const unusedPantry = planState.getUnusedPantryItems();
    const { start, end } = parseWeekKey(plan.week);

    const autoNotes = [
      `Plan ${start} to ${end} complete.`,
      `${summary.mealsPlanned} meals planned.`,
      `Calories: ${Math.round(plan.totals.calories)}.`,
      `Protein: ${Math.round(plan.totals.macros.protein)}g.`,
      `Cost: $${plan.totals.estimatedCost.toFixed(2)}.`,
      `Shopping list: ${shoppingList.count} items.`,
      unusedPantry.length > 0
        ? `Unused pantry: ${unusedPantry.join(', ')}.`
        : 'All pantry items incorporated.',
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
        case 'search_knowledge_base':
          return handleSearchKnowledgeBase(input as SearchKnowledgeBaseInput);
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
