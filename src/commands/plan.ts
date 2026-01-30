import { MealPlanner } from '../services/index.js';
import type { DataStore } from '../data/index.js';
import type { WeeklyPlan, Meal } from '../schemas/index.js';

export async function generateWeeklyPlan(
  store: DataStore,
  apiKey: string,
  week: string
): Promise<WeeklyPlan> {
  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  const planner = new MealPlanner(apiKey);
  const plan = await planner.generateWeeklyPlan(profile, pantry, week);

  await store.saveWeeklyPlan(plan);
  return plan;
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
