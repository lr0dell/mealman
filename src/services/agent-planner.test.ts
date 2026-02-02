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

  it('builds system prompt with profile info', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('1800');
    expect(prompt).toContain('2200');
    expect(prompt).toContain('150'); // budget
  });
});
