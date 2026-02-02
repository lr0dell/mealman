# View Meal Plan Command Design

## Overview

Add a `meal plan view` command that displays meal plans at various granularities (current week, specific week, specific day, or today).

## Command Interface

```
meal plan view [target]
```

### Arguments

- `target` (optional) - What to view. Auto-detects format:
  - *(empty)* → current week's plan
  - `today` → today's meals from current week's plan
  - `YYYY-MM-DD` → specific day's meals (e.g., `2026-02-03`)
  - `YYYY-Www` → specific week's plan (e.g., `2026-W05`)

### Options

- `--detailed, -d` → Show full output including recipes, ingredients, and nutrition

### Examples

```bash
meal plan view              # current week, summary
meal plan view today        # today's meals, summary
meal plan view 2026-02-03   # specific day, summary
meal plan view 2026-W05 -d  # specific week, full detail
```

## Output Formats

### Summary Format (default) - Week

```
Meal Plan for 2026-W05

## Monday (2026-02-03)
  Breakfast: Oatmeal with Berries (10min)
  Lunch: Chicken Salad Wrap (15min)
  Dinner: Pasta Primavera (25min)

## Tuesday (2026-02-04)
  Breakfast: Greek Yogurt Parfait (5min)
  Lunch: Leftover Pasta Primavera (5min)
  Dinner: Grilled Salmon with Vegetables (30min)
```

### Summary Format - Single Day

```
Meals for Monday (2026-02-03)

  Breakfast: Oatmeal with Berries (10min)
  Lunch: Chicken Salad Wrap (15min)
  Dinner: Pasta Primavera (25min)
```

### Detailed Format

Uses existing `formatWeeklyPlan()` / `formatMeal()` output with full recipes, ingredients, and nutrition.

### Error Messages

- No plan found: `No meal plan found for 2026-W05. Run 'meal plan week' to generate one.`
- Invalid target format: `Invalid target '2026-W5'. Use format YYYY-Www (e.g., 2026-W05) or YYYY-MM-DD.`

## Implementation

### Files to Modify

1. **`src/cli/index.ts`** - Add the `view` subcommand to the `plan` command group

2. **`src/commands/plan.ts`** - Add new functions:
   - `parseViewTarget(target?: string)` - Parse target into structured format
   - `formatWeeklyPlanSummary(plan: WeeklyPlan)` - Summary formatter for week view
   - `formatDayPlanSummary(day: DayPlan)` - Summary formatter for single day
   - `viewPlan(target?: string, detailed?: boolean)` - Main handler

### Target Parsing Logic

```typescript
type ViewTarget = {
  type: 'week' | 'day';
  week: string;      // e.g., "2026-W05"
  date?: string;     // e.g., "2026-02-03" (only for day view)
};

function parseViewTarget(target?: string): ViewTarget
```

- Empty/undefined → `{ type: 'week', week: getWeekIdentifier(new Date()) }`
- `"today"` → `{ type: 'day', week: getWeekIdentifier(new Date()), date: getTodayDate() }`
- Matches `/^\d{4}-\d{2}-\d{2}$/` → `{ type: 'day', week: getWeekIdentifier(parsedDate), date: target }`
- Matches `/^\d{4}-W\d{2}$/` → `{ type: 'week', week: target }`
- Otherwise → throw error with helpful message

### Main Handler Logic

```typescript
async function viewPlan(target?: string, detailed?: boolean): Promise<string>
```

1. Parse target using `parseViewTarget()`
2. Load plan from DataStore using week identifier
3. If not found → return helpful error message
4. If `detailed` flag:
   - Week view: use existing `formatWeeklyPlan()`
   - Day view: use existing `formatMeal()` for each meal
5. If summary (default):
   - Week view: use new `formatWeeklyPlanSummary()`
   - Day view: use new `formatDayPlanSummary()`

### Behavior Notes

- "today" only looks in the current week's plan (strict behavior)
- Specific dates derive their week identifier from the date itself
- Week identifiers use ISO 8601 format (YYYY-Www)
