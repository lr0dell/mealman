import { describe, it, expect } from 'vitest';
import {
  mergeNutrients,
  getNutrient,
  deduplicateWithMerge,
  findFiberGaps,
} from './build-ingredient-db.js';

describe('getNutrient', () => {
  it('returns the amount for a known nutrient', () => {
    const food = {
      fdcId: 1,
      description: 'Test',
      foodNutrients: [{ nutrient: { id: 1079 }, amount: 5.2 }],
    };
    expect(getNutrient(food, 1079)).toBe(5.2);
  });

  it('returns 0 when nutrient is missing', () => {
    const food = {
      fdcId: 1,
      description: 'Test',
      foodNutrients: [],
    };
    expect(getNutrient(food, 1079)).toBe(0);
  });

  it('returns 0 when amount is undefined', () => {
    const food = {
      fdcId: 1,
      description: 'Test',
      foodNutrients: [{ nutrient: { id: 1079 } }],
    };
    expect(getNutrient(food, 1079)).toBe(0);
  });
});

describe('mergeNutrients', () => {
  it('keeps non-zero value when other is zero', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [
        { nutrient: { id: 1003 }, amount: 13 },
        { nutrient: { id: 1079 }, amount: 0 },
      ],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [
        { nutrient: { id: 1003 }, amount: 13 },
        { nutrient: { id: 1079 }, amount: 10.6 },
      ],
    };
    const merged = mergeNutrients(existing, incoming);
    const fiber = merged.foodNutrients.find((n) => n.nutrient.id === 1079);
    expect(fiber?.amount).toBe(10.6);
  });

  it('keeps existing non-zero value when incoming is zero', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1079 }, amount: 10.6 }],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1079 }, amount: 0 }],
    };
    const merged = mergeNutrients(existing, incoming);
    const fiber = merged.foodNutrients.find((n) => n.nutrient.id === 1079);
    expect(fiber?.amount).toBe(10.6);
  });

  it('adds nutrients that only exist in incoming', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1003 }, amount: 13 }],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1079 }, amount: 10.6 }],
    };
    const merged = mergeNutrients(existing, incoming);
    const fiber = merged.foodNutrients.find((n) => n.nutrient.id === 1079);
    expect(fiber?.amount).toBe(10.6);
    const protein = merged.foodNutrients.find((n) => n.nutrient.id === 1003);
    expect(protein?.amount).toBe(13);
  });

  it('preserves description and category from existing', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats, whole grain',
      foodCategory: { description: 'Cereal Grains and Pasta' },
      foodNutrients: [],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1079 }, amount: 10.6 }],
    };
    const merged = mergeNutrients(existing, incoming);
    expect(merged.description).toBe('Oats, whole grain');
    expect(merged.foodCategory?.description).toBe('Cereal Grains and Pasta');
  });

  it('keeps nutrients that only exist in existing', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1003 }, amount: 13 }],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [],
    };
    const merged = mergeNutrients(existing, incoming);
    const protein = merged.foodNutrients.find((n) => n.nutrient.id === 1003);
    expect(protein?.amount).toBe(13);
  });

  it('keeps existing non-zero value when both are non-zero (existing wins)', () => {
    const existing = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1003 }, amount: 13 }],
    };
    const incoming = {
      fdcId: 1,
      description: 'Oats',
      foodNutrients: [{ nutrient: { id: 1003 }, amount: 12.5 }],
    };
    const merged = mergeNutrients(existing, incoming);
    const protein = merged.foodNutrients.find((n) => n.nutrient.id === 1003);
    expect(protein?.amount).toBe(13);
  });
});

describe('deduplicateWithMerge', () => {
  it('merges nutrients for duplicate fdcIds', () => {
    const foods = [
      {
        fdcId: 100,
        description: 'Oats',
        foodCategory: { description: 'Cereal Grains and Pasta' },
        foodNutrients: [
          { nutrient: { id: 1003 }, amount: 13 },
          { nutrient: { id: 1079 }, amount: 0 },
        ],
      },
      {
        fdcId: 100,
        description: 'Oats',
        foodCategory: { description: 'Cereal Grains and Pasta' },
        foodNutrients: [
          { nutrient: { id: 1003 }, amount: 12.5 },
          { nutrient: { id: 1079 }, amount: 10.6 },
        ],
      },
    ];
    const result = deduplicateWithMerge(foods);
    expect(result).toHaveLength(1);
    expect(getNutrient(result[0], 1079)).toBe(10.6);
    // Keeps first entry's non-zero protein (existing wins)
    expect(getNutrient(result[0], 1003)).toBe(13);
  });

  it('keeps unique foods as-is', () => {
    const foods = [
      {
        fdcId: 1,
        description: 'Chicken',
        foodNutrients: [{ nutrient: { id: 1003 }, amount: 31 }],
      },
      {
        fdcId: 2,
        description: 'Rice',
        foodNutrients: [{ nutrient: { id: 1079 }, amount: 1.8 }],
      },
    ];
    const result = deduplicateWithMerge(foods);
    expect(result).toHaveLength(2);
  });
});

describe('findFiberGaps', () => {
  it('returns ingredients with 0 fiber in fiber-expected categories', () => {
    const ingredients = [
      { name: 'Oats', fiberPer100g: 0, category: 'grains' },
      { name: 'Chicken', fiberPer100g: 0, category: 'meat' },
      { name: 'Lentils', fiberPer100g: 0, category: 'legumes' },
      { name: 'Broccoli', fiberPer100g: 2.6, category: 'produce' },
      { name: 'Apple', fiberPer100g: 0, category: 'produce' },
    ];
    const gaps = findFiberGaps(ingredients);
    expect(gaps).toHaveLength(3);
    expect(gaps.map((g) => g.name)).toEqual(['Oats', 'Lentils', 'Apple']);
  });

  it('returns empty array when no gaps', () => {
    const ingredients = [
      { name: 'Rice', fiberPer100g: 1.8, category: 'grains' },
      { name: 'Butter', fiberPer100g: 0, category: 'dairy' },
    ];
    const gaps = findFiberGaps(ingredients);
    expect(gaps).toHaveLength(0);
  });
});
