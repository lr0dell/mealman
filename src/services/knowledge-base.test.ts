import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { KnowledgeBase } from './knowledge-base.js';

describe('KnowledgeBase', () => {
  const testDir = join(process.cwd(), 'test-data-kb');
  let kb: KnowledgeBase;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    kb = new KnowledgeBase(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  it('returns null for unknown ingredient', async () => {
    const result = await kb.getIngredient('unknown-food');
    expect(result).toBeNull();
  });

  it('saves and retrieves ingredient', async () => {
    const ingredient = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      usdaFdcId: 171477,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', ingredient);
    const result = await kb.getIngredient('chicken breast');

    expect(result).toEqual(ingredient);
  });

  it('searches ingredients by partial name', async () => {
    const chicken = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };
    const rice = {
      name: 'white rice',
      pricePerUnit: 2,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', chicken);
    await kb.saveIngredient('white rice', rice);

    const results = await kb.searchIngredients('chick');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('chicken breast');
  });

  it('lists all ingredients', async () => {
    const chicken = {
      name: 'chicken breast',
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      confidence: 'usda' as const,
      lastUpdated: '2026-01-30',
    };

    await kb.saveIngredient('chicken breast', chicken);
    const all = await kb.getAllIngredients();

    expect(all).toHaveLength(1);
    expect(all[0]).toBe('chicken breast');
  });
});
