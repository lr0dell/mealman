# View Meal Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `meal plan view [target]` command to display meal plans at various granularities (week, day, today).

**Architecture:** Add parseViewTarget() for argument parsing, formatWeeklyPlanSummary() and formatDayPlanSummary() for lean output, viewPlan() as orchestrator, and wire into CLI. TDD throughout.

**Tech Stack:** TypeScript, Vitest, Commander.js, Zod schemas

---

## Task 1: parseViewTarget - Empty Input

**Files:**
- Create: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Create new test file `src/commands/plan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseViewTarget } from './plan.js';

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
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - parseViewTarget is not exported

**Step 3: Write minimal implementation**

Add to `src/commands/plan.ts`:

```typescript
export type ViewTarget = {
  type: 'week' | 'day';
  week: string;
  date?: string;
};

export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeek() };
  }
  throw new Error('Not implemented');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): add parseViewTarget for empty input"
```

---

## Task 2: parseViewTarget - "today" Input

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add to the `parseViewTarget` describe block in `src/commands/plan.test.ts`:

```typescript
  it('returns current week and date for "today"', () => {
    const result = parseViewTarget('today');
    expect(result).toEqual({ type: 'day', week: '2026-W06', date: '2026-02-03' });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Write minimal implementation**

Update `parseViewTarget` in `src/commands/plan.ts`:

```typescript
export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeek() };
  }

  if (target === 'today') {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    return { type: 'day', week: getCurrentWeek(), date };
  }

  throw new Error('Not implemented');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): parseViewTarget handles 'today'"
```

---

## Task 3: parseViewTarget - Week Identifier Input

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add to the `parseViewTarget` describe block:

```typescript
  it('returns week for valid week identifier', () => {
    const result = parseViewTarget('2026-W05');
    expect(result).toEqual({ type: 'week', week: '2026-W05' });
  });

  it('returns week for another valid week identifier', () => {
    const result = parseViewTarget('2025-W52');
    expect(result).toEqual({ type: 'week', week: '2025-W52' });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Write minimal implementation**

Update `parseViewTarget` in `src/commands/plan.ts`:

```typescript
const WEEK_REGEX = /^\d{4}-W\d{2}$/;

export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeek() };
  }

  if (target === 'today') {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    return { type: 'day', week: getCurrentWeek(), date };
  }

  if (WEEK_REGEX.test(target)) {
    return { type: 'week', week: target };
  }

  throw new Error('Not implemented');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): parseViewTarget handles week identifiers"
