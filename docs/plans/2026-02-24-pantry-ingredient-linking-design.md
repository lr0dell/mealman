# Pantry-Ingredient Database Linking

## Goal

Mandate that all pantry items reference a valid ingredient in the SQLite ingredient database by storing `ingredientId` on each pantry item and requiring interactive selection during `pantry add`.

## Schema Change

Add `ingredientId` (required) to `PantryItemSchema`. The `name` field stores the canonical ingredient name from the DB rather than free-text user input.

```typescript
PantryItemSchema = z.object({
  ingredientId: z.number(),       // NEW: references ingredients.id
  name: z.string(),               // canonical name from ingredient DB
  quantity: z.number().positive(),
  unit: z.string(),
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

## Interactive Ingredient Selection

When a user runs `meal pantry add "chicken" 2 lbs`:

1. Search the ingredient DB using `searchIngredients("chicken", 5)`
2. Present a navigable list showing top 5 matches with similarity scores
3. User selects one: pantry item created with that ingredient's `id` and canonical `name`
4. User selects Cancel: nothing added

The search logic from `ingredientDb.searchIngredients()` is reusable. Extract the search + format logic into a shared utility usable by both CLI and the agent's `lookup_ingredient` tool.

## Startup Validation

On pantry load, silently remove any items that lack a valid `ingredientId`. No migration prompt needed (no existing userbase).

## Impact on Existing Code

- **Shopping list (`shop.ts`):** No change needed. Already matches on `name|unit`; canonical names improve reliability.
- **Plan state (`plan-state.ts`):** No change needed. Reads `name`, `quantity`, `unit` which still exist.
- **Pantry commands (`pantry.ts`):** `addPantryItem` accepts `ingredientId` and canonical name. `removePantryItem` unchanged. Merge logic (same name + unit) unchanged.
- **CLI handler (`cli/index.ts`):** Does search + interactive select before calling `addPantryItem`.
