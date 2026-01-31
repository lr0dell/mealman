// src/agent/agent.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentPlanner } from '../services/agent-planner.js';
import type { Profile, Pantry } from '../schemas/index.js';

// This test requires ANTHROPIC_API_KEY to be set
// Skip in CI by checking for the key
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)('AgentPlanner Integration', () => {
  const testDir = join(process.cwd(), 'test-data-agent');
  let planner: AgentPlanner;

  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
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
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 30,
        saturday: 60,
        sunday: 60,
      },
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
      { name: 'rice', quantity: 2, unit: 'kg', addedDate: '2026-01-30' },
      {
        name: 'olive oil',
        quantity: 1,
        unit: 'liter',
        addedDate: '2026-01-30',
      },
    ],
  };

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'knowledge'), { recursive: true });

    // Seed some ingredients
    const ingredients = {
      'chicken breast': {
        name: 'chicken breast',
        pricePerUnit: 11,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      rice: {
        name: 'rice',
        pricePerUnit: 2.5,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        fiberPer100g: 0.4,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
      broccoli: {
        name: 'broccoli',
        pricePerUnit: 3,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 2.8,
        carbsPer100g: 7,
        fatPer100g: 0.4,
        fiberPer100g: 2.6,
        confidence: 'manual',
        lastUpdated: '2026-01-30',
      },
    };
    writeFileSync(
      join(testDir, 'knowledge', 'ingredients.json'),
      JSON.stringify(ingredients, null, 2)
    );

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
      '2026-W05',
      testDir
    );

    expect(plan.week).toBe('2026-W05');
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.totals.calories).toBeGreaterThan(0);
  }, 120000); // 2 minute timeout for API calls
});
