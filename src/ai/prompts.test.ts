import { describe, it, expect } from 'vitest';
import { buildWeeklyPlanPrompt, buildPlanningSystemPrompt } from './prompts.js';
import {
  createDefaultProfile,
  createDefaultPantry,
} from '../schemas/defaults.js';

describe('Planning Prompts', () => {
  it('builds system prompt with guidelines', () => {
    const prompt = buildPlanningSystemPrompt();
    expect(prompt).toContain('meal planner');
    expect(prompt).toContain('JSON');
  });

  it('builds weekly plan prompt with context', () => {
    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    const prompt = buildWeeklyPlanPrompt(
      profile,
      pantry,
      '2026-01-26--2026-02-01'
    );

    expect(prompt).toContain('2026-01-26--2026-02-01');
    expect(prompt).toContain('2000'); // daily calories
    expect(prompt).toContain('protein');
  });

  it('includes pantry items in prompt', () => {
    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    pantry.items.push({
      ingredientId: 1,
      name: 'chicken breast',
      quantity: 2,
      unit: 'g',
      addedDate: '2026-01-27',
    });

    const prompt = buildWeeklyPlanPrompt(
      profile,
      pantry,
      '2026-01-26--2026-02-01'
    );
    expect(prompt).toContain('chicken breast');
  });
});
