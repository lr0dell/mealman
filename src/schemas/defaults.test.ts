import { describe, it, expect } from 'vitest';
import { createDefaultProfile, createDefaultPantry } from './defaults.js';
import { ProfileSchema, PantrySchema } from './index.js';

describe('Default Data', () => {
  it('creates a valid default profile', () => {
    const profile = createDefaultProfile();
    const result = ProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  });

  it('creates a valid empty pantry', () => {
    const pantry = createDefaultPantry();
    const result = PantrySchema.safeParse(pantry);
    expect(result.success).toBe(true);
    expect(pantry.items).toHaveLength(0);
  });
});
