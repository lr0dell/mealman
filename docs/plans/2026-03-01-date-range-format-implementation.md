# Date Range Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `YYYY-WXX` week identifiers with `YYYY-MM-DD--YYYY-MM-DD` date-range format throughout the codebase.

**Architecture:** Create a single `src/utils/week.ts` utility module with all date-range logic. Update the schema regex, then update each consumer (commands, services, CLI, tests) one at a time. No migration of old data files.

**Tech Stack:** TypeScript, Zod (schema validation), Vitest (testing)

---

### Task 1: Create week utility module with tests

**Files:**
- Create: `src/utils/week.ts`
- Create: `src/utils/week.test.ts`

**Step 1: Write the failing tests**

Create `src/utils/week.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeekRange, toWeekKey, parseWeekKey, getWeekDates, getCurrentWeekKey } from './week.js';

describe('week utilities', () => {
  describe('getWeekRange', () => {
    it('returns Monday-Sunday range for a Monday', () => {
      const date = new Date('2026-01-26T12:00:00'); // Monday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('returns Monday-Sunday range for a Wednesday', () => {
      const date = new Date('2026-01-28T12:00:00'); // Wednesday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('returns Monday-Sunday range for a Sunday', () => {
      const date = new Date('2026-02-01T12:00:00'); // Sunday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });

    it('handles year boundaries', () => {
      const date = new Date('2025-12-31T12:00:00'); // Wednesday
      const range = getWeekRange(date);
      expect(range).toEqual({ start: '2025-12-29', end: '2026-01-04' });
    });

    it('defaults to current date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-10T12:00:00')); // Tuesday
      const range = getWeekRange();
      expect(range).toEqual({ start: '2026-02-09', end: '2026-02-15' });
      vi.useRealTimers();
    });
  });

  describe('toWeekKey', () => {
    it('joins start and end with --', () => {
      expect(toWeekKey({ start: '2026-01-26', end: '2026-02-01' })).toBe('2026-01-26--2026-02-01');
    });
  });

  describe('parseWeekKey', () => {
    it('splits key into start and end', () => {
      expect(parseWeekKey('2026-01-26--2026-02-01')).toEqual({ start: '2026-01-26', end: '2026-02-01' });
    });
  });

  describe('getWeekDates', () => {
    it('returns 7 dates from Monday to Sunday', () => {
      const dates = getWeekDates('2026-01-26--2026-02-01');
      expect(dates).toEqual([
        '2026-01-26', '2026-01-27', '2026-01-28', '2026-01-29',
        '2026-01-30', '2026-01-31', '2026-02-01',
      ]);
    });
  });

  describe('getCurrentWeekKey', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns current week as key', () => {
      vi.setSystemTime(new Date('2026-02-10T12:00:00'));
      expect(getCurrentWeekKey()).toBe('2026-02-09--2026-02-15');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/week.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/utils/week.ts`:

```typescript
export interface WeekRange {
  start: string; // YYYY-MM-DD (Monday)
  end: string;   // YYYY-MM-DD (Sunday)
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekRange(date?: Date): WeekRange {
  const d = date ?? new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = (day + 6) % 7; // days since Monday

  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatDate(monday), end: formatDate(sunday) };
}

export function toWeekKey(range: WeekRange): string {
  return `${range.start}--${range.end}`;
}

export function parseWeekKey(key: string): WeekRange {
  const [start, end] = key.split('--');
  return { start, end };
}

export function getWeekDates(weekKey: string): string[] {
  const { start } = parseWeekKey(weekKey);
  const monday = new Date(start + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

export function getCurrentWeekKey(): string {
  return toWeekKey(getWeekRange());
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/week.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/utils/week.ts src/utils/week.test.ts
git commit -m "feat: add week date-range utility module"
```

---

### Task 2: Update schema regex

**Files:**
- Modify: `src/schemas/plan.ts:46`
- Modify: `src/schemas/plan.test.ts`

**Step 1: Update the test to use new format**

In `src/schemas/plan.test.ts`, change the `week` field in the "validates a weekly plan" test:

```typescript
// Old:
week: '2026-W05',
// New:
week: '2026-01-27--2026-02-02',
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/schemas/plan.test.ts`
Expected: FAIL — regex doesn't match new format

**Step 3: Update the schema regex**

In `src/schemas/plan.ts`, change line 46:

```typescript
// Old:
week: z.string().regex(/^\d{4}-W\d{2}$/),
// New:
week: z.string().regex(/^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}$/),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/schemas/plan.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/schemas/plan.ts src/schemas/plan.test.ts
git commit -m "feat: update WeeklyPlanSchema to date-range format"
```

