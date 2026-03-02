# Grams-Only Units & Ingredient ID Linking

## Problem

The meal planner has inconsistent unit handling:
- Pantry items use freeform units (lbs, count, cups, etc.)
- Meal ingredients in plans use grams but the schema allows any string
- The ingredient database stores `unit`/`unitWeightGrams` for pricing, adding unnecessary complexity
- Meal ingredients reference the ingredient database by name (semantic search) rather than by ID, which is brittle

## Decision

Lock all units to grams across the entire system and require meal ingredients to reference ingredient database entries by ID.

## Design

### Ingredient Database

Remove `unit` and `unit_weight_grams` columns. Rename `price_per_unit` to `price_per_gram`.

```sql
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  protein_per_100g REAL NOT NULL,
  carbs_per_100g REAL NOT NULL,
  fat_per_100g REAL NOT NULL,
  fiber_per_100g REAL NOT NULL,
  price_per_gram REAL NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  usda_fdc_id INTEGER,
  created_at TEXT NOT NULL
);
```

TypeScript `Ingredient` interface: remove `unit`, `unitWeightGrams`, rename `pricePerUnit` → `pricePerGram`.

### Meal Ingredient Schema (plan.ts)

```typescript
const MealIngredientSchema = z.object({
  ingredientId: z.number(),     // links to ingredient DB
  name: z.string(),             // display name
  amount: z.number().positive(), // always grams
  unit: z.literal('g'),         // locked to 'g'
});
```

### Pantry Schema (pantry.ts)

```typescript
const PantryItemSchema = z.object({
  ingredientId: z.number(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.literal('g'),           // was z.string()
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
```

### Macro Calculator (macro-calculator.ts)

```typescript
interface IngredientWithNutrition {
  name: string;
  amountGrams: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  pricePerGram: number;
}
```

Cost calculation: `amountGrams * pricePerGram` (was `(amountGrams / unitWeightGrams) * pricePerUnit`).

### Tool Handlers (tool-handlers.ts)

`add_meal`: Still accepts `{ name, amountGrams }` from the AI agent. Resolves ingredient via semantic search, stores `{ ingredientId: entry.id, name: entry.name, amount: ing.amountGrams, unit: 'g' }` in the meal.

`lookup_ingredient`: Returns `{ id, name, similarity, proteinPer100g, ..., pricePerGram }`.

### Knowledge Base Schema (knowledge.ts)

`IngredientEntry`: Remove `unit`/`unitWeightGrams`, rename `pricePerUnit` → `pricePerGram`.

### USDA Build Script (scripts/build-ingredient-db.ts)

Convert prices: `pricePerGram: CATEGORY_PRICES[category] / 1000` (e.g., $12/kg → $0.012/g). Remove `unit`/`unitWeightGrams` from output.

### AI Prompts

Update agent system prompt to state all amounts are in grams. Remove unit references.

## Migration

No migration of existing data. Old plans/pantry files are treated as non-existent.

## Out of Scope

- Multi-unit support (deferred to future work)
- Backward compatibility with existing saved plans/pantry data
