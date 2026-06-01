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
it('scopes semantic search to the given ingredient ids', async () => {
  const chicken = await db.addIngredient({
    name: 'Chicken breast, raw',
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    fiberPer100g: 0,
    pricePerGram: 0.012,
    category: 'meat',
  });

  const beef = await db.addIngredient({
    name: 'Beef, ground, raw',
    proteinPer100g: 26,
    carbsPer100g: 0,
    fatPer100g: 15,
    fiberPer100g: 0,
    pricePerGram: 0.011,
    category: 'meat',
  });

  // Search for "chicken" but only allow the beef id as a candidate.
  const matches = await db.searchIngredientsInPantry('chicken', [beef.id], 5);
    expect(matches).toHaveLength(1);
    expect(matches[0].ingredient.id).toBe(beef.id);

    // Both ids in scope -> chicken ranks first for a "chicken" query.
    const both = await db.searchIngredientsInPantry(
      'chicken',
      [chicken.id, beef.id],
      5
    );
    expect(both[0].ingredient.id).toBe(chicken.id);
  });

  it('returns no matches for an empty id list', async () => {
    await db.addIngredient({
      name: 'Rice, white, raw',
      proteinPer100g: 7,
      carbsPer100g: 80,
      fatPer100g: 0.7,
      fiberPer100g: 1.3,
      pricePerGram: 0.003,
      category: 'grains',
    });

    const matches = await db.searchIngredientsInPantry('rice', [], 5);
    expect(matches).toEqual([]);
  });
});
