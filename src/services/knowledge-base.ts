import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  IngredientsKnowledgeSchema,
  type IngredientEntry,
} from '../schemas/knowledge.js';

export class KnowledgeBase {
  private dataDir: string;
  private ingredientsPath: string;
  private cache: Map<string, IngredientEntry> | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ingredientsPath = join(dataDir, 'knowledge', 'ingredients.json');
  }

  private async ensureDir(): Promise<void> {
    const knowledgeDir = join(this.dataDir, 'knowledge');
    if (!existsSync(knowledgeDir)) {
      await mkdir(knowledgeDir, { recursive: true });
    }
  }

  private async load(): Promise<Map<string, IngredientEntry>> {
    if (this.cache) return this.cache;

    await this.ensureDir();

    if (!existsSync(this.ingredientsPath)) {
      this.cache = new Map();
      return this.cache;
    }

    const content = await readFile(this.ingredientsPath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    const validated = IngredientsKnowledgeSchema.parse(data);
    this.cache = new Map(Object.entries(validated));
    return this.cache;
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    await this.ensureDir();
    const obj = Object.fromEntries(this.cache);
    await writeFile(this.ingredientsPath, JSON.stringify(obj, null, 2));
  }

  async getIngredient(name: string): Promise<IngredientEntry | null> {
    const data = await this.load();
    return data.get(name.toLowerCase()) ?? null;
  }

  async saveIngredient(name: string, entry: IngredientEntry): Promise<void> {
    const data = await this.load();
    data.set(name.toLowerCase(), entry);
    await this.save();
  }

  async searchIngredients(query: string): Promise<IngredientEntry[]> {
    const data = await this.load();
    const lowerQuery = query.toLowerCase();
    const results: IngredientEntry[] = [];

    for (const [key, entry] of data) {
      if (
        key.includes(lowerQuery) ||
        entry.name.toLowerCase().includes(lowerQuery)
      ) {
        results.push(entry);
      }
    }

    return results;
  }

  async getAllIngredients(): Promise<string[]> {
    const data = await this.load();
    return Array.from(data.keys());
  }

  clearCache(): void {
    this.cache = null;
  }
}