```

---

## Task 4: parseViewTarget - Date Input

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add to the `parseViewTarget` describe block:

```typescript
  it('returns day and derived week for valid date', () => {
    const result = parseViewTarget('2026-02-03');
    expect(result).toEqual({ type: 'day', week: '2026-W06', date: '2026-02-03' });
  });

  it('returns day and derived week for date in different week', () => {
    const result = parseViewTarget('2026-01-27');
    expect(result).toEqual({ type: 'day', week: '2026-W05', date: '2026-01-27' });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Write minimal implementation**

Update `src/commands/plan.ts`:

```typescript
const WEEK_REGEX = /^\d{4}-W\d{2}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getWeekIdentifier(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000;
  const weekNum = Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeek() };
  }

  if (target === 'today') {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    return { type: 'day', week: getCurrentWeek(), date };
  }

  if (WEEK_REGEX.test(target)) {
    return { type: 'week', week: target };
  }

  if (DATE_REGEX.test(target)) {
    const date = new Date(target + 'T00:00:00');
    return { type: 'day', week: getWeekIdentifier(date), date: target };
  }

  throw new Error('Not implemented');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): parseViewTarget handles date input"
```

---

## Task 5: parseViewTarget - Invalid Input

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add to the `parseViewTarget` describe block:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - throws generic "Not implemented" instead of specific message

**Step 3: Write minimal implementation**

Update the final throw in `parseViewTarget`:

```typescript
  throw new Error(
    `Invalid target '${target}'. Use format YYYY-Www (e.g., 2026-W05) or YYYY-MM-DD.`
  );
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): parseViewTarget validates input format"
```

---

## Task 6: formatWeeklyPlanSummary

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add new describe block to `src/commands/plan.test.ts`:

```typescript
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
```

Add import at top:
```typescript
import { parseViewTarget, formatWeeklyPlanSummary } from './plan.js';
import type { WeeklyPlan } from '../schemas/index.js';
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - formatWeeklyPlanSummary is not exported

**Step 3: Write minimal implementation**

Add to `src/commands/plan.ts`:

```typescript
function getDayName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
}

export function formatWeeklyPlanSummary(plan: WeeklyPlan): string {
  const lines: string[] = [`Meal Plan for ${plan.week}`, ''];

  for (const day of plan.days) {
    const dayName = getDayName(day.date);
    lines.push(`## ${dayName} (${day.date})`);

    const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
    for (const mealType of mealTypes) {
      const meal = day.meals[mealType];
      if (meal) {
        const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        lines.push(`  ${label}: ${meal.name} (${meal.prepTime}min)`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): add formatWeeklyPlanSummary"
```

---

## Task 7: formatDayPlanSummary

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add new describe block to `src/commands/plan.test.ts`:

```typescript
import { parseViewTarget, formatWeeklyPlanSummary, formatDayPlanSummary } from './plan.js';
import type { WeeklyPlan, DayPlan } from '../schemas/index.js';
```

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - formatDayPlanSummary is not exported

**Step 3: Write minimal implementation**

Add to `src/commands/plan.ts`:

```typescript
import type { WeeklyPlan, Meal, DayPlan } from '../schemas/index.js';
```

```typescript
export function formatDayPlanSummary(day: DayPlan): string {
  const dayName = getDayName(day.date);
  const lines: string[] = [`Meals for ${dayName} (${day.date})`, ''];

  const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
  for (const mealType of mealTypes) {
    const meal = day.meals[mealType];
    if (meal) {
      const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
      lines.push(`  ${label}: ${meal.name} (${meal.prepTime}min)`);
    }
  }

  return lines.join('\n').trim();
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): add formatDayPlanSummary"
```

---

## Task 8: viewPlan - Week Found (Summary)

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add setup and new describe block to `src/commands/plan.test.ts`:

```typescript
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data/index.js';
import {
  parseViewTarget,
  formatWeeklyPlanSummary,
  formatDayPlanSummary,
  viewPlan,
} from './plan.js';
```

```typescript
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
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - viewPlan is not exported

**Step 3: Write minimal implementation**

Add to `src/commands/plan.ts`:

```typescript
import { DataStore } from '../data/store.js';
```

```typescript
export async function viewPlan(
  store: DataStore,
  target?: string,
  detailed?: boolean
): Promise<string> {
  const parsed = parseViewTarget(target);
  const plan = await store.getWeeklyPlan(parsed.week);

  if (!plan) {
    return `No meal plan found for ${parsed.week}. Run 'meal plan week' to generate one.`;
  }

  if (parsed.type === 'week') {
    return detailed ? formatWeeklyPlan(plan) : formatWeeklyPlanSummary(plan);
  }

  // Day view - will implement in next task
  throw new Error('Day view not implemented');
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): add viewPlan for week summary"
```

---

## Task 9: viewPlan - Week Not Found

**Files:**
- Modify: `src/commands/plan.test.ts`

**Step 1: Write the failing test**

Add to the `viewPlan` describe block:

```typescript
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
```

**Step 2: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS (already implemented)

**Step 3: Commit**

```bash
git add src/commands/plan.test.ts
git commit -m "test(plan): add viewPlan not found tests"
```

---

## Task 10: viewPlan - Day View

**Files:**
- Modify: `src/commands/plan.test.ts`
- Modify: `src/commands/plan.ts`

**Step 1: Write the failing test**

Add to the `viewPlan` describe block:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: FAIL - throws "Day view not implemented"

**Step 3: Write minimal implementation**

Update `viewPlan` in `src/commands/plan.ts`:

```typescript
export async function viewPlan(
  store: DataStore,
  target?: string,
  detailed?: boolean
): Promise<string> {
  const parsed = parseViewTarget(target);
  const plan = await store.getWeeklyPlan(parsed.week);

  if (!plan) {
    return `No meal plan found for ${parsed.week}. Run 'meal plan week' to generate one.`;
  }

  if (parsed.type === 'week') {
    return detailed ? formatWeeklyPlan(plan) : formatWeeklyPlanSummary(plan);
  }

  // Day view
  const day = plan.days.find((d) => d.date === parsed.date);
  if (!day) {
    return `No meals found for ${parsed.date} in plan ${parsed.week}.`;
  }

  if (detailed) {
    const lines = [`Meals for ${getDayName(day.date)} (${day.date})`, ''];
    const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
    for (const mealType of mealTypes) {
      const meal = day.meals[mealType];
      if (meal) {
        lines.push(formatMeal(mealType, meal));
        lines.push('');
      }
    }
    return lines.join('\n').trim();
  }

  return formatDayPlanSummary(day);
}
```

Also need to export `formatMeal` - change `function formatMeal` to `export function formatMeal`.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat(plan): add viewPlan day view"
```

---

## Task 11: viewPlan - Detailed Flag

**Files:**
- Modify: `src/commands/plan.test.ts`

**Step 1: Write the failing test**

Add to the `viewPlan` describe block:

```typescript
  it('returns detailed output for week when flag is true', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store, undefined, true);

    expect(result).toContain('Meal Plan for 2026-W06');
    expect(result).toContain('Calories: 350');
    expect(result).toContain('Weekly Totals');
  });

  it('returns detailed output for day when flag is true', async () => {
    await store.saveWeeklyPlan(samplePlan);

    const result = await viewPlan(store, 'today', true);

    expect(result).toContain('Calories: 350');
    expect(result).toContain('P: 12g');
  });
```

**Step 2: Run test to verify it passes**

Run: `npm run test:run -- src/commands/plan.test.ts`
Expected: PASS (already implemented)

**Step 3: Commit**

```bash
git add src/commands/plan.test.ts
git commit -m "test(plan): add viewPlan detailed flag tests"
```

---

## Task 12: CLI Integration

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/commands/index.ts` (if needed for exports)

**Step 1: Update exports**

Check `src/commands/index.ts` and add `viewPlan` export if not already there:

```typescript
export { viewPlan } from './plan.js';
```

**Step 2: Add CLI command**

Add to `src/cli/index.ts` imports:

```typescript
import {
  // ... existing imports
  viewPlan,
} from '../commands/index.js';
```

Add after the `plan adjust` command (around line 134):

```typescript
  plan
    .command('view [target]')
    .description('View meal plan (current week, specific week, date, or "today")')
    .option('-d, --detailed', 'Show full details including recipes and nutrition')
    .action(async (target: string | undefined, options: { detailed?: boolean }) => {
      const store = new DataStore(getDataDir());
      await store.init();

      try {
        const output = await viewPlan(store, target, options.detailed);
        console.log(output);
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
        } else {
          console.error('An error occurred');
        }
        process.exit(1);
      }
    });
```

**Step 3: Manual verification**

Run: `npm run build && ./dist/index.js plan view --help`
Expected: Shows help with [target] argument and -d flag

**Step 4: Commit**

```bash
git add src/cli/index.ts src/commands/index.ts
git commit -m "feat(cli): add 'meal plan view' command"
```

---

## Task 13: Final Integration Test

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual smoke test**

If you have an existing plan:
```bash
npm run build
./dist/index.js plan view
./dist/index.js plan view today
./dist/index.js plan view -d
```

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for plan view command"
```
