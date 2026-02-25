# Pantry-Ingredient Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mandate that all pantry items reference a valid ingredient in the SQLite ingredient database by storing `ingredientId` and using interactive selection during `pantry add`.

**Architecture:** Add `ingredientId` to `PantryItemSchema`. The `pantry add` CLI command searches the ingredient DB and presents an interactive selection list. Startup validation silently removes invalid items. The search logic is extracted from the agent's `handleLookupIngredient` into a reusable service method.

**Tech Stack:** TypeScript, Zod, better-sqlite3, sqlite-vec, `@inquirer/select` (new dependency), Vitest

---

### Task 1: Install `@inquirer/select` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install @inquirer/select`

**Step 2: Verify installation**

Run: `node -e "import('@inquirer/select').then(() => console.log('ok'))"`
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @inquirer/select for interactive pantry ingredient selection"
```

---

### Task 2: Update `PantryItemSchema` to include `ingredientId`

**Files:**
- Modify: `src/schemas/pantry.ts`
- Test: `src/schemas/pantry.test.ts`

**Step 1: Write failing tests**

Update `src/schemas/pantry.test.ts` — replace the entire file with:

```typescript
import { describe, it, expect } from 'vitest';
import { PantrySchema, PantryItemSchema } from './pantry.js';

describe('PantrySchema', () => {
  it('validates a pantry item with ingredientId', () => {
    const item = {
      ingredientId: 42,
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
      expirationDate: '2026-02-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects pantry item without ingredientId', () => {
    const item = {
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('validates pantry with items', () => {
    const pantry = {
      items: [
        {
          ingredientId: 1,
          name: 'chicken breast',
          quantity: 2,
          unit: 'lbs',
          addedDate: '2026-01-27',
          expirationDate: '2026-02-01',
        },
        {
          ingredientId: 2,
          name: 'eggs',
          quantity: 12,
          unit: 'count',
          addedDate: '2026-01-25',
        },
      ],
    };

    const result = PantrySchema.safeParse(pantry);
    expect(result.success).toBe(true);
  });

  it('validates pantry item without expiration date', () => {
    const item = {
      ingredientId: 10,
      name: 'rice',
      quantity: 5,
      unit: 'lbs',
      addedDate: '2026-01-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/schemas/pantry.test.ts`
Expected: 1 test fails ("rejects pantry item without ingredientId" passes, "validates a pantry item with ingredientId" passes but the data shape is wrong — actually the "rejects" test will fail because the current schema accepts items without `ingredientId`)

**Step 3: Update the schema**

In `src/schemas/pantry.ts`, add `ingredientId` as the first field:

```typescript
import { z } from 'zod';

export const PantryItemSchema = z.object({
  ingredientId: z.number(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const PantrySchema = z.object({
  items: z.array(PantryItemSchema),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;
export type Pantry = z.infer<typeof PantrySchema>;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/schemas/pantry.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add src/schemas/pantry.ts src/schemas/pantry.test.ts
git commit -m "feat: add ingredientId to PantryItemSchema"
```

---

### Task 3: Update `addPantryItem` to accept `ingredientId`

**Files:**
- Modify: `src/commands/pantry.ts`
- Test: `src/commands/pantry.test.ts`

**Step 1: Update the tests**

Replace the entire `src/commands/pantry.test.ts` file:

```typescript
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
        quantity: 12,
        unit: 'count',
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
      const items = [
        { ingredientId: 1, name: 'eggs', quantity: 12, unit: 'count', addedDate: '2026-01-29' },
        { ingredientId: 2, name: 'milk', quantity: 1, unit: 'gallon', addedDate: '2026-01-28' },
      ];
      const output = formatPantryList(items);
      expect(output).toContain('eggs');
      expect(output).toContain('12 count');
      expect(output).toContain('milk');
      expect(output).toContain('1 gallon');
    });
  });

  describe('addPantryItem', () => {
    it('adds a simple item with ingredientId', async () => {
      await addPantryItem(store, 1, 'eggs', 12, 'count');

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
      expect(items[0].ingredientId).toBe(1);
      expect(items[0].quantity).toBe(12);
    });

    it('adds item with expiration', async () => {
      await addPantryItem(store, 1, 'chicken breast', 2, 'lbs', '2026-02-01');

      const items = await listPantry(store);
      expect(items[0].expirationDate).toBe('2026-02-01');
    });

    it('updates quantity of existing item (same ingredientId and unit)', async () => {
      await addPantryItem(store, 1, 'eggs', 12, 'count');
      await addPantryItem(store, 1, 'eggs', 6, 'count');

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(18);
    });
  });

  describe('removePantryItem', () => {
    it('removes an existing item', async () => {
      await addPantryItem(store, 1, 'eggs', 12, 'count');
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
      await addPantryItem(store, 1, 'eggs', 12, 'count');
      const removed = await removePantryItem(store, 'Eggs');

      expect(removed).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/commands/pantry.test.ts`
Expected: FAIL — `addPantryItem` signature doesn't accept `ingredientId` yet

**Step 3: Update `addPantryItem` in `src/commands/pantry.ts`**

Change the `addPantryItem` function signature to accept `ingredientId` as the second parameter (after `store`). Update the body to use `ingredientId` for duplicate detection and include it in new items:

```typescript
export async function addPantryItem(
  store: DataStore,
  ingredientId: number,
  name: string,
  quantity: number,
  unit: string,
  expirationDate?: string
): Promise<void> {
  const pantry = await store.getPantry();
  const today = new Date().toISOString().split('T')[0];

  // Check if item already exists (same ingredientId and unit)
  const existing = pantry.items.find(
    (item) => item.ingredientId === ingredientId && item.unit === unit
  );

  if (existing) {
    existing.quantity += quantity;
    // Update expiration if new one is sooner
    if (
      expirationDate &&
      (!existing.expirationDate || expirationDate < existing.expirationDate)
    ) {
      existing.expirationDate = expirationDate;
    }
  } else {
    const newItem: PantryItem = {
      ingredientId,
      name: name.toLowerCase(),
      quantity,
      unit,
      addedDate: today,
    };
    if (expirationDate) {
      newItem.expirationDate = expirationDate;
    }
    pantry.items.push(newItem);
  }

  await store.savePantry(pantry);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/commands/pantry.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/pantry.ts src/commands/pantry.test.ts
git commit -m "feat: update addPantryItem to require ingredientId"
```

---

### Task 4: Add interactive ingredient search to CLI `pantry add`

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: Update the `pantry add` action handler**

The CLI handler needs to:
1. Initialize the `IngredientDatabase`
2. Search for matches using the user's input
3. Present an interactive list using `@inquirer/select`
4. Call `addPantryItem` with the selected ingredient's `id` and canonical `name`

Update the `pantry add` action in `src/cli/index.ts`:

```typescript
// Add these imports at the top of the file:
import select from '@inquirer/select';
import { IngredientDatabase } from '../services/ingredient-database.js';

// Replace the pantry add action (lines 51-69) with:
pantry
  .command('add <name> <quantity> <unit>')
  .description('Add item to pantry')
  .option('-e, --expires <date>', 'Expiration date (YYYY-MM-DD)')
  .action(
    async (
      name: string,
      quantity: string,
      unit: string,
      options: { expires?: string }
    ) => {
      const store = new DataStore(getDataDir());
      await store.init();

      const dbPath = join(getDataDir(), 'knowledge', 'ingredients.db');
      const ingredientDb = new IngredientDatabase(dbPath);
      await ingredientDb.init();

      try {
        const matches = await ingredientDb.searchIngredients(name, 5);

        if (matches.length === 0) {
          console.log(`No ingredients found matching "${name}".`);
          return;
        }

        const choices = matches.map((m) => ({
          name: `${m.ingredient.name} (${Math.round(m.similarity * 100)}% match)`,
          value: { id: m.ingredient.id, name: m.ingredient.name },
        }));

        const selected = await select({
          message: 'Select the ingredient to add:',
          choices: [
            ...choices,
            { name: 'Cancel', value: null },
          ],
        });

        if (!selected) {
          console.log('Cancelled.');
          return;
        }

        await addPantryItem(
          store,
          selected.id,
          selected.name,
          parseFloat(quantity),
          unit,
          options.expires
        );
        console.log(`Added ${quantity} ${unit} of ${selected.name}`);
      } finally {
        ingredientDb.close();
      }
    }
  );
```

**Step 2: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add interactive ingredient selection to pantry add command"
```

---

### Task 5: Add startup pantry validation

**Files:**
- Modify: `src/data/store.ts`
- Test: `src/data/store.test.ts`

**Step 1: Write failing test**

Add a new test to `src/data/store.test.ts`. First read the file to understand existing test patterns, then add:

```typescript
describe('getPantry validation', () => {
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
```

Note: You'll need to import `writeFile` from `node:fs/promises` in the test file if not already imported.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/store.test.ts`
Expected: FAIL — Zod validation throws because the raw data has items without `ingredientId`

**Step 3: Update `getPantry` in `src/data/store.ts`**

Change `getPantry` to parse the raw JSON permissively, filter items that don't have `ingredientId`, then re-save:

```typescript
async getPantry(): Promise<Pantry> {
  const content = await readFile(this.pantryPath, 'utf-8');
  const data = JSON.parse(content) as { items?: unknown[] };

  // Filter out items missing ingredientId (migration cleanup)
  if (Array.isArray(data.items)) {
    const before = data.items.length;
    data.items = data.items.filter(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'ingredientId' in item &&
        typeof (item as Record<string, unknown>).ingredientId === 'number'
    );
    if (data.items.length < before) {
      await writeFile(this.pantryPath, JSON.stringify(data, null, 2));
    }
  }

  return PantrySchema.parse(data);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.test.ts
git commit -m "feat: add startup validation to filter pantry items without ingredientId"
```

---

### Task 6: Fix downstream tests and type errors

After changing `addPantryItem`'s signature and `PantryItemSchema`, other test files will break. This task fixes them all.

**Files:**
- Modify: `src/commands/shop.test.ts` — update test pantry data to include `ingredientId`
- Modify: `src/cli/index.test.ts` — update test to account for new interactive flow
- Modify: `src/integration.test.ts` — update pantry test data
- Modify: `src/services/plan-state.test.ts` — update pantry test data
- Any other test files that construct `PantryItem` objects

**Step 1: Run full test suite to identify all failures**

Run: `npx vitest run`
Expected: Multiple failures in files that construct `PantryItem` without `ingredientId`

**Step 2: Fix each failing test file**

For each file, add `ingredientId: <number>` to every `PantryItem` object literal. Use sequential IDs (1, 2, 3, etc.).

**Step 3: Run full test suite to verify**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: update all tests to include ingredientId in PantryItem data"
```

---

### Task 7: Run linting and final verification

**Files:** None (verification only)

**Step 1: Run linter**

Run: `npx eslint src`
Expected: No errors

**Step 2: Run formatter check**

Run: `npx prettier --check "src/**/*.ts"`
Expected: All files formatted

**Step 3: Run full test suite one final time**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Run TypeScript build**

Run: `npx tsc --noEmit`
Expected: No errors
