import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data/index.js';
import {
  listPantry,
  formatPantryList,
  addPantryItem,
  removePantryItem,
} from './pantry.js';

describe('Pantry Commands', () => {
  const testDir = join(process.cwd(), 'test-data-pantry');
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

  describe('listPantry', () => {
    it('returns empty list for new pantry', async () => {
      const items = await listPantry(store);
      expect(items).toHaveLength(0);
    });

    it('returns items from pantry', async () => {
      const pantry = await store.getPantry();
      pantry.items.push({
        ingredientId: 1,
        name: 'eggs',
        quantity: 600,
        unit: 'g',
        addedDate: '2026-01-29',
      });
      await store.savePantry(pantry);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
      expect(items[0].ingredientId).toBe(1);
    });
  });

  describe('formatPantryList', () => {
    it('formats empty pantry', () => {
      const output = formatPantryList([]);
      expect(output).toContain('empty');
    });

    it('formats items with quantities', () => {
      const items: {
        ingredientId: number;
        name: string;
        quantity: number;
        unit: 'g';
        addedDate: string;
        expirationDate?: string | undefined;
      }[] = [
        {
          ingredientId: 1,
          name: 'eggs',
          quantity: 12,
          unit: 'g',
          addedDate: '2026-01-29',
        },
        {
          ingredientId: 2,
          name: 'milk',
          quantity: 1000,
          unit: 'g',
          addedDate: '2026-01-28',
        },
      ];
      const output = formatPantryList(items);
      expect(output).toContain('eggs');
      expect(output).toContain('12 g');
      expect(output).toContain('milk');
      expect(output).toContain('1000 g');
    });
  });

  describe('addPantryItem', () => {
    it('adds a simple item with ingredientId', async () => {
      await addPantryItem(store, 1, 'eggs', 600);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
      expect(items[0].ingredientId).toBe(1);
      expect(items[0].quantity).toBe(600);
    });

    it('adds item with expiration', async () => {
      await addPantryItem(store, 1, 'chicken breast', 900, '2026-02-01');

      const items = await listPantry(store);
      expect(items[0].expirationDate).toBe('2026-02-01');
    });

    it('updates quantity of existing item (same ingredientId and unit)', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      await addPantryItem(store, 1, 'eggs', 300);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(900);
    });
  });

  describe('removePantryItem', () => {
    it('removes an existing item', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      const removed = await removePantryItem(store, 'eggs');

      expect(removed).toBe(true);
      const items = await listPantry(store);
      expect(items).toHaveLength(0);
    });

    it('returns false for non-existent item', async () => {
      const removed = await removePantryItem(store, 'phantom item');
      expect(removed).toBe(false);
    });

    it('removes item case-insensitively', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      const removed = await removePantryItem(store, 'Eggs');

      expect(removed).toBe(true);
    });
  });
});
