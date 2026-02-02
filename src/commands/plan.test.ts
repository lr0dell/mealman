import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WeeklyPlan, DayPlan } from '../schemas/index.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data/index.js';
import {
  parseViewTarget,
  formatWeeklyPlanSummary,
  formatDayPlanSummary,
  viewPlan,
} from './plan.js';

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

describe('formatDayPlanSummary', () => {
  it('formats single day with meal names and prep times', () => {
    const day: DayPlan = {
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
        dinner: {
          name: 'Pasta Primavera',
          recipe: 'Boil pasta...',
          ingredients: [],
          prepTime: 25,
          calories: 680,
          macros: { protein: 20, carbs: 90, fat: 22, fiber: 8 },
          estimatedCost: 6.0,
          servings: 2,
          leftoverOf: null,
        },
      },
    };

    const output = formatDayPlanSummary(day);

    expect(output).toContain('Meals for Tuesday (2026-02-03)');
    expect(output).toContain('Breakfast: Oatmeal with Berries (10min)');
    expect(output).toContain('Lunch: Chicken Salad Wrap (15min)');
    expect(output).toContain('Dinner: Pasta Primavera (25min)');
    expect(output).not.toContain('calories');
    expect(output).not.toContain('$');
  });
});

describe('viewPlan', () => {
  const testDir = join(process.cwd(), 'test-data-plan-view');
  let store: DataStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-03'));
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  const samplePlan: WeeklyPlan = {
    week: '2026-W06',
    generatedAt: '2026-02-03T10:00:00Z',
    days: [
      {
        date: '2026-02-03',
        meals: {
          breakfast: {
            name: 'Oatmeal',
            recipe: 'Cook oats',
            ingredients: [],
            prepTime: 10,
            calories: 350,
            macros: { protein: 12, carbs: 45, fat: 8, fiber: 6 },
            estimatedCost: 1.5,
            servings: 1,
            leftoverOf: null,
          },
          lunch: null,
          dinner: null,
        },
      },
    ],
    totals: {
      calories: 350,
      macros: { protein: 12, carbs: 45, fat: 8, fiber: 6 },
      estimatedCost: 1.5,
    },
  };

  it('returns summary for current week when plan exists', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store);

    expect(result).toContain('Meal Plan for 2026-W06');
    expect(result).toContain('Oatmeal (10min)');
    expect(result).not.toContain('calories');
  });

  it('returns helpful message when no plan exists', async () => {
    const result = await viewPlan(store);

    expect(result).toBe(
      "No meal plan found for 2026-W06. Run 'meal plan week' to generate one."
    );
  });

  it('returns helpful message for specific week not found', async () => {
    const result = await viewPlan(store, '2026-W01');

    expect(result).toBe(
      "No meal plan found for 2026-W01. Run 'meal plan week' to generate one."
    );
  });

  it('returns day summary for "today"', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store, 'today');

    expect(result).toContain('Meals for Tuesday (2026-02-03)');
    expect(result).toContain('Oatmeal (10min)');
  });

  it('returns day summary for specific date', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store, '2026-02-03');

    expect(result).toContain('Meals for Tuesday (2026-02-03)');
    expect(result).toContain('Oatmeal (10min)');
  });

  it('returns not found for day not in plan', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store, '2026-02-04');

    expect(result).toContain('No meals found for 2026-02-04');
  });
});
