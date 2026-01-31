import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

async function seedKnowledgeBase(): Promise<void> {
  const dataDir =
    process.env.MEAL_PLANNER_DATA_DIR || join(process.cwd(), 'data');
  const kbDir = join(dataDir, 'knowledge');
  const kbPath = join(kbDir, 'ingredients.json');
  const seedPath = join(process.cwd(), 'data', 'seed', 'ingredients.json');

  // Ensure directory exists
  if (!existsSync(kbDir)) {
    await mkdir(kbDir, { recursive: true });
  }

  // Read seed data
  const seedData = await readFile(seedPath, 'utf-8');

  // Write to KB (this will overwrite existing)
  await writeFile(kbPath, seedData);

  console.log(`Seeded knowledge base at ${kbPath}`);
}

seedKnowledgeBase().catch(console.error);
