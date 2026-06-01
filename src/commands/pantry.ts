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
    let line = `  - ${item.name}: ${item.quantity} ${item.unit}`;
    if (item.expirationDate) {
      line += ` (expires: ${item.expirationDate})`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export async function getExpiringItems(
  store: DataStore,
  daysAhead: number = 3
): Promise<PantryItem[]> {
  const pantry = await store.getPantry();
  const today = new Date();
  const cutoff = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return pantry.items.filter((item) => {
    if (!item.expirationDate) return false;
    const expDate = new Date(item.expirationDate);
    return expDate <= cutoff;
  });
}

export function formatExpiringList(items: PantryItem[]): string {
  if (items.length === 0) {
    return 'No items expiring soon.';
  }

  const lines = ['Items Expiring Soon:', ''];
  for (const item of items) {
    lines.push(
      `  - ${item.name}: ${item.quantity} ${item.unit} (expires: ${item.expirationDate})`
    );
  }
  return lines.join('\n');
}

export async function addPantryItem(
  store: DataStore,
  ingredientId: number,
  name: string,
  quantity: number,
  expirationDate?: string
): Promise<void> {
  const pantry = await store.getPantry();
  const today = new Date().toISOString().split('T')[0];

  const existing = pantry.items.find(
    (item) => item.ingredientId === ingredientId
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
      unit: 'g',
      addedDate: today,
    };
    if (expirationDate) {
      newItem.expirationDate = expirationDate;
    }
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
