import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from './store.js';
import { ProfileSchema, PantrySchema } from '../schemas/index.js';
import { writeFile } from 'node:fs/promises';

describe('DataStore', () => {
  const testDir = join(process.cwd(), 'test-data');
  let store: DataStore;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('creates data directory structure on init', async () => {
    await store.init();
    expect(existsSync(join(testDir, 'knowledge'))).toBe(true);
    expect(existsSync(join(testDir, 'plans'))).toBe(true);
    expect(existsSync(join(testDir, 'history'))).toBe(true);
  });

  it('creates default profile if none exists', async () => {
    await store.init();
    const profile = await store.getProfile();
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('creates empty pantry if none exists', async () => {
    await store.init();
    const pantry = await store.getPantry();
    expect(PantrySchema.safeParse(pantry).success).toBe(true);
    expect(pantry.items).toHaveLength(0);
  });

  it('saves and loads profile', async () => {
    await store.init();
    const profile = await store.getProfile();
    profile.goals.dailyCalories = { min: 2000, max: 2400 };
    await store.saveProfile(profile);

    const loaded = await store.getProfile();
    expect(loaded.goals.dailyCalories).toStrictEqual({ min: 2000, max: 2400 });
  });

  it('saves and loads pantry', async () => {
    await store.init();
    const pantry = await store.getPantry();
    pantry.items.push({
      ingredientId: 1,
      name: 'eggs',
      quantity: 12,
      unit: 'count',
      addedDate: '2026-01-29',
    });
    await store.savePantry(pantry);

    const loaded = await store.getPantry();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0].name).toBe('eggs');
  });
});

describe('getPantry validation', () => {
  const testDir = join(process.cwd(), 'test-data');
  let store: DataStore;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('filters out pantry items missing ingredientId', async () => {
    // Write raw JSON with a mix of valid and invalid items
    const pantryData = {
      items: [
        {
          ingredientId: 1,
          name: 'eggs',
          quantity: 12,
          unit: 'count',
          addedDate: '2026-01-29',
        },
        {
          name: 'invalid item',
          quantity: 5,
          unit: 'lbs',
          addedDate: '2026-01-29',
        },
      ],
    };
    await writeFile(
      join(testDir, 'pantry.json'),
      JSON.stringify(pantryData, null, 2)
    );

    const pantry = await store.getPantry();
    expect(pantry.items).toHaveLength(1);
    expect(pantry.items[0].name).toBe('eggs');
  });
});
