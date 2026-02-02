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
});
