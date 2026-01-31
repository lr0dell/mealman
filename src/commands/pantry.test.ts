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
        name: 'eggs',
        quantity: 12,
        unit: 'count',
        addedDate: '2026-01-29',
      });
      await store.savePantry(pantry);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
    });
  });

  describe('formatPantryList', () => {
    it('formats empty pantry', () => {
      const output = formatPantryList([]);
      expect(output).toContain('empty');
    });

    it('formats items with quantities', () => {
      const items = [
        { name: 'eggs', quantity: 12, unit: 'count', addedDate: '2026-01-29' },
        { name: 'milk', quantity: 1, unit: 'gallon', addedDate: '2026-01-28' },
      ];
      const output = formatPantryList(items);
      expect(output).toContain('eggs');
      expect(output).toContain('12 count');
      expect(output).toContain('milk');
      expect(output).toContain('1 gallon');
    });
  });

  describe('addPantryItem', () => {
    it('adds a simple item', async () => {
      await addPantryItem(store, 'eggs', 12, 'count');

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
      expect(items[0].quantity).toBe(12);
    });

    it('adds item with expiration', async () => {
      await addPantryItem(store, 'chicken breast', 2, 'lbs', '2026-02-01');

      const items = await listPantry(store);
      expect(items[0].expirationDate).toBe('2026-02-01');
    });

    it('updates quantity of existing item', async () => {
      await addPantryItem(store, 'eggs', 12, 'count');
      await addPantryItem(store, 'eggs', 6, 'count');

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(18);
    });
  });

  describe('removePantryItem', () => {
    it('removes an existing item', async () => {
      await addPantryItem(store, 'eggs', 12, 'count');
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
      await addPantryItem(store, 'Eggs', 12, 'count');
      const removed = await removePantryItem(store, 'eggs');

      expect(removed).toBe(true);
    });
  });
});
