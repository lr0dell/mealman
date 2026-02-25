import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from './data/index.js';
import { addPantryItem, listPantry } from './commands/index.js';

describe('Integration: Full Workflow', () => {
  const testDir = join(process.cwd(), 'test-data-integration');
  let store: DataStore;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('manages pantry items through full lifecycle', async () => {
    // Add items
    await addPantryItem(store, 1, 'eggs', 12, 'count');
    await addPantryItem(store, 2, 'milk', 1, 'gallon', '2026-02-05');

    // List and verify
    const items = await listPantry(store);
    expect(items).toHaveLength(2);

    // Reload store and verify persistence
    const newStore = new DataStore(testDir);
    await newStore.init();
    const reloadedItems = await listPantry(newStore);
    expect(reloadedItems).toHaveLength(2);
  });

  it('creates valid default profile on init', async () => {
    const profile = await store.getProfile();

    expect(profile.household.size).toBeGreaterThan(0);
    expect(profile.goals.dailyCalories.min).toBeGreaterThan(0);
    expect(profile.goals.weeklyBudget).toBeGreaterThan(0);
  });
});
