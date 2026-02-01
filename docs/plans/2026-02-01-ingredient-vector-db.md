# Ingredient Vector Database Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the JSON knowledge base and USDA API with a SQLite database using semantic vector search for ingredient matching.

**Architecture:** SQLite + sqlite-vec stores ~9k USDA foods with embeddings. transformers.js generates embeddings at build time and runtime. Semantic search replaces exact string matching.

**Tech Stack:** better-sqlite3, sqlite-vec, @xenova/transformers, vitest

---

## Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new dependencies**

Run:
```bash
npm install better-sqlite3 sqlite-vec @xenova/transformers
npm install -D @types/better-sqlite3
```

**Step 2: Verify installation**

Run: `npm ls better-sqlite3 sqlite-vec @xenova/transformers`
Expected: All three packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sqlite-vec and transformers.js dependencies"
```

---

## Task 2: Create Embedder Service

**Files:**
- Create: `src/services/embedder.ts`
- Create: `src/services/embedder.test.ts`

**Step 1: Write the failing test**

Create `src/services/embedder.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Embedder } from './embedder.js';

describe('Embedder', () => {
  let embedder: Embedder;

  beforeAll(async () => {
    embedder = new Embedder();
    await embedder.init();
  });

  it('generates embedding with correct dimensions', async () => {
    const embedding = await embedder.embed('chicken breast');
    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding.length).toBe(384);
  });

  it('generates similar embeddings for similar texts', async () => {
    const fish1 = await embedder.embed('fish');
    const fish2 = await embedder.embed('raw fish fillet');
    const chicken = await embedder.embed('chicken breast');

    const fishSimilarity = cosineSimilarity(fish1, fish2);
    const crossSimilarity = cosineSimilarity(fish1, chicken);

    expect(fishSimilarity).toBeGreaterThan(crossSimilarity);
  });
});

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/embedder.test.ts`
Expected: FAIL - Cannot find module './embedder.js'

**Step 3: Write minimal implementation**

Create `src/services/embedder.ts`:

```typescript
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

export class Embedder {
  private pipe: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  async init(): Promise<void> {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.modelName);
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.pipe) {
      await this.init();
    }
    const output = await this.pipe!(text, {
      pooling: 'mean',
      normalize: true,
    });
    return new Float32Array(output.data);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/embedder.test.ts`
Expected: PASS (note: first run downloads model, may be slow)

**Step 5: Commit**

```bash
git add src/services/embedder.ts src/services/embedder.test.ts
git commit -m "feat: add Embedder service using transformers.js"
```

---

## Task 3: Create Ingredient Database Schema and Types

**Files:**
- Create: `src/services/ingredient-database.ts`
- Modify: `src/schemas/knowledge.ts`

**Step 1: Add new types to schemas**

Add to `src/schemas/knowledge.ts` (after existing code):

```typescript
export const IngredientCategorySchema = z.enum([
  'meat',
  'seafood',
  'dairy',
  'produce',
  'grains',
  'legumes',
  'oils',
  'other',
]);

export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;

export interface Ingredient {
  id: number;
  name: string;
  searchName: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerUnit: number;
  unit: string;
  unitWeightGrams: number;
  category: IngredientCategory;
  source: 'usda' | 'custom';
  usdaFdcId: number | null;
  createdAt: string;
}

export interface IngredientMatch {
  ingredient: Ingredient;
  similarity: number;
}

export interface NewIngredient {
  name: string;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerUnit: number;
  unit: string;
  unitWeightGrams: number;
  category: IngredientCategory;
  usdaFdcId?: number;
}
```

**Step 2: Run existing tests to ensure no regression**

Run: `npm test -- src/schemas/knowledge.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/schemas/knowledge.ts
git commit -m "feat: add Ingredient types for vector database"
```

---

## Task 4: Create IngredientDatabase Class (Core)

**Files:**
- Create: `src/services/ingredient-database.ts`
- Create: `src/services/ingredient-database.test.ts`

**Step 1: Write the failing test for database initialization**

Create `src/services/ingredient-database.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: FAIL - Cannot find module './ingredient-database.js'

