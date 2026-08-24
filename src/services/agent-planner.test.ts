import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AgentPlanner } from './agent-planner.js';
import type { Profile } from '../schemas/index.js';

describe('AgentPlanner', () => {
  const testDir = join(process.cwd(), 'test-data-agent-planner');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

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
      cuisines: [],
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
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: {
      size: 2,
      members: [
        {
          name: 'User',
          dietaryRestrictions: [],
        },
        {
          name: 'Partner',
          dietaryRestrictions: ['vegetarian'],
        },
      ],
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };

  it('day system prompt renders the macro ranges from the profile', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });
    const prompt = planner.buildDaySystemPrompt(mockProfile);

    expect(prompt).toContain('Protein: 100-150g');
    expect(prompt).toContain('Fiber: 25-40g');
  });

  it('day initial message carries pace targets and prior meals', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });
    const pace = {
      caloriesSoFar: 2500,
      costSoFar: 30,
      daysRemaining: 6,
      weeklyCalTarget: 14000,
      paceCalories: 1917,
      paceCost: 20,
      calorieBand: { min: 13500, max: 14500 },
      weeklyBudget: 150,
    };
    const msg = planner.buildDayInitialMessage(
      [],
      [],
      30,
      '2026-01-27',
      { breakfast: 10, lunch: 15, dinner: 45 },
      pace,
      '2026-01-26: Big Breakfast',
      new Map()
    );

    expect(msg).toContain('2026-01-27');
    expect(msg).toContain('1917');
    expect(msg).toContain('20.00');
    expect(msg).toContain('2026-01-26: Big Breakfast');
  });

  it('day initial message notes the first day when no prior meals', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });
    const pace = {
      caloriesSoFar: 0,
      costSoFar: 0,
      daysRemaining: 7,
      weeklyCalTarget: 14000,
      paceCalories: 2000,
      paceCost: 21.43,
      calorieBand: { min: 13500, max: 14500 },
      weeklyBudget: 150,
    };
    const msg = planner.buildDayInitialMessage(
      [],
      [],
      30,
      '2026-01-26',
      { breakfast: 10, lunch: 15, dinner: 45 },
      pace,
      '',
      new Map()
    );
    expect(msg.toLowerCase()).toContain('first day');
  });

  it('prints per-100g nutrition and price on pantry and shopping-list lines', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const facts = new Map([
      [
        5964,
        {
          proteinPer100g: 20.8,
          carbsPer100g: 0,
          fatPer100g: 7,
          fiberPer100g: 0,
          pricePerGram: 0.012,
        },
      ],
      [
        1123,
        {
          proteinPer100g: 12.6,
          carbsPer100g: 0.7,
          fatPer100g: 9.9,
          fiberPer100g: 0,
          pricePerGram: 0.005,
        },
      ],
    ]);

    const message = planner.buildDayInitialMessage(
      [
        {
          ingredientId: 5964,
          name: 'beef, ground, 93% lean meat / 7% fat, raw',
          quantity: 650,
          unit: 'g',
          addedDate: '2026-07-27',
        },
      ],
      [{ ingredientId: 1123, name: 'egg, whole, raw', amount: 300 }],
      10,
      '2026-08-02',
      { breakfast: 10, lunch: 15, dinner: 45 },
      {
        caloriesSoFar: 0,
        costSoFar: 0,
        daysRemaining: 7,
        weeklyCalTarget: 14000,
        paceCalories: 2000,
        paceCost: 21.43,
        calorieBand: { min: 13500, max: 14500 },
        weeklyBudget: 150,
      },
      '',
      facts
    );

    expect(message).toContain('(id 5964): 650 g');
    expect(message).toContain('per 100g P20.8 C0 F7 Fb0');
    expect(message).toContain('$0.012/g');

    expect(message).toContain('(id 1123): 300 g');
    expect(message).toContain('per 100g P12.6 C0.7 F9.9 Fb0');
    expect(message).toContain('$0.005/g');
  });

  it('omits nutrition for an id missing from the facts map', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const message = planner.buildDayInitialMessage(
      [
        {
          ingredientId: 999999,
          name: 'mystery item',
          quantity: 10,
          unit: 'g',
          addedDate: '2026-07-27',
        },
      ],
      [],
      10,
      '2026-08-02',
      { breakfast: 10, lunch: 15, dinner: 45 },
      {
        caloriesSoFar: 0,
        costSoFar: 0,
        daysRemaining: 7,
        weeklyCalTarget: 14000,
        paceCalories: 2000,
        paceCost: 21.43,
        calorieBand: { min: 13500, max: 14500 },
        weeklyBudget: 150,
      },
      '',
      new Map()
    );

    expect(message).toContain('- mystery item (id 999999): 10 g\n');
    expect(message).not.toContain('per 100g');
    expect(message).not.toContain('undefined');
  });

  it('runs one conversation per day with a date-locked handler', async () => {
    type LoopOpts = {
      systemPrompt: string;
      initialMessage: string;
      toolHandler: (name: string, input: unknown) => Promise<unknown>;
    };
    const calls: LoopOpts[] = [];
    const fakeClient = {
      runAgentLoop: (opts: LoopOpts) => {
        calls.push(opts);
        return Promise.resolve({ finalText: '', toolCalls: 0, iterations: 1 });
      },
    } as unknown as import('../ai/client.js').AIClient;
    const fakeDb = {
      init: async () => {},
    } as unknown as import('./ingredient-database.js').IngredientDatabase;

    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
      aiClient: fakeClient,
      ingredientDb: fakeDb,
    });

    const plan = await planner.generateWeeklyPlan(
      mockProfile,
      { items: [] },
      '2026-01-26--2026-02-01',
      testDir
    );

    expect(calls).toHaveLength(7);
    expect(calls[0].initialMessage).toContain('2026-01-26');
    expect(calls[6].initialMessage).toContain('2026-02-01');

    const offDate = (await calls[0].toolHandler('add_meal', {
      date: '2026-01-27',
      slot: 'breakfast',
      name: 'x',
      recipe: 'x',
      ingredients: [],
      prepTime: 5,
      servings: 1,
    })) as { success: boolean };
    expect(offDate.success).toBe(false);

    expect(plan.week).toBe('2026-01-26--2026-02-01');
  });
});