---

### Task 3: Update commands/plan.ts — core logic

**Files:**
- Modify: `src/commands/plan.ts`
- Modify: `src/commands/plan.test.ts`

**Step 1: Update plan.test.ts to use new format**

Replace all week string expectations. The key changes:

1. `2026-02-10` is a Tuesday. `getWeekRange(new Date('2026-02-10'))` → Monday 2026-02-09 to Sunday 2026-02-15. So `getCurrentWeekKey()` with system time `2026-02-10` → `'2026-02-09--2026-02-15'`.

2. `2026-01-27` is a Monday. `getWeekRange(new Date('2026-01-27'))` → `'2026-01-27--2026-02-02'`.

3. `2026-02-04` is a Wednesday. `getWeekRange(new Date('2026-02-04'))` → Monday `'2026-02-02--2026-02-08'`.

Replace the full `plan.test.ts` `parseViewTarget` describe block tests:

- `'2026-W06'` → `'2026-02-09--2026-02-15'` (current week for fake time 2026-02-10)
- `'2026-W04'` → `'2026-01-27--2026-02-02'` (week containing 2026-01-27)
- `'2026-W05'` → `'2026-02-02--2026-02-08'` (week containing 2026-02-04)
- Week input tests: `parseViewTarget('2026-W05')` → `parseViewTarget('2026-01-27--2026-02-02')`
- Error message changes: update expected error text

The `formatWeeklyPlanSummary` test: change `week: '2026-W06'` to `week: '2026-02-09--2026-02-15'` and update assertion `'Meal Plan for 2026-W06'` → `'Meal Plan for 2026-02-09 to 2026-02-15'`.

The `viewPlan` tests: change all `week: '2026-W06'` in `samplePlan` to `'2026-02-09--2026-02-15'`, and update all assertions like `'Meal Plan for 2026-W06'` → `'Meal Plan for 2026-02-09 to 2026-02-15'`, `'No meal plan found for 2026-W06'` → `'No meal plan found for 2026-02-09--2026-02-15'`, etc.

For the `'2026-W01'` test, replace with `'2026-01-05--2026-01-11'`.

For `'2026-02-04'` not-found test: that date falls in week `2026-02-02--2026-02-08`, which has no plan saved, so the assertion becomes `'No meal plan found for 2026-02-02--2026-02-08'`.

The error test for `'2026-W5'` (invalid format) stays — it should still throw since it doesn't match the new WEEK_REGEX either. Update expected error message text.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/plan.test.ts`
Expected: FAIL — old format still in source

**Step 3: Update plan.ts implementation**

Replace the full `src/commands/plan.ts` with the updated version:

1. Add import at top: `import { getWeekRange, toWeekKey, parseWeekKey, getCurrentWeekKey } from '../utils/week.js';`
2. Change `WEEK_REGEX` to: `const WEEK_REGEX = /^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}$/;`
3. Replace `generateWeekPlan` function — remove the manual week calculation, use `getCurrentWeekKey()`:

```typescript
export async function generateWeekPlan(dataDir: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const store = new DataStore(dataDir);
  await store.init();

  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  const week = getCurrentWeekKey();
  const { start, end } = parseWeekKey(week);

  console.log(`Generating meal plan for ${start} to ${end}...`);
  console.log('This may take a minute as the AI plans each meal.');

  const planner = new AgentPlanner({
    anthropicApiKey: apiKey,
    dataDir,
  });

  const plan = await planner.generateWeeklyPlan(profile, pantry, week, dataDir);

  await store.saveWeeklyPlan(plan);

  console.log(`\nPlan generated for ${start} to ${end}:`);
  console.log(`- ${plan.days.length} days planned`);
  console.log(`- Total calories: ${plan.totals.calories}`);
  console.log(`- Estimated cost: $${plan.totals.estimatedCost.toFixed(2)}`);
}
```

4. Replace `formatWeeklyPlan` — change `plan.week` display:

```typescript
export function formatWeeklyPlan(plan: WeeklyPlan): string {
  const { start, end } = parseWeekKey(plan.week);
  const lines: string[] = [
    `Meal Plan for ${start} to ${end}`,
    `Generated: ${plan.generatedAt}`,
    '',
  ];
  // ... rest unchanged
```

5. Remove old `getWeekIdentifier` function entirely.

6. Replace `getCurrentWeek` to use new utility:

