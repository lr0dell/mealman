import { describe, it, expect } from 'vitest';
import { PantrySchema, PantryItemSchema } from './pantry.js';

describe('PantrySchema', () => {
  it('validates a pantry item with ingredientId', () => {
    const item = {
      ingredientId: 42,
      name: 'chicken breast',
      quantity: 500,
      unit: 'g',
      addedDate: '2026-01-27',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects pantry item without ingredientId', () => {
    const item = {
      name: 'chicken breast',
      quantity: 500,
      unit: 'g',
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
          quantity: 500,
          unit: 'g',
          addedDate: '2026-01-27',
        },
        {
          ingredientId: 2,
          name: 'eggs',
          quantity: 600,
          unit: 'g',
          addedDate: '2026-01-25',
        },
      ],
    };

    const result = PantrySchema.safeParse(pantry);
    expect(result.success).toBe(true);
  });
});
