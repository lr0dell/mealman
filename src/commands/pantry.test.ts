import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataStore } from '../data/index.js';
import {
  listPantry,
  formatPantryList,
  addPantryItem,
  removePantryItem,
} from './pantry.js';

describe('Pantry Commands', () => {
  let testDir: string;
  let store: DataStore;

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'mealman-pantry-'));
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
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

    it('updates quantity of existing item (same ingredientId and unit)', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      await addPantryItem(store, 1, 'eggs', 300);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(900);
    });
  });

  describe('removePantryItem', () => {
    it('removes the whole item when amount is undefined', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      const result = await removePantryItem(store, 1);

      expect(result).toBe('removed');
      const items = await listPantry(store);
      expect(items).toHaveLength(0);
    });

    it('decrements quantity when amount is less than what is stored', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      const result = await removePantryItem(store, 1, 200);

      expect(result).toBe('decremented');
      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(400);
    });

    it('removes the item entirely when amount equals or exceeds quantity', async () => {
      await addPantryItem(store, 1, 'eggs', 600);
      const result = await removePantryItem(store, 1, 600);

      expect(result).toBe('removed');
      const items = await listPantry(store);
      expect(items).toHaveLength(0);
    });

    it('throws when the ingredient id is not in the pantry', async () => {
      await expect(removePantryItem(store, 999)).rejects.toThrow();
    });
  });
});
