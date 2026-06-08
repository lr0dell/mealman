// src/agent/tools.ts
import type { ToolDefinition } from './types.js';

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
      'Add a meal to a specific day and slot (breakfast/lunch/dinner). Provide the meal details and ingredients with amounts in grams. The system will calculate nutrition from the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        name: { type: 'string', description: 'Name of the meal' },
        recipe: { type: 'string', description: 'Brief cooking instructions' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amountGrams: { type: 'number', description: 'Amount in grams' },
            },
            required: ['name', 'amountGrams'],
          },
        },
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
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amountGrams: { type: 'number', description: 'Amount in grams' },
            },
            required: ['name', 'amountGrams'],
          },
        },
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
      'Look up nutrition data for an ingredient. Returns calories, protein, carbs, fat, fiber per 100g and price. Data comes from knowledge base, USDA, or AI estimate.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Ingredient name to look up' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_knowledge_base',
    description:
      'Search for ingredients in the knowledge base by partial name match.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
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
