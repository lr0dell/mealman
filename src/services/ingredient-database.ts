import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { Embedder } from './embedder.js';

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
