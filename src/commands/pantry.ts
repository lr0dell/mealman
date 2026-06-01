import type { DataStore } from '../data/index.js';
import type { PantryItem } from '../schemas/index.js';

export async function listPantry(store: DataStore): Promise<PantryItem[]> {
  const pantry = await store.getPantry();
  return pantry.items;
}

export function formatPantryList(items: PantryItem[]): string {
  if (items.length === 0) {
    return 'Your pantry is empty. Add items with: mealman pantry add "<items>"';
  }

  const lines = ['Pantry Items:', ''];
  for (const item of items) {
    lines.push(`  - ${item.name}: ${item.quantity} ${item.unit}`);
  }
  return lines.join('\n');
}

export async function addPantryItem(
  store: DataStore,
  ingredientId: number,
  name: string,
  quantity: number
): Promise<void> {
  const pantry = await store.getPantry();
  const today = new Date().toISOString().split('T')[0];

  const existing = pantry.items.find(
    (item) => item.ingredientId === ingredientId
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    const newItem: PantryItem = {
      ingredientId,
      name: name.toLowerCase(),
      quantity,
      unit: 'g',
      addedDate: today,
    };
    pantry.items.push(newItem);
  }

  await store.savePantry(pantry);
}

export async function removePantryItem(
  store: DataStore,
  ingredientId: number,
  amount?: number
): Promise<'removed' | 'decremented'> {
  const pantry = await store.getPantry();
  const item = pantry.items.find((i) => i.ingredientId === ingredientId);

  if (!item) {
    throw new Error(
      `No pantry item with ingredientId ${ingredientId}; this should not happen.`
    );
  }

  if (amount === undefined || amount >= item.quantity) {
    pantry.items = pantry.items.filter((i) => i.ingredientId !== ingredientId);
    await store.savePantry(pantry);
    return 'removed';
  }

  item.quantity -= amount;
  await store.savePantry(pantry);
  return 'decremented';
}
