import { describe, it, expect } from 'vitest';
import { generateShoppingList, formatShoppingList } from './shop';
import type { WeeklyPlan, Pantry } from '../schemas';

describe('Shopping Commands', () => {
  const mockPlan: WeeklyPlan = {
    week: '2026-W05',
    generatedAt: '2026-01-29T10:00:00Z',
    days: [
      {
        date: '2026-01-27',
        meals: {
          breakfast: {
            name: 'Oatmeal',
            recipe: 'Cook oats',
            ingredients: [
              { name: 'oats', amount: 0.5, unit: 'cup' },
              { name: 'milk', amount: 1, unit: 'cup' },
            ],
            prepTime: 10,
            calories: 300,
            macros: { protein: 10, carbs: 50, fat: 5, fiber: 8 },
            estimatedCost: 1,
            servings: 1,
            leftoverOf: null,
          },
          lunch: null,
          dinner: {
            name: 'Chicken Stir Fry',
            recipe: 'Stir fry chicken with veggies',
            ingredients: [
              { name: 'chicken breast', amount: 1, unit: 'lb' },
              { name: 'broccoli', amount: 2, unit: 'cups' },
            ],
            prepTime: 25,
            calories: 450,
            macros: { protein: 40, carbs: 20, fat: 15, fiber: 10 },
            estimatedCost: 8,
            servings: 2,
            leftoverOf: null,
          },
        },
      },
    ],
    totals: {
      calories: 14000,
      macros: { protein: 1050, carbs: 1400, fat: 455, fiber: 150 },
      estimatedCost: 95,
    },
  };

  describe('generateShoppingList', () => {
    it('aggregates ingredients from all meals', () => {
      const pantry: Pantry = { items: [] };
      const list = generateShoppingList(mockPlan, pantry);

      expect(list).toHaveLength(4);
      expect(list.find((i) => i.name === 'oats')).toBeDefined();
      expect(list.find((i) => i.name === 'chicken breast')).toBeDefined();
    });

    it('subtracts pantry items', () => {
      const pantry: Pantry = {
        items: [
          { name: 'chicken breast', quantity: 0.5, unit: 'lb', addedDate: '2026-01-27' },
        ],
      };
      const list = generateShoppingList(mockPlan, pantry);

      const chicken = list.find((i) => i.name === 'chicken breast');
      expect(chicken?.amount).toBe(0.5); // 1 - 0.5 = 0.5
    });

    it('excludes items fully covered by pantry', () => {
      const pantry: Pantry = {
        items: [
          { name: 'chicken breast', quantity: 2, unit: 'lb', addedDate: '2026-01-27' },
        ],
      };
      const list = generateShoppingList(mockPlan, pantry);

      const chicken = list.find((i) => i.name === 'chicken breast');
      expect(chicken).toBeUndefined();
    });
  });

  describe('formatShoppingList', () => {
    it('formats list for display', () => {
      const list = [
        { name: 'oats', amount: 0.5, unit: 'cup' },
        { name: 'milk', amount: 1, unit: 'cup' },
      ];
      const output = formatShoppingList(list);

      expect(output).toContain('oats');
      expect(output).toContain('milk');
      expect(output).toContain('Shopping List');
    });

    it('shows message for empty list', () => {
      const output = formatShoppingList([]);
      expect(output).toContain('pantry');
    });
  });
});