import { describe, it, expect } from 'vitest';
import { PantrySchema, PantryItemSchema } from './pantry.js';

describe('PantrySchema', () => {
  it('validates a pantry item with ingredientId', () => {
    const item = {
      ingredientId: 42,
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
      expirationDate: '2026-02-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects pantry item without ingredientId', () => {
    const item = {
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('validates pantry with items', () => {
    const pantry = {
      items: [
        {
          ingredientId: 1,
          name: 'chicken breast',
          quantity: 2,
          unit: 'lbs',
          addedDate: '2026-01-27',
          expirationDate: '2026-02-01',
        },
        {
          ingredientId: 2,
          name: 'eggs',
          quantity: 12,
          unit: 'count',
          addedDate: '2026-01-25',
        },
      ],
    };

    const result = PantrySchema.safeParse(pantry);
    expect(result.success).toBe(true);
  });

  it('validates pantry item without expiration date', () => {
    const item = {
      ingredientId: 10,
      name: 'rice',
      quantity: 5,
      unit: 'lbs',
      addedDate: '2026-01-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});