```typescript
export function getCurrentWeek(): string {
  return getCurrentWeekKey();
}
```

7. Update `parseViewTarget`:

```typescript
export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeekKey() };
  }

  if (target === 'today') {
    const now = new Date();
    const date = formatDateString(now);
    return { type: 'day', week: getCurrentWeekKey(), date };
  }

  if (WEEK_REGEX.test(target)) {
    return { type: 'week', week: target };
  }

  if (DATE_REGEX.test(target)) {
    const date = new Date(target + 'T12:00:00');
    const weekKey = toWeekKey(getWeekRange(date));
    return { type: 'day', week: weekKey, date: target };
  }

  throw new Error(
    `Invalid target '${target}'. Use format YYYY-MM-DD--YYYY-MM-DD (e.g., 2026-01-27--2026-02-02) or YYYY-MM-DD.`
  );
}
```

Add a helper since we need date formatting in parseViewTarget:

```typescript
function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

8. Update `formatWeeklyPlanSummary`:

```typescript
export function formatWeeklyPlanSummary(plan: WeeklyPlan): string {
  const { start, end } = parseWeekKey(plan.week);
  const lines: string[] = [`Meal Plan for ${start} to ${end}`, ''];
  // ... rest unchanged
```

9. Update `viewPlan` error messages:

```typescript
if (!plan) {
  return `No meal plan found for ${parsed.week}. Run 'meal plan week' to generate one.`;
}
```
(This line is already correct — it uses `parsed.week` which will now be the date-range key.)

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/plan.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/plan.test.ts
git commit -m "feat: update plan commands to use date-range format"
```

---

### Task 4: Update agent-planner.ts

**Files:**
- Modify: `src/services/agent-planner.ts`
- Modify: `src/services/agent-planner.test.ts`

**Step 1: Update the integration-style test**

In `src/services/agent-planner.test.ts`, no week-format-specific tests exist (they test prompt content, not week format). No test changes needed here.

**Step 2: Update agent-planner.ts**

1. Add import: `import { getWeekDates, parseWeekKey } from '../utils/week.js';`

2. Replace `buildInitialMessage`:

```typescript
buildInitialMessage(profile: Profile, pantry: Pantry, week: string): string {
  const dates = getWeekDates(week);
  const { start, end } = parseWeekKey(week);
  const pantryItems = pantry.items.length
    ? pantry.items
        .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`)
        .join('\n')
    : 'Empty';

  return `Create a meal plan for ${start} to ${end}.

Pantry:
${pantryItems}

Start by checking get_plan_state, then add meals day by day. Use lookup_ingredient for any ingredient before using it.`;
}
```

3. Remove the private `getWeekDates` method entirely (lines 114-139). It's replaced by the import from `../utils/week.js`.

**Step 3: Run tests**

Run: `npx vitest run src/services/agent-planner.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/services/agent-planner.ts
git commit -m "feat: update agent-planner to use shared week utilities"
```

---

### Task 5: Update tool-handlers and finalize_plan note

**Files:**
- Modify: `src/agent/tool-handlers.ts:334`
- Modify: `src/agent/tool-handlers.test.ts`

**Step 1: Update test week strings**

In `src/agent/tool-handlers.test.ts`, change all `'2026-W05'` to `'2026-01-27--2026-02-02'`:
- Line 71: `planState = new PlanState('2026-01-27--2026-02-02', ...)`
- Line 225: `const pantryState = new PlanState('2026-01-27--2026-02-02', ...)`

**Step 2: Update tool-handlers.ts finalize_plan note**

In `src/agent/tool-handlers.ts`, the `handleFinalizePlan` function generates `autoNotes` containing `Week ${plan.week} complete.`. Update to use the parsed range:

Add import: `import { parseWeekKey } from '../utils/week.js';`

Change line 334:

```typescript
// Old:
`Week ${plan.week} complete.`,
// New:
const { start, end } = parseWeekKey(plan.week);
// ... then in the array:
`Plan ${start} to ${end} complete.`,
```

**Step 3: Run tests**

Run: `npx vitest run src/agent/tool-handlers.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/agent/tool-handlers.ts src/agent/tool-handlers.test.ts
git commit -m "feat: update tool handlers to use date-range format"
```

---

### Task 6: Update plan-state tests

**Files:**
- Modify: `src/services/plan-state.test.ts`

**Step 1: Update week strings in tests**

Change all `'2026-W05'` to `'2026-01-27--2026-02-02'`:
- Line 58: `state = new PlanState('2026-01-27--2026-02-02', ...)`
- Line 232: `const state = new PlanState('2026-01-27--2026-02-02', ...)`
- Line 272: same
- Line 321: same
- Line 368: same

**Step 2: Run tests**

Run: `npx vitest run src/services/plan-state.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/services/plan-state.test.ts
git commit -m "test: update plan-state tests to use date-range format"
```

---

### Task 7: Update remaining test files

**Files:**
- Modify: `src/ai/prompts.test.ts`
- Modify: `src/services/planner.test.ts`
- Modify: `src/commands/shop.test.ts`
- Modify: `src/agent/agent.integration.test.ts`

**Step 1: Update all week strings**

`src/ai/prompts.test.ts`:
- Line 18: `'2026-W05'` → `'2026-01-27--2026-02-02'`
- Line 20: assertion `'2026-W05'` → `'2026-01-27--2026-02-02'`
- Line 37: `'2026-W05'` → `'2026-01-27--2026-02-02'`

`src/services/planner.test.ts`:
- Line 29: `week: '2026-W05'` → `week: '2026-01-27--2026-02-02'`
- Line 62: `'2026-W05'` → `'2026-01-27--2026-02-02'`
- Line 65: `'2026-W05'` → `'2026-01-27--2026-02-02'`
- Line 76: `'2026-W05'` → `'2026-01-27--2026-02-02'`

`src/commands/shop.test.ts`:
- Line 11: `week: '2026-W05'` → `week: '2026-01-27--2026-02-02'`

`src/agent/agent.integration.test.ts`:
- Line 143: `'2026-W05'` → `'2026-01-27--2026-02-02'`
- Line 147: `'2026-W05'` → `'2026-01-27--2026-02-02'`

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/ai/prompts.test.ts src/services/planner.test.ts src/commands/shop.test.ts src/agent/agent.integration.test.ts
git commit -m "test: update remaining tests to use date-range format"
```

