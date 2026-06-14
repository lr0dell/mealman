import type { Pantry } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';

export type IngredientRequirement = {
  ingredientId: number;
  name: string;
  amount: number;
};

export type ConsumeResult = {
  updatedPantry: Pantry;
  consumed: {
    ingredientId: number;
    name: string;
    amount: number;
    remaining: number;
  }[];
  shortfalls: {
    ingredientId: number;
    name: string;
    needed: number;
    had: number;
  }[];
  missing: { ingredientId: number; name: string; amount: number }[];
};

export function aggregateIngredients(
  plan: WeeklyPlan,
  date?: string
): IngredientRequirement[] {
  const days = date ? plan.days.filter((d) => d.date === date) : plan.days;
  const byId = new Map<number, IngredientRequirement>();

  for (const day of days) {
    for (const meal of Object.values(day.meals)) {
      if (!meal) continue;
      for (const ing of meal.ingredients) {
        const existing = byId.get(ing.ingredientId);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          byId.set(ing.ingredientId, {
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount,
          });
        }
      }
    }
  }

  return Array.from(byId.values());
}

export function consumeFromPantry(
  pantry: Pantry,
  requirements: IngredientRequirement[]
): ConsumeResult {
  const items = pantry.items.map((item) => ({ ...item }));
  const result: ConsumeResult = {
    updatedPantry: { items },
    consumed: [],
    shortfalls: [],
    missing: [],
  };

  for (const req of requirements) {
    const item = items.find((i) => i.ingredientId === req.ingredientId);

    if (!item) {
      result.missing.push({
        ingredientId: req.ingredientId,
        name: req.name,
        amount: req.amount,
      });
      continue;
    }

    if (item.quantity < req.amount) {
      result.shortfalls.push({
        ingredientId: req.ingredientId,
        name: req.name,
        needed: req.amount,
        had: item.quantity,
      });
      result.updatedPantry.items = result.updatedPantry.items.filter(
        (i) => i.ingredientId !== req.ingredientId
      );
      continue;
    }

    const remaining = item.quantity - req.amount;
    result.consumed.push({
      ingredientId: req.ingredientId,
      name: req.name,
      amount: req.amount,
      remaining,
    });

    if (remaining === 0) {
      result.updatedPantry.items = result.updatedPantry.items.filter(
        (i) => i.ingredientId !== req.ingredientId
      );
    } else {
      item.quantity = remaining;
    }
  }

  return result;
}