**Step 3: Write minimal implementation**

Create `src/services/ingredient-database.ts`:

```typescript
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { Embedder } from './embedder.js';
import type {
  Ingredient,
  IngredientMatch,
  NewIngredient,
  IngredientCategory,
} from '../schemas/knowledge.js';

const EMBEDDING_DIMENSIONS = 384;

export class IngredientDatabase {
  private db: Database.Database;
  private embedder: Embedder;
  private initialized = false;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.embedder = new Embedder();
    sqliteVec.load(this.db);
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.embedder.init();

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        search_name TEXT NOT NULL,
        protein_per_100g REAL NOT NULL,
        carbs_per_100g REAL NOT NULL,
        fat_per_100g REAL NOT NULL,
        fiber_per_100g REAL NOT NULL,
        price_per_unit REAL NOT NULL,
        unit TEXT NOT NULL,
        unit_weight_grams REAL NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        usda_fdc_id INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_category ON ingredients(category);
      CREATE INDEX IF NOT EXISTS idx_source ON ingredients(source);
      CREATE INDEX IF NOT EXISTS idx_search_name ON ingredients(search_name);

      CREATE VIRTUAL TABLE IF NOT EXISTS ingredient_embeddings USING vec0(
        ingredient_id INTEGER PRIMARY KEY,
        embedding FLOAT[${EMBEDDING_DIMENSIONS}]
      );
    `);

    this.initialized = true;
  }

  getStats(): { total: number; byCategory: Record<string, number> } {
    const total = this.db
      .prepare('SELECT COUNT(*) as count FROM ingredients')
      .get() as { count: number };

    const categories = this.db
      .prepare(
        'SELECT category, COUNT(*) as count FROM ingredients GROUP BY category'
      )
      .all() as Array<{ category: string; count: number }>;

    const byCategory: Record<string, number> = {};
    for (const row of categories) {
      byCategory[row.category] = row.count;
    }

    return { total: total.count, byCategory };
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/ingredient-database.ts src/services/ingredient-database.test.ts
git commit -m "feat: add IngredientDatabase with SQLite schema"
```

---

## Task 5: Add Ingredient Insert and Retrieval

**Files:**
- Modify: `src/services/ingredient-database.ts`
- Modify: `src/services/ingredient-database.test.ts`

**Step 1: Write failing test for addIngredient**

Add to `src/services/ingredient-database.test.ts`:

```typescript
  it('adds and retrieves ingredient by id', async () => {
    const ingredient = await db.addIngredient({
      name: 'Chicken Breast',
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 3.6,
      fiberPer100g: 0,
      pricePerUnit: 12,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'meat',
    });

    expect(ingredient.id).toBe(1);
    expect(ingredient.name).toBe('Chicken Breast');
    expect(ingredient.source).toBe('custom');

    const retrieved = db.getIngredientById(1);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Chicken Breast');
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: FAIL - db.addIngredient is not a function

**Step 3: Implement addIngredient and getIngredientById**

Add to `src/services/ingredient-database.ts` class:

```typescript
  async addIngredient(input: NewIngredient): Promise<Ingredient> {
    const searchName = input.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const createdAt = new Date().toISOString().split('T')[0];
    const source = input.usdaFdcId ? 'usda' : 'custom';

    const result = this.db
      .prepare(
        `INSERT INTO ingredients (
          name, search_name, protein_per_100g, carbs_per_100g, fat_per_100g,
          fiber_per_100g, price_per_unit, unit, unit_weight_grams, category,
          source, usda_fdc_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        searchName,
        input.proteinPer100g,
        input.carbsPer100g,
        input.fatPer100g,
        input.fiberPer100g,
        input.pricePerUnit,
        input.unit,
        input.unitWeightGrams,
        input.category,
        source,
        input.usdaFdcId ?? null,
        createdAt
      );

    const id = result.lastInsertRowid as number;

    // Generate and store embedding
    const embedding = await this.embedder.embed(input.name);
    this.db
      .prepare(
        'INSERT INTO ingredient_embeddings (ingredient_id, embedding) VALUES (?, ?)'
      )
      .run(id, Buffer.from(embedding.buffer));

    return this.getIngredientById(id)!;
  }

  getIngredientById(id: number): Ingredient | null {
    const row = this.db
      .prepare('SELECT * FROM ingredients WHERE id = ?')
      .get(id) as IngredientRow | undefined;

    if (!row) return null;
    return this.rowToIngredient(row);
  }

  private rowToIngredient(row: IngredientRow): Ingredient {
    return {
      id: row.id,
      name: row.name,
      searchName: row.search_name,
      proteinPer100g: row.protein_per_100g,
      carbsPer100g: row.carbs_per_100g,
      fatPer100g: row.fat_per_100g,
      fiberPer100g: row.fiber_per_100g,
      pricePerUnit: row.price_per_unit,
      unit: row.unit,
      unitWeightGrams: row.unit_weight_grams,
      category: row.category as IngredientCategory,
      source: row.source as 'usda' | 'custom',
      usdaFdcId: row.usda_fdc_id,
      createdAt: row.created_at,
    };
  }
```

Add type at top of file:

```typescript
interface IngredientRow {
  id: number;
  name: string;
  search_name: string;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  price_per_unit: number;
  unit: string;
  unit_weight_grams: number;
  category: string;
  source: string;
  usda_fdc_id: number | null;
  created_at: string;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/ingredient-database.ts src/services/ingredient-database.test.ts
git commit -m "feat: add ingredient insert and retrieval"
```

---

## Task 6: Add Semantic Search

**Files:**
- Modify: `src/services/ingredient-database.ts`
- Modify: `src/services/ingredient-database.test.ts`

**Step 1: Write failing test for semantic search**

Add to `src/services/ingredient-database.test.ts`:

```typescript
  it('finds ingredient by semantic search', async () => {
    await db.addIngredient({
      name: 'Fish, raw, mixed species',
      proteinPer100g: 20,
      carbsPer100g: 0,
      fatPer100g: 1.5,
      fiberPer100g: 0,
      pricePerUnit: 15,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'seafood',
    });

    await db.addIngredient({
      name: 'Fish sticks, frozen, prepared',
      proteinPer100g: 12,
      carbsPer100g: 20,
      fatPer100g: 10,
      fiberPer100g: 1,
      pricePerUnit: 8,
      unit: 'kg',
      unitWeightGrams: 1000,
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
      pricePerUnit: 12,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'meat',
    });

    await db.addIngredient({
      name: 'Chicken thigh, raw',
      proteinPer100g: 26,
      carbsPer100g: 0,
      fatPer100g: 6,
      fiberPer100g: 0,
      pricePerUnit: 10,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'meat',
    });

    const matches = await db.searchIngredients('chicken', 5);
    expect(matches.length).toBe(2);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: FAIL - db.searchIngredient is not a function

**Step 3: Implement searchIngredient and searchIngredients**

Add to `src/services/ingredient-database.ts` class:

```typescript
  async searchIngredient(query: string): Promise<IngredientMatch | null> {
    const matches = await this.searchIngredients(query, 1);
    return matches.length > 0 ? matches[0] : null;
  }

  async searchIngredients(
    query: string,
    limit: number = 10
  ): Promise<IngredientMatch[]> {
    const queryEmbedding = await this.embedder.embed(query);

    const rows = this.db
      .prepare(
        `SELECT
          i.*,
          vec_distance_cosine(e.embedding, ?) as distance
        FROM ingredient_embeddings e
        JOIN ingredients i ON i.id = e.ingredient_id
        ORDER BY distance ASC
        LIMIT ?`
      )
      .all(Buffer.from(queryEmbedding.buffer), limit) as Array<
      IngredientRow & { distance: number }
    >;

    return rows.map((row) => ({
      ingredient: this.rowToIngredient(row),
      similarity: 1 - row.distance, // Convert distance to similarity
    }));
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/ingredient-database.ts src/services/ingredient-database.test.ts
git commit -m "feat: add semantic search for ingredients"
```

---

## Task 7: Add Helper Methods

**Files:**
- Modify: `src/services/ingredient-database.ts`
- Modify: `src/services/ingredient-database.test.ts`

**Step 1: Write failing tests for helper methods**

Add to `src/services/ingredient-database.test.ts`:

```typescript
  it('lists all ingredient names', async () => {
    await db.addIngredient({
      name: 'Rice',
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      fiberPer100g: 0.4,
      pricePerUnit: 3,
      unit: 'kg',
      unitWeightGrams: 1000,
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
      pricePerUnit: 15,
      unit: 'kg',
      unitWeightGrams: 1000,
      category: 'seafood',
    });

    const updated = db.updateIngredient(ingredient.id, { pricePerUnit: 18 });
    expect(updated.pricePerUnit).toBe(18);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: FAIL - db.getAllIngredientNames is not a function

**Step 3: Implement helper methods**

Add to `src/services/ingredient-database.ts` class:

```typescript
  getAllIngredientNames(): string[] {
    const rows = this.db
      .prepare('SELECT name FROM ingredients ORDER BY name')
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  updateIngredient(
    id: number,
    updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>
  ): Ingredient {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name',
      searchName: 'search_name',
      proteinPer100g: 'protein_per_100g',
      carbsPer100g: 'carbs_per_100g',
      fatPer100g: 'fat_per_100g',
      fiberPer100g: 'fiber_per_100g',
      pricePerUnit: 'price_per_unit',
      unit: 'unit',
      unitWeightGrams: 'unit_weight_grams',
      category: 'category',
      source: 'source',
      usdaFdcId: 'usda_fdc_id',
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && fieldMap[key]) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      this.db
        .prepare(`UPDATE ingredients SET ${fields.join(', ')} WHERE id = ?`)
        .run(...values);
    }

    return this.getIngredientById(id)!;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/ingredient-database.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/ingredient-database.ts src/services/ingredient-database.test.ts
git commit -m "feat: add helper methods to IngredientDatabase"
```

---

## Task 8: Create USDA Data Download Script

**Files:**
- Create: `scripts/build-ingredient-db.ts`

**Step 1: Create the build script**

Create `scripts/build-ingredient-db.ts`:

```typescript
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const USDA_FOUNDATION_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2024-04-18.zip';
const USDA_SR_LEGACY_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2024-04-18.zip';

const CATEGORY_PRICES: Record<string, number> = {
  meat: 12,
  seafood: 15,
  dairy: 6,
  produce: 4,
  grains: 3,
  legumes: 4,
  oils: 8,
  other: 5,
};

// USDA food category codes to our categories
const CATEGORY_MAP: Record<string, string> = {
  'Beef Products': 'meat',
  'Pork Products': 'meat',
  'Lamb, Veal, and Game Products': 'meat',
  'Poultry Products': 'meat',
  'Sausages and Luncheon Meats': 'meat',
  'Finfish and Shellfish Products': 'seafood',
  'Dairy and Egg Products': 'dairy',
  'Vegetables and Vegetable Products': 'produce',
  'Fruits and Fruit Juices': 'produce',
  'Cereal Grains and Pasta': 'grains',
  'Breakfast Cereals': 'grains',
  'Baked Products': 'grains',
  'Legumes and Legume Products': 'legumes',
  'Fats and Oils': 'oils',
  'Nut and Seed Products': 'other',
  'Spices and Herbs': 'other',
  Beverages: 'other',
  'Soups, Sauces, and Gravies': 'other',
  'Sweets': 'other',
  'Snacks': 'other',
  'Baby Foods': 'other',
  'Restaurant Foods': 'other',
  'Fast Foods': 'other',
  'Meals, Entrees, and Side Dishes': 'other',
  'American Indian/Alaska Native Foods': 'other',
};

const NUTRIENT_IDS = {
  PROTEIN: 1003,
  CARBS: 1005,
  FAT: 1004,
  FIBER: 1079,
};

interface USDAFood {
  fdcId: number;
  description: string;
  foodCategory?: { description: string };
  foodNutrients: Array<{
    nutrient: { id: number };
    amount?: number;
  }>;
}

async function downloadAndExtract(url: string): Promise<USDAFood[]> {
  console.log(`Downloading ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(Buffer.from(arrayBuffer));

  const jsonEntry = zip.getEntries().find((e) => e.entryName.endsWith('.json'));
  if (!jsonEntry) {
    throw new Error('No JSON file found in archive');
  }

  const content = zip.readAsText(jsonEntry);
  const data = JSON.parse(content);
  return data.FoundationFoods || data.SRLegacyFoods || [];
}

function getNutrient(food: USDAFood, nutrientId: number): number {
  const nutrient = food.foodNutrients.find(
    (n) => n.nutrient.id === nutrientId
  );
  return nutrient?.amount ?? 0;
}

function getCategory(food: USDAFood): string {
  const categoryName = food.foodCategory?.description ?? '';
  return CATEGORY_MAP[categoryName] ?? 'other';
}

async function main() {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  console.log('Downloading USDA Foundation Foods...');
  const foundationFoods = await downloadAndExtract(USDA_FOUNDATION_URL);
  console.log(`Downloaded ${foundationFoods.length} foundation foods`);

  console.log('Downloading USDA SR Legacy Foods...');
  const srLegacyFoods = await downloadAndExtract(USDA_SR_LEGACY_URL);
  console.log(`Downloaded ${srLegacyFoods.length} SR legacy foods`);

  const allFoods = [...foundationFoods, ...srLegacyFoods];

  // Deduplicate by fdcId
  const foodMap = new Map<number, USDAFood>();
  for (const food of allFoods) {
    if (!foodMap.has(food.fdcId)) {
      foodMap.set(food.fdcId, food);
    }
  }

  const foods = Array.from(foodMap.values());
  console.log(`Total unique foods: ${foods.length}`);

  // Transform to our format
  const ingredients = foods.map((food) => {
    const category = getCategory(food);
    return {
      name: food.description,
      usdaFdcId: food.fdcId,
      proteinPer100g: getNutrient(food, NUTRIENT_IDS.PROTEIN),
      carbsPer100g: getNutrient(food, NUTRIENT_IDS.CARBS),
      fatPer100g: getNutrient(food, NUTRIENT_IDS.FAT),
      fiberPer100g: getNutrient(food, NUTRIENT_IDS.FIBER),
      category,
      pricePerUnit: CATEGORY_PRICES[category],
      unit: 'kg',
      unitWeightGrams: 1000,
    };
  });

  // Save intermediate JSON for the next step
  const outputPath = join(dataDir, 'usda-foods.json');
  writeFileSync(outputPath, JSON.stringify(ingredients, null, 2));
  console.log(`Saved ${ingredients.length} ingredients to ${outputPath}`);
  console.log('Run "npm run embed-ingredients" to generate embeddings and build the database.');
}

main().catch(console.error);
```

**Step 2: Add adm-zip dependency and script**

Run:
```bash
npm install adm-zip
npm install -D @types/adm-zip
```

Add to `package.json` scripts:
```json
"download-usda": "tsx scripts/build-ingredient-db.ts"
```

**Step 3: Commit**

```bash
git add scripts/build-ingredient-db.ts package.json package-lock.json
git commit -m "feat: add USDA data download script"
```

---

## Task 9: Create Embedding and Database Build Script

**Files:**
- Create: `scripts/embed-ingredients.ts`

**Step 1: Create the embedding script**

Create `scripts/embed-ingredients.ts`:

```typescript
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { IngredientDatabase } from '../src/services/ingredient-database.js';
import type { IngredientCategory } from '../src/schemas/knowledge.js';

interface USDAIngredient {
  name: string;
  usdaFdcId: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  category: string;
  pricePerUnit: number;
  unit: string;
  unitWeightGrams: number;
}

async function main() {
  const dataDir = join(process.cwd(), 'data');
  const inputPath = join(dataDir, 'usda-foods.json');
  const dbPath = join(dataDir, 'ingredients.db');

  if (!existsSync(inputPath)) {
    console.error('Error: usda-foods.json not found. Run "npm run download-usda" first.');
    process.exit(1);
  }

  // Remove existing database
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const ingredients: USDAIngredient[] = JSON.parse(
    readFileSync(inputPath, 'utf-8')
  );

  console.log(`Loading ${ingredients.length} ingredients...`);

  const db = new IngredientDatabase(dbPath);
  await db.init();

  const batchSize = 100;
  let processed = 0;

  for (let i = 0; i < ingredients.length; i += batchSize) {
    const batch = ingredients.slice(i, i + batchSize);

    for (const ing of batch) {
      await db.addIngredient({
        name: ing.name,
        proteinPer100g: ing.proteinPer100g,
        carbsPer100g: ing.carbsPer100g,
        fatPer100g: ing.fatPer100g,
        fiberPer100g: ing.fiberPer100g,
        pricePerUnit: ing.pricePerUnit,
        unit: ing.unit,
        unitWeightGrams: ing.unitWeightGrams,
        category: ing.category as IngredientCategory,
        usdaFdcId: ing.usdaFdcId,
      });
    }

    processed += batch.length;
    const pct = ((processed / ingredients.length) * 100).toFixed(1);
    process.stdout.write(`\rProcessed ${processed}/${ingredients.length} (${pct}%)`);
  }

  console.log('\n');

  const stats = db.getStats();
  console.log(`Database built successfully!`);
  console.log(`Total ingredients: ${stats.total}`);
  console.log(`By category:`, stats.byCategory);

  db.close();
}

main().catch(console.error);
```

**Step 2: Add script to package.json**

Add to `package.json` scripts:
```json
"embed-ingredients": "tsx scripts/embed-ingredients.ts",
"build-ingredient-db": "npm run download-usda && npm run embed-ingredients"
```

**Step 3: Commit**

```bash
git add scripts/embed-ingredients.ts package.json
git commit -m "feat: add embedding script for ingredient database"
```

---

## Task 10: Update Tool Handlers

**Files:**
- Modify: `src/agent/tool-handlers.ts`

**Step 1: Update imports and createToolHandlers signature**

Replace the imports and function signature in `src/agent/tool-handlers.ts`:

```typescript
import { PlanState } from '../services/plan-state.js';
import { IngredientDatabase } from '../services/ingredient-database.js';
import {
  calculateMealNutrition,
  type IngredientWithNutrition,
} from '../services/macro-calculator.js';
import type {
  AddMealInput,
  ModifyMealInput,
  RemoveMealInput,
  LookupIngredientInput,
  SearchKnowledgeBaseInput,
  CheckDailyTotalsInput,
  FinalizePlanInput,
} from './types.js';
import type { Meal } from '../schemas/plan.js';

export function createToolHandlers(
  planState: PlanState,
  ingredientDb: IngredientDatabase
): {
  handle: (toolName: string, input: unknown) => Promise<unknown>;
} {
```

**Step 2: Update handleAddMeal to use IngredientDatabase**

Replace `handleAddMeal` ingredient lookup:

```typescript
  async function handleAddMeal(input: AddMealInput): Promise<
    | { success: false; error: string }
    | {
        success: true;
        meal: {
          name: string;
          calories: number;
          macros: {
            protein: number;
            carbs: number;
            fat: number;
            fiber: number;
          };
          cost: number;
        };
        dayTotals:
          | {
              calories: number;
              macros: {
                protein: number;
                carbs: number;
                fat: number;
                fiber: number;
              };
              estimatedCost: number;
            }
          | undefined;
        remainingBudget: ReturnType<typeof planState.getRemainingBudget>;
      }
  > {
    const ingredientsWithNutrition: IngredientWithNutrition[] = [];

    for (const ing of input.ingredients) {
      const match = await ingredientDb.searchIngredient(ing.name);
      if (!match) {
        return {
          success: false,
          error: `Ingredient "${ing.name}" not found. Try a different search term.`,
        };
      }
      const entry = match.ingredient;
      ingredientsWithNutrition.push({
        name: entry.name,
        amountGrams: ing.amountGrams,
        proteinPer100g: entry.proteinPer100g,
        carbsPer100g: entry.carbsPer100g,
        fatPer100g: entry.fatPer100g,
        fiberPer100g: entry.fiberPer100g,
        pricePerUnit: entry.pricePerUnit,
        unit: entry.unit,
        unitWeightGrams: entry.unitWeightGrams,
      });
    }

    // ... rest of function unchanged
```

**Step 3: Update handleLookupIngredient**

Replace `handleLookupIngredient`:

```typescript
  async function handleLookupIngredient(
    input: LookupIngredientInput
  ): Promise<
    | {
        found: true;
        ingredient: {
          name: string;
          matchedName: string;
          similarity: number;
          proteinPer100g: number;
          carbsPer100g: number;
          fatPer100g: number;
          fiberPer100g: number;
          pricePerUnit: number;
          unit: string;
        };
      }
    | { found: false; message: string }
  > {
    const match = await ingredientDb.searchIngredient(input.name);

    if (match) {
      return {
        found: true,
        ingredient: {
          name: input.name,
          matchedName: match.ingredient.name,
          similarity: match.similarity,
          proteinPer100g: match.ingredient.proteinPer100g,
          carbsPer100g: match.ingredient.carbsPer100g,
          fatPer100g: match.ingredient.fatPer100g,
          fiberPer100g: match.ingredient.fiberPer100g,
          pricePerUnit: match.ingredient.pricePerUnit,
          unit: match.ingredient.unit,
        },
      };
    }

    return {
      found: false,
      message: 'No matching ingredient found in database.',
    };
  }
```

**Step 4: Update handleSearchKnowledgeBase**

Replace `handleSearchKnowledgeBase`:

```typescript
  async function handleSearchKnowledgeBase(
    input: SearchKnowledgeBaseInput
  ): Promise<{
    results: Array<{
      name: string;
      similarity: number;
      proteinPer100g: number;
    }>;
  }> {
    const matches = await ingredientDb.searchIngredients(input.query, 10);
    return {
      results: matches.map((m) => ({
        name: m.ingredient.name,
        similarity: m.similarity,
        proteinPer100g: m.ingredient.proteinPer100g,
      })),
    };
  }
```

**Step 5: Update handleGetKnownIngredients**

Replace `handleGetKnownIngredients`:

```typescript
  function handleGetKnownIngredients(): {
    ingredients: string[];
  } {
    const ingredients = ingredientDb.getAllIngredientNames();
    return { ingredients };
  }
```

**Step 6: Remove kb and usdaClient references**

Remove the old imports at top:
```typescript
// Remove these lines:
// import { KnowledgeBase } from '../services/knowledge-base.js';
// import { USDAClient } from '../services/usda-client.js';
```

**Step 7: Run tests**

Run: `npm test -- src/agent/tool-handlers.test.ts`
Expected: Tests may fail - need to update test file too

**Step 8: Commit**

```bash
git add src/agent/tool-handlers.ts
git commit -m "refactor: update tool handlers to use IngredientDatabase"
```

---

## Task 11: Update Tool Handler Tests

**Files:**
- Modify: `src/agent/tool-handlers.test.ts`

**Step 1: Read current test file to understand structure**

Read the existing test file and update mocks to use IngredientDatabase instead of KnowledgeBase and USDAClient.

**Step 2: Update tests**

The tests need to:
1. Create a test IngredientDatabase with test data
2. Replace KB/USDA mocks with the real database
3. Add test ingredients before running tests

**Step 3: Run tests**

Run: `npm test -- src/agent/tool-handlers.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/agent/tool-handlers.test.ts
git commit -m "test: update tool handler tests for IngredientDatabase"
```

---

## Task 12: Update AgentPlanner

**Files:**
- Modify: `src/services/agent-planner.ts`

**Step 1: Update imports**

Replace imports:
```typescript
import { AIClient } from '../ai/client.js';
import { IngredientDatabase } from './ingredient-database.js';
import { PlanState } from './plan-state.js';
import { createToolHandlers } from '../agent/tool-handlers.js';
import { PLANNING_TOOLS } from '../agent/tools.js';
import { PlanningProgressTracker } from './planning-progress-tracker.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Profile, Pantry } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';
```

**Step 2: Update options interface**

```typescript
export interface AgentPlannerOptions {
  anthropicApiKey: string;
  dataDir: string;
}
```

**Step 3: Update constructor**

```typescript
export class AgentPlanner {
  private aiClient: AIClient;
  private ingredientDb: IngredientDatabase;
  private initialized = false;

  constructor(options: AgentPlannerOptions) {
    this.aiClient = new AIClient(options.anthropicApiKey);
    this.ingredientDb = new IngredientDatabase(
      join(options.dataDir, 'ingredients.db')
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.ingredientDb.init();
      this.initialized = true;
    }
  }
```

**Step 4: Update generateWeeklyPlan**

```typescript
  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string,
    dataDir: string
  ): Promise<WeeklyPlan> {
    await this.ensureInitialized();

    const planState = new PlanState(week, profile, pantry);
    const handlers = createToolHandlers(planState, this.ingredientDb);

    // ... rest unchanged
```

**Step 5: Run tests**

Run: `npm test -- src/services/agent-planner.test.ts`
Expected: May need test updates

**Step 6: Commit**

```bash
git add src/services/agent-planner.ts
git commit -m "refactor: update AgentPlanner to use IngredientDatabase"
```

---

## Task 13: Update Commands

**Files:**
- Modify: `src/commands/plan.ts`

**Step 1: Remove USDA_API_KEY reference**

Update `generateWeekPlan` function:

```typescript
export async function generateWeekPlan(dataDir: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const store = new DataStore(dataDir);
  await store.init();

  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  // ... week calculation unchanged ...

  const planner = new AgentPlanner({
    anthropicApiKey: apiKey,
    dataDir,
  });

  // ... rest unchanged
```

**Step 2: Commit**

```bash
git add src/commands/plan.ts
git commit -m "refactor: remove USDA API key from plan command"
```

---

## Task 14: Delete Old Files

**Files:**
- Delete: `src/services/knowledge-base.ts`
- Delete: `src/services/knowledge-base.test.ts`
- Delete: `src/services/usda-client.ts`
- Delete: `src/services/usda-client.test.ts`
- Delete: `data/seed/ingredients.json`
- Delete: `scripts/seed-kb.ts`

**Step 1: Delete files**

```bash
rm src/services/knowledge-base.ts
rm src/services/knowledge-base.test.ts
rm src/services/usda-client.ts
rm src/services/usda-client.test.ts
rm -rf data/seed
rm scripts/seed-kb.ts
```

**Step 2: Remove seed-kb script from package.json**

Remove from scripts:
```json
"seed-kb": "tsx scripts/seed-kb.ts"
```

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old knowledge base and USDA client"
```

---

## Task 15: Update Documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md` (if exists)

**Step 1: Update .env.example**

Remove `USDA_API_KEY`:
```
ANTHROPIC_API_KEY=your_api_key_here
MEAL_PLANNER_DATA_DIR=~/.meal-planner/data
```

**Step 2: Add setup instructions to README if needed**

Add section about building the ingredient database:
```markdown
## Setup

1. Install dependencies: `npm install`
2. Build the ingredient database: `npm run build-ingredient-db`
   - This downloads USDA food data and generates embeddings (~10 min)
3. Set up your `.env` file with `ANTHROPIC_API_KEY`
4. Run the app: `npm run dev`
```

**Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: update setup instructions for ingredient database"
```

---

## Task 16: Final Integration Test

**Step 1: Build the database**

Run: `npm run build-ingredient-db`
Expected: Database built at `data/ingredients.db`

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 3: Test semantic search manually**

Create a quick test script or use the REPL to verify:
- "fish" matches "Fish, raw, mixed species" not "Fish sticks"
- "beans" matches whole beans not bean liquid
- "chicken" finds chicken products

**Step 4: Run the full app**

Run: `npm run dev plan`
Expected: Meal planning works with the new database

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for ingredient database"
```
