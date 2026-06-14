import { describe, it, expect } from 'vitest';
import type {
  WeeklyPlan,
  DayPlan,
  Meal,
  PantryItem,
} from '../schemas/index.js';
import { PantrySchema } from '../schemas/index.js';
import { aggregateIngredients, consumeFromPantry } from './pantry-math.js';

function meal(
  name: string,
  ingredients: { ingredientId: number; name: string; amount: number }[]
): Meal {
  return {
    name,
    recipe: '...',
    ingredients: ingredients.map((i) => ({ ...i, unit: 'g' as const })),
    prepTime: 10,
    calories: 100,
    macros: { protein: 1, carbs: 1, fat: 1, fiber: 1 },
    estimatedCost: 1,
    servings: 1,
    leftoverOf: null,
  };
}

function planWith(days: DayPlan[]): WeeklyPlan {
  return {
    week: '2026-02-09--2026-02-15',
    generatedAt: '2026-02-09T00:00:00.000Z',
    days,
    totals: {
      calories: 0,
      macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      estimatedCost: 0,
    },
  };
}

describe('aggregateIngredients', () => {
  it('sums amounts by ingredientId across all meals in the week', () => {
    const plan = planWith([
      {
        date: '2026-02-09',
        meals: {
          breakfast: meal('Eggs', [
            { ingredientId: 1, name: 'egg', amount: 100 },
          ]),
          lunch: meal('Chicken', [
            { ingredientId: 2, name: 'chicken', amount: 200 },
          ]),
          dinner: null,
        },
      },
      {
        date: '2026-02-10',
        meals: {
          breakfast: meal('More Eggs', [
            { ingredientId: 1, name: 'egg', amount: 50 },
          ]),
          lunch: null,
          dinner: null,
        },
      },
    ]);

    const result = aggregateIngredients(plan);

    expect(result).toContainEqual({
      ingredientId: 1,
      name: 'egg',
      amount: 150,
    });
    expect(result).toContainEqual({
      ingredientId: 2,
      name: 'chicken',
      amount: 200,
    });
    expect(result).toHaveLength(2);
  });

  it('aggregates only the given day when a date is provided', () => {
    const plan = planWith([
      {
        date: '2026-02-09',
        meals: {
          breakfast: meal('Eggs', [
            { ingredientId: 1, name: 'egg', amount: 100 },
          ]),
          lunch: null,
          dinner: null,
        },
      },
      {
        date: '2026-02-10',
        meals: {
          breakfast: meal('Chicken', [
            { ingredientId: 2, name: 'chicken', amount: 200 },
          ]),
          lunch: null,
          dinner: null,
        },
      },
    ]);

    const result = aggregateIngredients(plan, '2026-02-10');

    expect(result).toEqual([{ ingredientId: 2, name: 'chicken', amount: 200 }]);
  });

  it('returns an empty array when the target day has no meals', () => {
    const plan = planWith([
      {
        date: '2026-02-09',
        meals: { breakfast: null, lunch: null, dinner: null },
      },
    ]);

    expect(aggregateIngredients(plan, '2026-02-09')).toEqual([]);
  });
});

function pantryItem(
  ingredientId: number,
  name: string,
  quantity: number
): PantryItem {
  return {
    ingredientId,
    name,
    quantity,
    unit: 'g',
    addedDate: '2026-02-01',
  };
}

describe('consumeFromPantry', () => {
  it('decrements quantity when pantry has enough', () => {
    const pantry = { items: [pantryItem(1, 'egg', 500)] };
    const result = consumeFromPantry(pantry, [
      { ingredientId: 1, name: 'egg', amount: 150 },
    ]);

    expect(result.consumed).toEqual([
      { ingredientId: 1, name: 'egg', amount: 150, remaining: 350 },
    ]);
    expect(result.shortfalls).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.updatedPantry.items[0].quantity).toBe(350);
  });

  it('removes the item and records a shortfall when pantry has too little', () => {
    const pantry = { items: [pantryItem(1, 'egg', 100)] };
    const result = consumeFromPantry(pantry, [
      { ingredientId: 1, name: 'egg', amount: 150 },
    ]);

    expect(result.shortfalls).toEqual([
      { ingredientId: 1, name: 'egg', needed: 150, had: 100 },
    ]);
    expect(result.consumed).toEqual([]);
    expect(result.updatedPantry.items).toHaveLength(0);
  });

  it('records missing when the ingredient is not in the pantry', () => {
    const pantry = { items: [pantryItem(1, 'egg', 100)] };
    const result = consumeFromPantry(pantry, [
      { ingredientId: 2, name: 'chicken', amount: 200 },
    ]);

    expect(result.missing).toEqual([
      { ingredientId: 2, name: 'chicken', amount: 200 },
    ]);
    expect(result.updatedPantry.items[0].quantity).toBe(100);
  });

  it('treats an empty pantry as all-missing', () => {
    const result = consumeFromPantry({ items: [] }, [
      { ingredientId: 1, name: 'egg', amount: 50 },
    ]);

    expect(result.missing).toEqual([
      { ingredientId: 1, name: 'egg', amount: 50 },
    ]);
    expect(result.consumed).toEqual([]);
    expect(result.shortfalls).toEqual([]);
  });

  it('does not mutate the input pantry', () => {
    const pantry = { items: [pantryItem(1, 'egg', 500)] };
    consumeFromPantry(pantry, [{ ingredientId: 1, name: 'egg', amount: 150 }]);

    expect(pantry.items[0].quantity).toBe(500);
  });

  it('fully consumes and removes the item when amount equals quantity', () => {
    const pantry = {
      items: [pantryItem(1, 'egg', 150), pantryItem(2, 'rice', 300)],
    };
    const result = consumeFromPantry(pantry, [
      { ingredientId: 1, name: 'egg', amount: 150 },
    ]);

    // exact consumption is reported as consumed (remaining 0), not a shortfall
    expect(result.consumed).toEqual([
      { ingredientId: 1, name: 'egg', amount: 150, remaining: 0 },
    ]);
    expect(result.shortfalls).toEqual([]);
    // the drained item is removed, not left at quantity 0
    expect(
      result.updatedPantry.items.find((i) => i.ingredientId === 1)
    ).toBeUndefined();
    // and the result must remain a schema-valid pantry (quantity > 0)
    expect(() => PantrySchema.parse(result.updatedPantry)).not.toThrow();
  });
});
