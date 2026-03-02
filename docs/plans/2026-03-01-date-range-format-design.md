# Date Range Format Design

## Problem

The app uses `YYYY-WXX` (e.g. `2026-W05`) as the week identifier throughout. This format:
- Doesn't clearly communicate which days are covered
- Has three inconsistent week-number calculation algorithms in the codebase
- None of the algorithms follow ISO 8601 properly

## Decision

Replace `YYYY-WXX` with a date-range format: `YYYY-MM-DD--YYYY-MM-DD` (e.g. `2026-01-27--2026-02-02`).

- Always 7 days, Monday through Sunday
- `--` separator (unambiguous, won't conflict with `-` in ISO dates)
- Default start day: Monday
- Old plan files are ignored (clean break, no migration)

## Core Utility

A single set of date utility functions replaces all three current week-calculation algorithms:

- `getWeekRange(date?: Date)` - returns `{ start: string, end: string }` for the Mon-Sun week containing the given date (defaults to today)
- `toWeekKey(range)` - returns `"2026-01-27--2026-02-02"`
- `parseWeekKey(key)` - returns `{ start: string, end: string }`
- `getWeekDates(key)` - returns all 7 date strings

Monday calculation: `date.getDay()` gives 0=Sun through 6=Sat. Subtract `(day + 6) % 7` days to find Monday. Add 6 for Sunday.

## Schema Change

```typescript
// Old
week: z.string().regex(/^\d{4}-W\d{2}$/)

// New
week: z.string().regex(/^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}$/)
```

## File Storage

Plans stored as `plans/2026-01-27--2026-02-02.json` instead of `plans/2026-W05.json`.

## CLI Changes

- `meal plan week` - auto-detects current Monday-Sunday range
- `meal plan view` (no arg) - same auto-detect
- `meal plan view 2026-01-27--2026-02-02` - explicit range
- `meal plan view 2026-01-27` - single date, derives the week it belongs to
- `meal plan view today` - same as current behavior
- Error messages updated with new format examples

## AI Prompt Changes

Initial message changes from:
> "Create a meal plan for week 2026-W05 (2026-01-27 to 2026-02-02)"

To:
> "Create a meal plan for 2026-01-27 to 2026-02-02"

## Display Changes

- `"Meal Plan for 2026-W05"` becomes `"Meal Plan for 2026-01-27 to 2026-02-02"`

## Progress Tracker

- Debug log header uses new format (`Week: 2026-01-27--2026-02-02`)
- Console output (`Planning Monday breakfast...`) already derives day names from `YYYY-MM-DD` dates, so no change needed there

## Files Touched

1. `src/commands/plan.ts` - Replace `WEEK_REGEX`, `getWeekIdentifier()`, `getCurrentWeek()`, `parseViewTarget()`, display strings
2. `src/schemas/plan.ts` - Update `week` field regex in `WeeklyPlanSchema`
3. `src/data/store.ts` - File paths flow through from new format (no logic change)
4. `src/services/agent-planner.ts` - Replace `getWeekDates()` with shared utility, update `buildInitialMessage()`
5. `src/services/plan-state.ts` - No structural changes (week is just a string)
6. `src/services/planning-progress-tracker.ts` - Week string in log header updates automatically
7. All test files - Update week string literals

## What Stays The Same

- `DayPlan.date` stays as `YYYY-MM-DD`
- 7-day Monday-Sunday structure
- All meal/macro/budget logic
- AI planning agent flow
- Console progress output format
