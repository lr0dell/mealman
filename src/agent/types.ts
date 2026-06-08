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

export type ToolInput =
  | { tool: 'get_plan_state' }
  | { tool: 'add_meal'; input: AddMealInput }
  | { tool: 'modify_meal'; input: ModifyMealInput }
  | { tool: 'remove_meal'; input: RemoveMealInput }
  | { tool: 'lookup_ingredient'; input: LookupIngredientInput }
  | { tool: 'search_knowledge_base'; input: SearchKnowledgeBaseInput }
  | { tool: 'check_daily_totals'; input: CheckDailyTotalsInput }
  | { tool: 'check_weekly_totals' }
  | { tool: 'finalize_plan'; input: FinalizePlanInput };
