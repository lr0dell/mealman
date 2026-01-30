import type { WeeklyPlan, Pantry } from '../schemas';

export interface ShoppingItem {
  name: string;
  amount: number;
  unit: string;
}

export function generateShoppingList(plan: WeeklyPlan, pantry: Pantry): ShoppingItem[] {
  // Aggregate all ingredients from meals
  const ingredients = new Map<string, ShoppingItem>();

  for (const day of plan.days) {
    for (const meal of Object.values(day.meals)) {
      if (!meal) continue;

      for (const ing of meal.ingredients) {
        const key = `${ing.name.toLowerCase()}|${ing.unit}`;
        const existing = ingredients.get(key);

        if (existing) {
          existing.amount += ing.amount;
        } else {
          ingredients.set(key, {
            name: ing.name.toLowerCase(),
            amount: ing.amount,
            unit: ing.unit,
          });
        }
      }
    }
  }

  // Subtract pantry items
  for (const pantryItem of pantry.items) {
    const key = `${pantryItem.name.toLowerCase()}|${pantryItem.unit}`;
    const needed = ingredients.get(key);

    if (needed) {
      needed.amount -= pantryItem.quantity;
      if (needed.amount <= 0) {
        ingredients.delete(key);
      }
    }
  }

  return Array.from(ingredients.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatShoppingList(items: ShoppingItem[]): string {
  if (items.length === 0) {
    return 'Your pantry has everything you need!';
  }

  const lines: string[] = ['# Shopping List', ''];

  for (const item of items) {
    lines.push(`- [ ] ${item.name}: ${item.amount} ${item.unit}`);
  }

  return lines.join('\n');
}