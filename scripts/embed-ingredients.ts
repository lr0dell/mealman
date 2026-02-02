import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { IngredientDatabase } from '../src/services/ingredient-database.js';
import type { IngredientCategory } from '../src/schemas/knowledge.js';
import { homedir } from 'node:os';

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
  let dataDir =
    process.env.MEAL_DATA_DIR || join(homedir(), '.meal-planner', 'data');
  const inputPath = join(dataDir, 'usda-foods.json');
  const dbPath = join(dataDir, 'ingredients.db');

  if (!existsSync(inputPath)) {
    console.error(
      'Error: usda-foods.json not found. Run "npm run download-usda" first.'
    );
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
    process.stdout.write(
      `\rProcessed ${processed}/${ingredients.length} (${pct}%)`
    );
  }

  console.log('\n');

  const stats = db.getStats();
  console.log(`Database built successfully!`);
  console.log(`Total ingredients: ${stats.total}`);
  console.log(`By category:`, stats.byCategory);

  db.close();
}

main().catch(console.error);
