import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MealPlanner } from './planner.js';
import { WeeklyPlanSchema } from '../schemas/index.js';
import {
  createDefaultProfile,
  createDefaultPantry,
} from '../schemas/defaults.js';

// Mock AI client
const mockChatJSON = vi.fn();
vi.mock('../ai', () => ({
  AIClient: class AIClient {
    chatJSON = mockChatJSON;
  },
  buildPlanningSystemPrompt: vi.fn().mockReturnValue('system prompt'),
  buildWeeklyPlanPrompt: vi.fn().mockReturnValue('user prompt'),
}));

describe('MealPlanner', () => {
  let planner: MealPlanner;

  beforeEach(() => {
    mockChatJSON.mockReset();
    planner = new MealPlanner('test-api-key');
  });

  it('generates a valid weekly plan', async () => {
    const mockPlan = {
      week: '2026-01-26--2026-02-01',
      generatedAt: '2026-01-29T10:00:00Z',
      days: [
        {
          date: '2026-01-27',
          meals: {
            breakfast: {
              name: 'Oatmeal',
              recipe: 'Cook oats',
              ingredients: [{ name: 'oats', amount: 0.5, unit: 'cup' }],
              prepTime: 10,
              calories: 300,
              macros: { protein: 10, carbs: 50, fat: 5, fiber: 8 },
              estimatedCost: 0.5,
              servings: 1,
              leftoverOf: null,
            },
            lunch: null,
            dinner: null,
          },
        },
      ],
      totals: {
        calories: 14000,
        macros: { protein: 1050, carbs: 1400, fat: 455, fiber: 25 },
        estimatedCost: 95,
      },
    };

    mockChatJSON.mockResolvedValue(mockPlan);

    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    const plan = await planner.generateWeeklyPlan(
      profile,
      pantry,
      '2026-01-26--2026-02-01'
    );

    expect(WeeklyPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.week).toBe('2026-01-26--2026-02-01');
  });

  it('validates AI response against schema', async () => {
    mockChatJSON.mockResolvedValue({ invalid: 'response' });

    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();

    await expect(
      planner.generateWeeklyPlan(profile, pantry, '2026-01-26--2026-02-01')
    ).rejects.toThrow();
  });
});
