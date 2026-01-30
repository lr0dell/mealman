import type { DataStore } from '../data/index.js';
import type { PantryItem } from '../schemas/index.js';

export async function listPantry(store: DataStore): Promise<PantryItem[]> {
  const pantry = await store.getPantry();
  return pantry.items;
}

export function formatPantryList(items: PantryItem[]): string {
  if (items.length === 0) {
    return 'Your pantry is empty. Add items with: meal pantry add "<items>"';
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
    lines.push(`  - ${item.name}: ${item.quantity} ${item.unit} (expires: ${item.expirationDate})`);
  }
  return lines.join('\n');
}

export async function addPantryItem(
  store: DataStore,
  name: string,
  quantity: number,
  unit: string,
  expirationDate?: string
): Promise<void> {
  const pantry = await store.getPantry();
  const today = new Date().toISOString().split('T')[0];

  // Check if item already exists (same name and unit)
  const existing = pantry.items.find(
    (item) => item.name.toLowerCase() === name.toLowerCase() && item.unit === unit
  );

  if (existing) {
    existing.quantity += quantity;
    // Update expiration if new one is sooner
    if (expirationDate && (!existing.expirationDate || expirationDate < existing.expirationDate)) {
      existing.expirationDate = expirationDate;
    }
  } else {
    const newItem: PantryItem = {
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

export async function removePantryItem(store: DataStore, name: string): Promise<boolean> {
  const pantry = await store.getPantry();
  const initialLength = pantry.items.length;

  pantry.items = pantry.items.filter(
    (item) => item.name.toLowerCase() !== name.toLowerCase()
  );

  if (pantry.items.length === initialLength) {
    return false; // Item not found
  }

  await store.savePantry(pantry);
  return true;
}