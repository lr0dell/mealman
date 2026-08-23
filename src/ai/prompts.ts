import type { Profile, Pantry } from '../schemas/index.js';
import { parseWeekKey } from '../utils/week.js';

export function buildPlanningSystemPrompt(): string {
  return `You are an expert meal planner AI assistant. Your role is to create personalized weekly meal plans that:

1. Meet the user's macro and calorie targets (within 10% tolerance)
2. Stay within the weekly budget
3. Use pantry items where possible
4. Plan leftovers intentionally for efficiency
5. Respect time constraints (quick meals on weekdays)
6. Vary cuisines and avoid recent repeats
7. Accommodate dietary restrictions

CRITICAL: Always respond with valid JSON matching the requested schema. No markdown, no explanations outside the JSON.

When planning meals:
- Be realistic about portions and cooking times
- Use common, accessible ingredients
- Consider leftover potential (batch cooking)
- Account for prep time on busy weekdays vs relaxed weekends`;
}

export function buildWeeklyPlanPrompt(
  profile: Profile,
  pantry: Pantry,
  week: string
): string {
  const { start, end } = parseWeekKey(week);
  const pantrySection = formatPantryForPrompt(pantry);
  const profileSection = formatProfileForPrompt(profile);

  return `Generate a complete 7-day meal plan for ${start} to ${end}.

## User Profile
${profileSection}

## Current Pantry
${pantrySection}

## Output Format
Return a JSON object with this exact structure:
{
  "week": "${week}",
  "generatedAt": "<ISO timestamp>",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": { meal object or null },
        "lunch": { meal object or null },
        "dinner": { meal object or null }
      }
    }
  ],
  "totals": {
    "calories": <number>,
    "macros": { "protein": <g>, "carbs": <g>, "fat": <g>, "fiber": <g> },
    "estimatedCost": <number>
  },
  "shoppingList": [
    { "name": "<ingredient>", "amount": <grams>, "unit": "g", "estimatedCost": <number> }
  ]
}

Each meal object:
{
  "name": "<meal name>",
  "recipe": "<brief instructions>",
  "ingredients": [{ "ingredientId": <id>, "name": "<name>", "amount": <grams>, "unit": "g" }],
  "prepTime": <minutes>,
  "calories": <number>,
  "macros": { "protein": <g>, "carbs": <g>, "fat": <g>, "fiber": <g> },
  "estimatedCost": <number>,
  "servings": <number>,
  "leftoverOf": "<original meal name>" or null
}`;
}

function formatPantryForPrompt(pantry: Pantry): string {
  if (pantry.items.length === 0) {
    return 'Pantry is empty - all ingredients need to be purchased.';
  }

  const lines = pantry.items.map(
    (item) => `- ${item.name}: ${item.quantity} ${item.unit}`
  );

  return lines.join('\n');
}

function formatPrepTimeForPrompt(
  prepTime: Profile['preferences']['maxPrepTime']
): string {
  return (
    [
      ['monday', 'Monday'],
      ['tuesday', 'Tuesday'],
      ['wednesday', 'Wednesday'],
      ['thursday', 'Thursday'],
      ['friday', 'Friday'],
      ['saturday', 'Saturday'],
      ['sunday', 'Sunday'],
    ] as const
  )
    .map(([day, label]) => {
      const slots = prepTime[day];
      return `${label}: ${slots.breakfast}/${slots.lunch}/${slots.dinner}`;
    })
    .join('\n');
}

function formatProfileForPrompt(profile: Profile): string {
  const { goals, dietary, preferences, constraints, household } = profile;

  return `Household: ${household.size} people
Daily calories target: ${goals.dailyCalories}
Macro targets (daily): protein ${goals.macros.protein.min}-${goals.macros.protein.max}g, carbs ${goals.macros.carbs.min}-${goals.macros.carbs.max}g, fat ${goals.macros.fat.min}-${goals.macros.fat.max}g, fiber ${goals.macros.fiber.min}-${goals.macros.fiber.max}g
Weekly budget: $${goals.weeklyBudget}

Dietary restrictions: ${dietary.restrictions.length ? dietary.restrictions.join(', ') : 'none'}
Dislikes: ${dietary.dislikes.length ? dietary.dislikes.join(', ') : 'none'}

Preferred cuisines: ${preferences.cuisines.length ? preferences.cuisines.join(', ') : 'any'}
Max prep time (breakfast/lunch/dinner, minutes):
${formatPrepTimeForPrompt(preferences.maxPrepTime)}
Complexity tolerance: ${preferences.complexityTolerance}
Skill level: ${constraints.skillLevel}
Kitchen equipment: ${constraints.kitchenware.join(', ')}`;
}
