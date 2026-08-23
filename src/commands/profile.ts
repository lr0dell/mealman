import type { Profile } from '../schemas/index.js';

export function formatProfile(profile: Profile): string {
  const lines: string[] = [
    '# Your Meal Planning Profile',
    '',
    '## Household',
    `Size: ${profile.household.size}`,
    `Members:`,
  ];

  for (const member of profile.household.members) {
    const restrictions = member.dietaryRestrictions.length
      ? ` (${member.dietaryRestrictions.join(', ')})`
      : '';
    lines.push(`  - ${member.name}${restrictions}`);
  }

  lines.push('');
  lines.push('## Goals');
  lines.push(`Daily Calories: ${profile.goals.dailyCalories}`);
  lines.push(
    `Macros: P ${profile.goals.macros.protein.min}-${profile.goals.macros.protein.max}g / C ${profile.goals.macros.carbs.min}-${profile.goals.macros.carbs.max}g / Ft ${profile.goals.macros.fat.min}-${profile.goals.macros.fat.max}g / Fb ${profile.goals.macros.fiber.min}-${profile.goals.macros.fiber.max}g`
  );
  lines.push(`Weekly Budget: $${profile.goals.weeklyBudget}`);

  lines.push('');
  lines.push('## Dietary');
  lines.push(
    `Restrictions: ${profile.dietary.restrictions.length ? profile.dietary.restrictions.join(', ') : 'none'}`
  );
  lines.push(
    `Dislikes: ${profile.dietary.dislikes.length ? profile.dietary.dislikes.join(', ') : 'none'}`
  );

  lines.push('');
  lines.push('## Preferences');
  lines.push(
    `Cuisines: ${profile.preferences.cuisines.length ? profile.preferences.cuisines.join(', ') : 'any'}`
  );
  lines.push('Max Prep Time (breakfast / lunch / dinner):');
  for (const [day, label] of [
    ['monday', 'Mon'],
    ['tuesday', 'Tue'],
    ['wednesday', 'Wed'],
    ['thursday', 'Thu'],
    ['friday', 'Fri'],
    ['saturday', 'Sat'],
    ['sunday', 'Sun'],
  ] as const) {
    const slots = profile.preferences.maxPrepTime[day];
    lines.push(
      `  ${label}: ${slots.breakfast} / ${slots.lunch} / ${slots.dinner} min`
    );
  }
  for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
    const note = profile.preferences.slotNotes[slot].trim();
    if (note) {
      lines.push(`${slot[0].toUpperCase()}${slot.slice(1)} notes: ${note}`);
    }
  }
  lines.push(`Complexity: ${profile.preferences.complexityTolerance}`);

  lines.push('');
  lines.push('## Constraints');
  lines.push(`Skill Level: ${profile.constraints.skillLevel}`);
  lines.push(
    `Kitchen Equipment: ${profile.constraints.kitchenware.join(', ')}`
  );

  if (
    profile.learned.lovedMeals.length ||
    profile.learned.dislikedMeals.length
  ) {
    lines.push('');
    lines.push('## Learned Preferences');
    if (profile.learned.lovedMeals.length) {
      lines.push(`Loved: ${profile.learned.lovedMeals.join(', ')}`);
    }
    if (profile.learned.dislikedMeals.length) {
      lines.push(`Disliked: ${profile.learned.dislikedMeals.join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function parseList(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function formatList(list: string[]): string {
  return list.join(', ');
}

export function validateNumber(
  input: string,
  opts: { positive: boolean }
): true | string {
  const value = Number(input);
  if (input.trim() === '' || Number.isNaN(value)) {
    return 'Please enter a number';
  }
  if (opts.positive) {
    return value > 0 ? true : 'Must be greater than zero';
  }
  return value >= 0 ? true : 'Must be zero or greater';
}

export function validateRange(min: number, max: number): true | string {
  return max >= min ? true : 'Max must be greater than or equal to min';
}
