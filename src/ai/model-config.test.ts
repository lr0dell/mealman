import { describe, it, expect } from 'vitest';
import {
  resolvePlanningModelConfig,
  DEFAULT_PLANNING_MODEL,
} from './model-config.js';

describe('resolvePlanningModelConfig', () => {
  it('defaults to Sonnet 5 with thinking disabled and medium effort', () => {
    expect(resolvePlanningModelConfig({})).toEqual({
      model: DEFAULT_PLANNING_MODEL,
      thinking: 'disabled',
      effort: 'medium',
    });
  });

  it('defaults the model to claude-sonnet-5', () => {
    expect(DEFAULT_PLANNING_MODEL).toBe('claude-sonnet-5');
  });

  it('applies env overrides for model and effort', () => {
    expect(
      resolvePlanningModelConfig({
        MEAL_MODEL: 'claude-haiku-4-5-20251001',
        MEAL_THINKING: 'disabled',
        MEAL_EFFORT: 'high',
      })
    ).toEqual({
      model: 'claude-haiku-4-5-20251001',
      thinking: 'disabled',
      effort: 'high',
    });
  });

  it('rejects MEAL_THINKING=adaptive until runAgentLoop preserves thinking blocks', () => {
    expect(() =>
      resolvePlanningModelConfig({ MEAL_THINKING: 'adaptive' })
    ).toThrow(/runAgentLoop/);
  });

  it('rejects an unknown thinking mode instead of silently defaulting', () => {
    expect(() => resolvePlanningModelConfig({ MEAL_THINKING: 'on' })).toThrow(
      /MEAL_THINKING/
    );
  });

  it('rejects an unknown effort level', () => {
    expect(() => resolvePlanningModelConfig({ MEAL_EFFORT: 'turbo' })).toThrow(
      /MEAL_EFFORT/
    );
  });

  it('treats empty strings as unset', () => {
    expect(resolvePlanningModelConfig({ MEAL_MODEL: '  ' }).model).toBe(
      DEFAULT_PLANNING_MODEL
    );
  });
});
