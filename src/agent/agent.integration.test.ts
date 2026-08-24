import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AgentPlanner } from '../services/agent-planner.js';
import type { Profile, Pantry } from '../schemas/index.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)('AgentPlanner Integration', () => {
  const testDir = join(process.cwd(), 'test-data-agent');
  let planner: AgentPlanner;

  const mockProfile: Profile = {
    goals: {
      dailyCalories: 2000,
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: ['italian', 'asian'],
      maxPrepTime: {
        monday: { breakfast: 10, lunch: 15, dinner: 45 },
        tuesday: { breakfast: 10, lunch: 15, dinner: 45 },
        wednesday: { breakfast: 10, lunch: 15, dinner: 45 },
        thursday: { breakfast: 10, lunch: 15, dinner: 45 },
        friday: { breakfast: 10, lunch: 15, dinner: 45 },
        saturday: { breakfast: 30, lunch: 30, dinner: 60 },
        sunday: { breakfast: 30, lunch: 30, dinner: 60 },
      },
      slotNotes: { breakfast: '', lunch: '', dinner: '' },
      complexityTolerance: 'medium',
    },
    constraints: {
      skillLevel: 'intermediate',
      kitchenware: ['oven', 'stovetop'],
    },
    household: {
      size: 2,
      members: [
        { name: 'User', dietaryRestrictions: [] },
        { name: 'Partner', dietaryRestrictions: ['vegetarian'] },
      ],
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };

  const mockPantry: Pantry = {
    items: [
      {
        ingredientId: 1,
        name: 'rice',
        quantity: 2000,
        unit: 'g',
        addedDate: '2026-01-30',
      },
      {
        ingredientId: 2,
        name: 'olive oil',
        quantity: 1000,
        unit: 'g',
        addedDate: '2026-01-30',
      },
    ],
  };

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });

    planner = new AgentPlanner({
      anthropicApiKey: ANTHROPIC_API_KEY!,
      dataDir: testDir,
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  it('generates a weekly plan using the agent loop', async () => {
    const plan = await planner.generateWeeklyPlan(
      mockProfile,
      mockPantry,
      '2026-01-26--2026-02-01',
      testDir
    );

    expect(plan.week).toBe('2026-01-26--2026-02-01');
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.totals.calories).toBeGreaterThan(0);
  }, 120000);
});
