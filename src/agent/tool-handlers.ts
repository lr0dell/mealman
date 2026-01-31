import { PlanState } from '../services/plan-state.js';
import { KnowledgeBase } from '../services/knowledge-base.js';
import { USDAClient } from '../services/usda-client.js';
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

export function createToolHandlers(
  planState: PlanState,
  kb: KnowledgeBase,
  usdaClient: USDAClient | null
): {
  handle: (toolName: string, input: unknown) => Promise<unknown>;
} {
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

  async function handleAddMeal(input: AddMealInput): Promise<
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
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ing of input.ingredients) {
      const entry = await kb.getIngredient(ing.name);
      if (!entry) {
        return {
          success: false,
          error: `Ingredient "${ing.name}" not found in knowledge base. Use lookup_ingredient first.`,
        };
      }
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerUnit: entry.pricePerUnit,
        unit: entry.unit,
        unitWeightGrams: entry.unitWeightGrams,
      });
    }

    // Calculate nutrition
    const nutrition = calculateMealNutrition(ingredientsWithNutrition);

    const meal: Meal = {
      name: input.name,
      recipe: input.recipe,
      ingredients: input.ingredients.map((i) => ({
        name: i.name,
        amount: i.amountGrams,
        unit: 'g',
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
    return handleAddMeal(input);
  }

  function handleRemoveMeal(input: RemoveMealInput): {
    success: true;
    remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
  } {
    planState.removeMeal(input.date, input.slot);
    return {
      success: true,
      remainingBudget: planState.getRemainingBudget(),
    };
  }

  async function handleLookupIngredient(
    input: LookupIngredientInput
  ): Promise<
    | {
        found: true;
        source: string;
        ingredient: Awaited<ReturnType<typeof kb.getIngredient>>;
      }
    | { found: false; message: string }
  > {
    // Check KB first
    const existing = await kb.getIngredient(input.name);
    if (existing) {
      return {
        found: true,
        source: 'knowledge_base',
        ingredient: existing,
      };
    }

    // Try USDA
    if (usdaClient) {
      try {
        const results = await usdaClient.searchFood(input.name);
        if (results.length > 0) {
          const best = results[0];
          const entry = {
            name: input.name,
            pricePerUnit: 5, // Default estimate
            unit: 'kg',
            unitWeightGrams: 1000,
            ...best.nutrients,
            confidence: 'usda' as const,
            usdaFdcId: best.fdcId,
            lastUpdated: new Date().toISOString().split('T')[0],
          };
          await kb.saveIngredient(input.name, entry);
          return {
            found: true,
            source: 'usda',
            ingredient: entry,
          };
        }
      } catch {
        // Fall through to AI estimate
      }
    }

    // No USDA client or not found
    return {
      found: false,
      message: usdaClient
        ? 'Ingredient not found in USDA database.'
        : 'Ingredient not found. No USDA API configured.',
    };
  }

  async function handleSearchKnowledgeBase(
    input: SearchKnowledgeBaseInput
  ): Promise<{
    results: Array<{
      name: string;
      confidence: string;
      proteinPer100g: number;
    }>;
  }> {
    const results = await kb.searchIngredients(input.query);
    return {
      results: results.map((r) => ({
        name: r.name,
        confidence: r.confidence,
        proteinPer100g: r.proteinPer100g,
      })),
    };
  }

  async function handleGetKnownIngredients(): Promise<{
    ingredients: Awaited<ReturnType<typeof kb.getAllIngredients>>;
  }> {
    const ingredients = await kb.getAllIngredients();
    return { ingredients };
  }

  function handleCheckDailyTotals(input: CheckDailyTotalsInput): {
    date: string;
    totals: {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    };
    targets: {
      calories: { min: number; max: number };
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

  function handleCheckWeeklyTotals(): {
    totals: {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    };
    remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
    mealsPlanned: number;
  } {
    const summary = planState.getSummary();
    const remaining = planState.getRemainingBudget();
    return {
      totals: summary.weeklyTotals,
      remainingBudget: remaining,
      mealsPlanned: summary.mealsPlanned,
    };
  }

  function handleFinalizePlan(input: FinalizePlanInput): {
    success: true;
    plan: ReturnType<typeof planState.toWeeklyPlan>;
    notes: string | undefined;
  } {
    const plan = planState.toWeeklyPlan();
    return {
      success: true,
      plan,
      notes: input.notes,
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
        case 'get_known_ingredients':
          return handleGetKnownIngredients();
        case 'check_daily_totals':
          return handleCheckDailyTotals(input as CheckDailyTotalsInput);
        case 'check_weekly_totals':
          return handleCheckWeeklyTotals();
        case 'finalize_plan':
          return handleFinalizePlan(input as FinalizePlanInput);
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    },
  };
}
