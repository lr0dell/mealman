// src/agent/tools.ts
import type { ToolDefinition } from './types.js';

/** Shared by add_meal and modify_meal, which take identical ingredient lists. */
const MEAL_INGREDIENTS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ingredientId: {
        type: 'number',
        description:
          'Numeric id from the pantry list, the shopping list, or lookup_ingredient',
      },
      amountGrams: {
        type: 'number',
        minimum: 0,
        description: 'Amount in grams. Must be greater than 0.',
      },
    },
    required: ['ingredientId', 'amountGrams'],
  },
};

export const PLANNING_TOOLS: ToolDefinition[] = [
  {
    name: 'get_plan_state',
    description:
      'Get the current plan state including meals planned so far, daily totals, weekly totals, and remaining budget. Call this to see what has been planned and what targets remain.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_meal',
    description:
      'Add a meal to a specific day and slot (breakfast/lunch/dinner). Ingredients are identified by numeric ingredientId, not by name. The system calculates nutrition from the id.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        name: { type: 'string', description: 'Name of the meal' },
        recipe: { type: 'string', description: 'Brief cooking instructions' },
        ingredients: MEAL_INGREDIENTS_SCHEMA,
        prepTime: {
          type: 'number',
          description: 'Preparation time in minutes',
        },
        servings: { type: 'number', description: 'Number of servings' },
        leftoverOf: {
          type: 'string',
          description: 'If this uses leftovers, name of original meal',
        },
      },
      required: [
        'date',
        'slot',
        'name',
        'recipe',
        'ingredients',
        'prepTime',
        'servings',
      ],
    },
  },
  {
    name: 'modify_meal',
    description:
      'Replace an existing meal with a new one. Use this to backtrack and adjust earlier meals if targets are off-track.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        name: { type: 'string', description: 'Name of the meal' },
        recipe: { type: 'string', description: 'Brief cooking instructions' },
        ingredients: MEAL_INGREDIENTS_SCHEMA,
        prepTime: {
          type: 'number',
          description: 'Preparation time in minutes',
        },
        servings: { type: 'number', description: 'Number of servings' },
        leftoverOf: {
          type: 'string',
          description: 'If this uses leftovers, name of original meal',
        },
      },
      required: [
        'date',
        'slot',
        'name',
        'recipe',
        'ingredients',
        'prepTime',
        'servings',
      ],
    },
  },
  {
    name: 'remove_meal',
    description: 'Remove a meal from a slot (e.g., if user skips breakfast).',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
      },
      required: ['date', 'slot'],
    },
  },
  {
    name: 'lookup_ingredient',
    description:
      'Look up ingredients by name. Pass every name you need in one call. Returns, for each name, the numeric id to use in add_meal plus nutrition per 100g and price. Do not call this for items already listed in the pantry or shopping list, which include their id and nutrition.',
    input_schema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ingredient names to look up, all in one call',
        },
      },
      required: ['names'],
    },
  },
  {
    name: 'check_daily_totals',
    description:
      'Get nutrition totals for a specific day and compare against daily targets.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'finalize_plan',
    description:
      'Signal that planning is complete. Call this when all meals are planned or when you cannot meet constraints.',
    input_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Any notes or warnings about the plan',
        },
      },
    },
  },
];

// Tools handed to the per-day planning agent. Excludes weekly-scoped tools
// (e.g. get_plan_state) to keep the per-day context focused. The excluded
// tools remain defined in PLANNING_TOOLS and wired in tool-handlers.
export const DAY_PLANNING_TOOLS: ToolDefinition[] = PLANNING_TOOLS.filter(
  (t) => t.name !== 'get_plan_state'
);
