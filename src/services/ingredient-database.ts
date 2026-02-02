import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { Embedder } from './embedder.js';
import type {
  Ingredient,
  NewIngredient,
  IngredientMatch,
  IngredientCategory,
} from '../schemas/knowledge.js';

const EMBEDDING_DIMENSIONS = 384;

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

    const id = result.lastInsertRowid;

    // Generate and store embedding
    const embedding = await this.embedder.embed(input.name);
    // sqlite-vec requires bigint for INTEGER PRIMARY KEY columns
    const idBigInt = typeof id === 'bigint' ? id : BigInt(id);
    this.db
      .prepare(
        'INSERT INTO ingredient_embeddings (ingredient_id, embedding) VALUES (?, ?)'
      )
      .run(idBigInt, Buffer.from(embedding.buffer));

    return this.getIngredientById(id)!;
  }

  getIngredientById(id: number | bigint): Ingredient | null {
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
