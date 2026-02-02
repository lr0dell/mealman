import type { WeeklyPlan, Meal } from '../schemas/index.js';
import { AgentPlanner } from '../services/agent-planner.js';
import { DataStore } from '../data/store.js';

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

  // Calculate current week
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  const week = `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

  console.log(`Generating meal plan for ${week}...`);
  console.log('This may take a minute as the AI plans each meal.');

  const planner = new AgentPlanner({
    anthropicApiKey: apiKey,
    dataDir,
  });

  const plan = await planner.generateWeeklyPlan(profile, pantry, week, dataDir);

  await store.saveWeeklyPlan(plan);

  console.log(`\nPlan generated for ${week}:`);
  console.log(`- ${plan.days.length} days planned`);
  console.log(`- Total calories: ${plan.totals.calories}`);
  console.log(`- Estimated cost: $${plan.totals.estimatedCost.toFixed(2)}`);
}

export function formatWeeklyPlan(plan: WeeklyPlan): string {
  const lines: string[] = [
    `Meal Plan for ${plan.week}`,
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
  lines.push(`Protein: ${plan.totals.macros.protein}g`);
  lines.push(`Carbs: ${plan.totals.macros.carbs}g`);
  lines.push(`Fat: ${plan.totals.macros.fat}g`);
  lines.push(`Fat: ${plan.totals.macros.fiber}g`);
  lines.push(`Estimated Cost: $${plan.totals.estimatedCost.toFixed(2)}`);

  return lines.join('\n');
}

function formatMeal(type: string, meal: Meal): string {
  const lines = [
    `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${meal.name}`,
    `  Calories: ${meal.calories} | P: ${meal.macros.protein}g C: ${meal.macros.carbs}g Ft: ${meal.macros.fat}g Fb: ${meal.macros.fiber}g`,
    `  Prep: ${meal.prepTime}min | Cost: $${meal.estimatedCost.toFixed(2)}`,
  ];

  if (meal.leftoverOf) {
    lines.push(`  (Leftover from: ${meal.leftoverOf})`);
  }

  return lines.join('\n');
}

export function getCurrentWeek(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const weekNum = Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function parseViewTarget(target?: string): ViewTarget {
  if (!target) {
    return { type: 'week', week: getCurrentWeek() };
  }
  throw new Error('Not implemented');
}
