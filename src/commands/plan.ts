import type { WeeklyPlan, Meal, DayPlan } from '../schemas/index.js';
import { AgentPlanner } from '../services/agent-planner.js';
import { DataStore } from '../data/store.js';
import {
  getWeekRange,
  toWeekKey,
  parseWeekKey,
  getCurrentWeekKey,
} from '../utils/week.js';

const WEEK_REGEX = /^\d{4}-\d{2}-\d{2}--\d{4}-\d{2}-\d{2}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ViewTarget = {
  type: 'week' | 'day';
  week: string;
  date?: string;
};

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

export function formatWeeklyPlan(plan: WeeklyPlan): string {
  const { start, end } = parseWeekKey(plan.week);
  const lines: string[] = [
    `Meal Plan for ${start} to ${end}`,
    `Generated: ${plan.generatedAt}`,
    '',
  ];

  for (const day of plan.days) {
    lines.push(`## ${day.date}`);
    lines.push('');

    for (const [mealType, meal] of Object.entries(day.meals)) {
      if (meal) {
        lines.push(formatMeal(mealType, meal));
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('## Weekly Totals');
  lines.push(`Calories: ${plan.totals.calories}`);
  lines.push(`Protein: ${plan.totals.macros.protein.toFixed(1)}g`);
  lines.push(`Carbs: ${plan.totals.macros.carbs.toFixed(1)}g`);
  lines.push(`Fat: ${plan.totals.macros.fat.toFixed(1)}g`);
  lines.push(`Fat: ${plan.totals.macros.fiber.toFixed(1)}g`);
  lines.push(`Estimated Cost: $${plan.totals.estimatedCost.toFixed(2)}`);

  return lines.join('\n');
}

export function formatMeal(type: string, meal: Meal): string {
  const lines = [
    `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${meal.name}`,
    `  Calories: ${meal.calories} | P: ${meal.macros.protein.toFixed(1)}g C: ${meal.macros.carbs.toFixed(1)}g Ft: ${meal.macros.fat.toFixed(1)}g Fb: ${meal.macros.fiber.toFixed(1)}g`,
    `  Prep: ${meal.prepTime}min | Serves: ${meal.servings}`,
  ];

  if (meal.leftoverOf) {
    lines.push(`  (Leftover from: ${meal.leftoverOf})`);
  } else {
    lines.push(`  Ingredients: `);

    meal.ingredients.forEach((ing) => {
      lines.push(
        `    - ${ing.name.charAt(0).toUpperCase() + ing.name.slice(1)} (${ing.amount} ${ing.unit})`
      );
    });

    lines.push(`  Directions: `);
    lines.push(`    ${meal.recipe}`);
  }

  return lines.join('\n');
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

function getDayName(dateStr: string): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
}

export function formatWeeklyPlanSummary(plan: WeeklyPlan): string {
  const { start, end } = parseWeekKey(plan.week);
  const lines: string[] = [`Meal Plan for ${start} to ${end}`, ''];

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

export async function viewPlan(
  store: DataStore,
  target?: string,
  detailed?: boolean
): Promise<string> {
  const parsed = parseViewTarget(target);
  const plan = await store.getWeeklyPlan(parsed.week);

  if (!plan) {
    return `No meal plan found for ${parsed.week}. Run 'mealman plan week' to generate one.`;
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
