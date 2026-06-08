export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AddMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: Array<{
    name: string;
    amountGrams: number;
  }>;
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export interface ModifyMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  name: string;
  recipe: string;
  ingredients: Array<{
    name: string;
    amountGrams: number;
  }>;
  prepTime: number;
  servings: number;
  leftoverOf?: string;
}

export interface RemoveMealInput {
  date: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
}

export interface LookupIngredientInput {
  name: string;
}

export interface SearchKnowledgeBaseInput {
  query: string;
}

export interface CheckDailyTotalsInput {
  date: string;
}

export interface FinalizePlanInput {
  notes?: string;
}
