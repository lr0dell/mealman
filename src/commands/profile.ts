import type { Profile } from '../schemas';

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
  lines.push(`Daily Calories: ${profile.goals.dailyCalories.min}-${profile.goals.dailyCalories.max}`);
  lines.push(`Macros: P ${profile.goals.macros.protein.min}-${profile.goals.macros.protein.max}g / C ${profile.goals.macros.carbs.min}-${profile.goals.macros.carbs.max}g / Ft ${profile.goals.macros.fat.min}-${profile.goals.macros.fat.max}g / Fb ${profile.goals.macros.fiber.min}-${profile.goals.macros.fiber.max}g`);
  lines.push(`Weekly Budget: $${profile.goals.weeklyBudget}`);

  lines.push('');
  lines.push('## Dietary');
  lines.push(`Restrictions: ${profile.dietary.restrictions.length ? profile.dietary.restrictions.join(', ') : 'none'}`);
  lines.push(`Dislikes: ${profile.dietary.dislikes.length ? profile.dietary.dislikes.join(', ') : 'none'}`);

  lines.push('');
  lines.push('## Preferences');
  lines.push(`Cuisines: ${profile.preferences.cuisines.length ? profile.preferences.cuisines.join(', ') : 'any'}`);
  lines.push(
    `Max Prep Time: ` +
    `Mon ${profile.preferences.maxPrepTime.monday}min, ` +
    `Tue ${profile.preferences.maxPrepTime.tuesday}min, ` +
    `Wed ${profile.preferences.maxPrepTime.wednesday}min, ` +
    `Thu ${profile.preferences.maxPrepTime.thursday}min, ` +
    `Fri ${profile.preferences.maxPrepTime.friday}min, ` +
    `Sat ${profile.preferences.maxPrepTime.saturday}min, ` +
    `Sun ${profile.preferences.maxPrepTime.sunday}min`
  );
  lines.push(`Complexity: ${profile.preferences.complexityTolerance}`);

  lines.push('');
  lines.push('## Constraints');
  lines.push(`Skill Level: ${profile.constraints.skillLevel}`);
  lines.push(`Kitchen Equipment: ${profile.constraints.kitchenware.join(', ')}`);

  if (profile.learned.lovedMeals.length || profile.learned.dislikedMeals.length) {
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