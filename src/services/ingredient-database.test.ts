import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { IngredientDatabase } from './ingredient-database.js';

describe('IngredientDatabase', () => {
  const testDir = join(process.cwd(), 'test-data-ingredient-db');
  let db: IngredientDatabase;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    db = new IngredientDatabase(join(testDir, 'ingredients.db'));
    await db.init();
  });

  afterEach(() => {
    db.close();
    rmSync(testDir, { recursive: true });
  });

  it('initializes database with schema', () => {
    const stats = db.getStats();
    expect(stats.total).toBe(0);
  });

  it('adds and retrieves ingredient by id', async () => {
    const ingredient = await db.addIngredient({
      name: 'Chicken Breast',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerUnit: 12,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'meat',
    });

    expect(ingredient.id).toBe(1);
    expect(ingredient.name).toBe('Chicken Breast');
    expect(ingredient.source).toBe('custom');

    const retrieved = db.getIngredientById(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Chicken Breast');
  });
});
