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

  it('system prompt includes success condition guidance', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    // Should explain the status field semantics
    expect(prompt).toContain('in_range');
    expect(prompt).toContain('status');
    // Should tell agent when to stop adjusting
    expect(prompt).toContain('finalize_plan');
  });

  it('system prompt explains when plan is complete', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    // Should explain that in_range means success, stop adjusting
    expect(prompt.toLowerCase()).toMatch(/in.range.*stop|stop.*in.range/i);
  });

  it('instructs agent to use recipe-accurate ingredient names', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('recipe-accurate ingredient names');
    expect(prompt).toContain('chicken breast');
    expect(prompt).toContain('black beans');
  });

  it('encourages pantry usage without requiring it', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('pantry');
    expect(prompt).toContain('encouraged');
    expect(prompt).not.toContain('MUST use pantry');
    expect(prompt).not.toContain('required to use');
  });

  it('system prompt tells agent to call finalize_plan immediately when all statuses are in_range', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt.toLowerCase()).toMatch(
      /immediately.*finalize_plan|finalize_plan.*immediately/i
    );
  });

  it('system prompt prohibits unnecessary tool calls after all statuses are in_range', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    // Must not call check_daily_totals or get_plan_state after completion
    expect(prompt.toLowerCase()).toMatch(
      /do not call|no (further|additional|more) tool|never call/i
    );
  });

  it('mentions shopping list limit', () => {
    const planner = new AgentPlanner({
      anthropicApiKey: 'test-key',
      dataDir: testDir,
    });

    const prompt = planner.buildSystemPrompt(mockProfile);

    expect(prompt).toContain('shopping list');
    expect(prompt).toContain('20');
    expect(prompt).toContain('reus');
  });
});
