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

  it('can be instantiated with API key and data directory', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });
    expect(planner).toBeDefined();
  });

  it('day system prompt states daily macro/fiber targets and rules', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });
    const prompt = planner.buildDaySystemPrompt(mockProfile);

    expect(prompt).toContain('Protein: 100-150g');
    expect(prompt).toContain('Fiber: 25-40g');
    expect(prompt).toContain('finalize_plan');
    expect(prompt).toContain('recipe-accurate ingredient names');
    expect(prompt).toContain('chicken breast');
    expect(prompt).toContain('black beans');
    expect(prompt).toContain('encouraged');
    expect(prompt).not.toContain('MUST use pantry');
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
      mockProfile,
      { items: [] },
      '2026-01-27',
      pace,
      '2026-01-26: Big Breakfast'
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
      mockProfile,
      { items: [] },
      '2026-01-26',
      pace,
      ''
    );
    expect(msg.toLowerCase()).toContain('first day');
  });
});