---

### Task 8: Update CLI index.ts

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: Update CLI to use new format in display**

In `src/cli/index.ts`:

1. Add import: `import { getCurrentWeekKey, parseWeekKey } from '../utils/week.js';`

2. Update `plan week` action (line 146-147): replace `getCurrentWeek()` with `getCurrentWeekKey()` and format display:

```typescript
const week = getCurrentWeekKey();
const { start, end } = parseWeekKey(week);
console.log(`Generating meal plan for ${start} to ${end}...`);
```

3. Update `shop list` action (line 230-234): replace `getCurrentWeek()` with `getCurrentWeekKey()` and update display:

```typescript
const week = getCurrentWeekKey();
const plan = await store.getWeeklyPlan(week);

if (!plan) {
  const { start, end } = parseWeekKey(week);
  console.log(`No plan found for ${start} to ${end}. Run 'meal plan week' first.`);
  return;
}
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All PASS (CLI is not directly tested but shouldn't break anything)

**Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: update CLI to display date-range format"
```

---

### Task 9: Update AI prompts

**Files:**
- Modify: `src/ai/prompts.ts:31`

**Step 1: Update `buildWeeklyPlanPrompt`**

The prompt currently says `Generate a complete 7-day meal plan for week ${week}.` and includes `"week": "${week}"` in the JSON template. Both will now contain the date-range format naturally since `week` is passed in.

Add import and update display:

```typescript
import { parseWeekKey } from '../utils/week.js';
```

Update the prompt text:

```typescript
export function buildWeeklyPlanPrompt(
  profile: Profile,
  pantry: Pantry,
  week: string
): string {
  const { start, end } = parseWeekKey(week);
  const pantrySection = formatPantryForPrompt(pantry);
  const profileSection = formatProfileForPrompt(profile);

  return `Generate a complete 7-day meal plan for ${start} to ${end}.
// ... rest uses ${week} for the JSON template "week" field
```

**Step 2: Run tests**

Run: `npx vitest run src/ai/prompts.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/ai/prompts.ts
git commit -m "feat: update AI prompts to use date-range format"
```

---

### Task 10: Final verification

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run lint**

Run: `npx eslint src/`
Expected: No errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Grep for any remaining YYYY-WXX references**

Run: `grep -rn 'W\d\d' src/ --include='*.ts' | grep -v node_modules | grep -v '.test.ts'`

Should return no matches in source files (test files with old format comments are OK to leave).

Also run: `grep -rn '\d{4}-W' src/ --include='*.ts'`

Should return no matches — all old regex patterns should be gone.

**Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup of date-range format migration"
```
