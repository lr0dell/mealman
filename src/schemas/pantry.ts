import { z } from 'zod';

export const PantryItemSchema = z.object({
  ingredientId: z.number(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.literal('g'),
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const PantrySchema = z.object({
  items: z.array(PantryItemSchema),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;
export type Pantry = z.infer<typeof PantrySchema>;
