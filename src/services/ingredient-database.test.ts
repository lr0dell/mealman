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
      pricePerGram: 0.012,
      category: 'meat',
    });

    expect(ingredient.id).toBe(1);
    expect(ingredient.name).toBe('Chicken Breast');
    expect(ingredient.source).toBe('custom');

    const retrieved = db.getIngredientById(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Chicken Breast');
  });

  it('finds ingredient by semantic search', async () => {
    await db.addIngredient({
      name: 'Fish, raw, mixed species',
      proteinPer100g: 20,
      carbsPer100g: 0,
      fatPer100g: 1.5,
      fiberPer100g: 0,
      pricePerGram: 0.015,
      category: 'seafood',
    });

    await db.addIngredient({
      name: 'Fish sticks, frozen, prepared',
      proteinPer100g: 12,
      carbsPer100g: 20,
      fatPer100g: 10,
      fiberPer100g: 1,
      pricePerGram: 0.008,
      category: 'seafood',
    });

    const match = await db.searchIngredient('fish');
    expect(match).not.toBeNull();
    expect(match!.ingredient.name).toBe('Fish, raw, mixed species');
    expect(match!.similarity).toBeGreaterThan(0);
  });

  it('returns multiple matches with searchIngredients', async () => {
    await db.addIngredient({
      name: 'Chicken breast, raw',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerGram: 0.012,
      category: 'meat',
    });

    await db.addIngredient({
      name: 'Chicken thigh, raw',
      proteinPer100g: 26,
      carbsPer100g: 0,
      fatPer100g: 6,
      fiberPer100g: 0,
      pricePerGram: 0.01,
      category: 'meat',
    });

    const matches = await db.searchIngredients('chicken', 5);
    expect(matches.length).toBe(2);
  });

  it('lists all ingredient names', async () => {
    await db.addIngredient({
      name: 'Rice',
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      pricePerGram: 0.003,
      category: 'grains',
    });

    const names = db.getAllIngredientNames();
    expect(names).toContain('Rice');
  });

  it('updates ingredient', async () => {
    const ingredient = await db.addIngredient({
      name: 'Salmon',
      proteinPer100g: 20,
      carbsPer100g: 0,
      fatPer100g: 13,
      fiberPer100g: 0,
      pricePerGram: 0.015,
      category: 'seafood',
    });

    const updated = db.updateIngredient(ingredient.id, { pricePerGram: 0.018 });
    expect(updated.pricePerGram).toBe(0.018);
  });
});
