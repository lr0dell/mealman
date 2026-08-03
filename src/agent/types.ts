export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MealIngredientInput {
  /** Numeric id from the pantry list, the shopping list, or lookup_ingredient. */
  ingredientId: number;
  amountGrams: number;
}

export interface AddMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: MealIngredientInput[];
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export type ModifyMealInput = AddMealInput;

export interface RemoveMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
}

export interface LookupIngredientInput {
  names: string[];
}

export interface CheckDailyTotalsInput {
  date: string;
}

export interface FinalizePlanInput {
  notes?: string;
}
