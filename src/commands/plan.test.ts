import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseViewTarget, formatWeeklyPlanSummary } from './plan.js';
import type { WeeklyPlan } from '../schemas/index.js';

describe('parseViewTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-03')); // A Monday in W06
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current week when target is empty', () => {
    const result = parseViewTarget();
    expect(result).toEqual({ type: 'week', week: '2026-W06' });
  });

  it('returns current week when target is undefined', () => {
    const result = parseViewTarget(undefined);
    expect(result).toEqual({ type: 'week', week: '2026-W06' });
  });

  it('returns current week and date for "today"', () => {
    const result = parseViewTarget('today');
    expect(result).toEqual({
      type: 'day',
      week: '2026-W06',
      date: '2026-02-03',
    });
  });

  it('returns week for valid week identifier', () => {
    const result = parseViewTarget('2026-W05');
    expect(result).toEqual({ type: 'week', week: '2026-W05' });
  });

  it('returns week for another valid week identifier', () => {
    const result = parseViewTarget('2025-W52');
    expect(result).toEqual({ type: 'week', week: '2025-W52' });
  });

  it('returns day and derived week for valid date', () => {
    const result = parseViewTarget('2026-02-03');
    expect(result).toEqual({
      type: 'day',
      week: '2026-W06',
      date: '2026-02-03',
    });
  });

  it('returns day and derived week for date in different week', () => {
    const result = parseViewTarget('2026-01-27');
    expect(result).toEqual({
      type: 'day',
      week: '2026-W05',
      date: '2026-01-27',
    });
  });

  it('throws for invalid week format', () => {
    expect(() => parseViewTarget('2026-W5')).toThrow(
      "Invalid target '2026-W5'. Use format YYYY-Www (e.g., 2026-W05) or YYYY-MM-DD."
    );
  });

  it('throws for random string', () => {
    expect(() => parseViewTarget('next-week')).toThrow(
      "Invalid target 'next-week'. Use format YYYY-Www (e.g., 2026-W05) or YYYY-MM-DD."
    );
  });
});

describe('formatWeeklyPlanSummary', () => {
  it('formats week plan with meal names and prep times', () => {
    const plan: WeeklyPlan = {
      week: '2026-W06',
      generatedAt: '2026-02-03T10:00:00Z',
      days: [
        {
          date: '2026-02-03',
          meals: {
            breakfast: {
              name: 'Oatmeal with Berries',
              recipe: 'Cook oats...',
              ingredients: [],
              prepTime: 10,
              calories: 350,
              macros: { protein: 12, carbs: 45, fat: 8, fiber: 6 },
              estimatedCost: 1.5,
              servings: 1,
              leftoverOf: null,
            },
            lunch: {
              name: 'Chicken Salad Wrap',
              recipe: 'Mix chicken...',
              ingredients: [],
              prepTime: 15,
              calories: 520,
              macros: { protein: 35, carbs: 40, fat: 18, fiber: 4 },
              estimatedCost: 4.0,
              servings: 1,
              leftoverOf: null,
            },
            dinner: null,
          },
        },
      ],
      totals: {
        calories: 870,
        macros: { protein: 47, carbs: 85, fat: 26, fiber: 10 },
        estimatedCost: 5.5,
      },
    };

    const output = formatWeeklyPlanSummary(plan);

    expect(output).toContain('Meal Plan for 2026-W06');
    expect(output).toContain('Tuesday (2026-02-03)');
    expect(output).toContain('Breakfast: Oatmeal with Berries (10min)');
    expect(output).toContain('Lunch: Chicken Salad Wrap (15min)');
    expect(output).not.toContain('Dinner');
    expect(output).not.toContain('calories');
    expect(output).not.toContain('$');
  });
});
