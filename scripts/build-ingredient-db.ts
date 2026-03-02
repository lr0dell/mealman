import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const USDA_FOUNDATION_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2025-12-18.zip';
const USDA_SR_LEGACY_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip';

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
  Sweets: 'other',
  Snacks: 'other',
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

export interface USDAFood {
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

export function getNutrient(food: USDAFood, nutrientId: number): number {
  const nutrient = food.foodNutrients.find((n) => n.nutrient.id === nutrientId);
  return nutrient?.amount ?? 0;
}

export function mergeNutrients(
  existing: USDAFood,
  incoming: USDAFood
): USDAFood {
  const nutrientMap = new Map<number, number>();

  for (const n of existing.foodNutrients) {
    nutrientMap.set(n.nutrient.id, n.amount ?? 0);
  }

  for (const n of incoming.foodNutrients) {
    const current = nutrientMap.get(n.nutrient.id) ?? 0;
    const incomingAmount = n.amount ?? 0;
    if (incomingAmount > 0 && current === 0) {
      nutrientMap.set(n.nutrient.id, incomingAmount);
    }
  }

  return {
    ...existing,
    foodNutrients: Array.from(nutrientMap.entries()).map(([id, amount]) => ({
      nutrient: { id },
      amount,
    })),
  };
}

export function deduplicateWithMerge(allFoods: USDAFood[]): USDAFood[] {
  const foodMap = new Map<number, USDAFood>();
  for (const food of allFoods) {
    const existing = foodMap.get(food.fdcId);
    if (existing) {
      foodMap.set(food.fdcId, mergeNutrients(existing, food));
    } else {
      foodMap.set(food.fdcId, food);
    }
  }
  return Array.from(foodMap.values());
}

const FIBER_EXPECTED_CATEGORIES = new Set(['produce', 'grains', 'legumes']);

export function findFiberGaps(
  ingredients: Array<{ name: string; fiberPer100g: number; category: string }>
): Array<{ name: string; category: string }> {
  return ingredients
    .filter(
      (i) => i.fiberPer100g === 0 && FIBER_EXPECTED_CATEGORIES.has(i.category)
    )
    .map((i) => ({ name: i.name, category: i.category }));
}

function getCategory(food: USDAFood): string {
  const categoryName = food.foodCategory?.description ?? '';
  return CATEGORY_MAP[categoryName] ?? 'other';
}

async function main() {
  let dataDir =
    process.env.MEAL_DATA_DIR || join(homedir(), '.meal-planner', 'data');

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

  // Deduplicate by fdcId, merging nutrients across datasets
  const foods = deduplicateWithMerge(allFoods);
  const mergedCount = allFoods.length - foods.length;
  if (mergedCount > 0) {
    console.log(`Merged nutrients for ${mergedCount} duplicate foods`);
  }
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
      pricePerGram: CATEGORY_PRICES[category] / 1000,
    };
  });

  // Warn about remaining fiber data gaps
  const fiberGaps = findFiberGaps(ingredients);
  if (fiberGaps.length > 0) {
    console.warn(
      `\nWARNING: ${fiberGaps.length} ingredients in fiber-expected categories have 0 fiber:`
    );
    for (const gap of fiberGaps.slice(0, 20)) {
      console.warn(`  - "${gap.name}" (${gap.category})`);
    }
    if (fiberGaps.length > 20) {
      console.warn(`  ... and ${fiberGaps.length - 20} more`);
    }
  }

  // Save intermediate JSON for the next step
  const outputPath = join(dataDir, 'usda-foods.json');
  writeFileSync(outputPath, JSON.stringify(ingredients, null, 2));
  console.log(`Saved ${ingredients.length} ingredients to ${outputPath}`);
  console.log(
    'Run "npm run embed-ingredients" to generate embeddings and build the database.'
  );
}

main().catch(console.error);
