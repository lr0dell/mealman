# Ingredient Vector Database Design

## Problem

The current ingredient lookup system uses the USDA API, which returns results ranked by the API's internal algorithm. The code takes the first result without evaluating quality of match, leading to incorrect nutrition data:
- "fish" → "Fish, fish sticks, frozen, prepared" (wrong)
- "beans" → reserved bean liquid (wrong)

## Solution

Replace the JSON-based knowledge base and USDA API calls with a local SQLite database containing pre-embedded USDA food data. Use semantic vector search to find the best match for ingredient queries.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SQLite Database                       │
│                  (ingredients.db)                        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ingredients table                                │    │
│  │ - id, name, description                          │    │
│  │ - protein_per_100g, carbs_per_100g, etc.        │    │
│  │ - price_per_unit, unit, unit_weight_grams       │    │
│  │ - category, source ('usda' | 'custom')          │    │
│  │ - embedding (vector, 384 dimensions)            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  sqlite-vec extension for vector similarity search       │
└─────────────────────────────────────────────────────────┘
```

**Lookup flow:**
```
lookup_ingredient("fish")
  → Embed query with transformers.js
  → SELECT * FROM ingredients ORDER BY vec_distance(embedding, ?) LIMIT 1
  → Return nutrition data for "Fish, raw, mixed species"
```

## Database Schema

```sql
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- "Fish, raw, mixed species"
  search_name TEXT NOT NULL,             -- normalized: "fish raw mixed species"

  -- Nutrition per 100g
  protein_per_100g REAL NOT NULL,
  carbs_per_100g REAL NOT NULL,
  fat_per_100g REAL NOT NULL,
  fiber_per_100g REAL NOT NULL,

  -- Pricing
  price_per_unit REAL NOT NULL,
  unit TEXT NOT NULL,                    -- 'kg', 'each', 'liter'
  unit_weight_grams REAL NOT NULL,

  -- Metadata
  category TEXT NOT NULL,                -- 'meat', 'produce', 'dairy', etc.
  source TEXT NOT NULL,                  -- 'usda' | 'custom'
  usda_fdc_id INTEGER,                   -- nullable, only for USDA items
  created_at TEXT NOT NULL,

  -- Vector embedding (384 floats via sqlite-vec)
  embedding BLOB NOT NULL
);

CREATE INDEX idx_category ON ingredients(category);
CREATE INDEX idx_source ON ingredients(source);
```

## Category-Based Default Pricing

| Category | Default Price (per kg) | Examples |
|----------|------------------------|----------|
| meat | $12 | beef, chicken, pork |
| seafood | $15 | fish, shrimp, salmon |
| dairy | $6 | milk, cheese, yogurt |
| produce | $4 | vegetables, fruits |
| grains | $3 | rice, oats, bread |
| legumes | $4 | beans, lentils |
| oils | $8 | olive oil, butter |
| other | $5 | everything else |

## IngredientDatabase Class

```typescript
// src/services/ingredient-database.ts

class IngredientDatabase {
  private db: Database;           // better-sqlite3
  private embedder: Embedder;     // transformers.js wrapper

  constructor(dbPath: string);

  // Primary lookup - semantic search
  async searchIngredient(query: string): Promise<IngredientMatch | null>;

  // Return top N matches (for search_knowledge_base tool)
  async searchIngredients(query: string, limit?: number): Promise<IngredientMatch[]>;

  // Get by exact ID (for internal use)
  getIngredientById(id: number): Ingredient | null;

  // Add custom ingredient
  async addIngredient(ingredient: NewIngredient): Promise<Ingredient>;

  // Update pricing or other fields
  updateIngredient(id: number, updates: Partial<Ingredient>): Ingredient;

  // List all (for get_known_ingredients tool)
  getAllIngredientNames(): string[];

  // Stats
  getStats(): { total: number; byCategory: Record<string, number> };
}

interface IngredientMatch {
  ingredient: Ingredient;
  similarity: number;      // 0-1, how close the match is
}
```

## Build Script

`scripts/build-ingredient-db.ts` run via `npm run build-ingredient-db`:

1. **Download USDA data** - Fetch Foundation + SR Legacy datasets (~50MB)
2. **Parse and categorize** - Extract nutrients, map to simplified categories
3. **Generate embeddings** - Use `all-MiniLM-L6-v2` via transformers.js
4. **Populate SQLite** - Insert all foods with embeddings and default prices

Output: `data/ingredients.db` (~30-40MB)

Users run this script on first install to build their local database.

## Tool Handler Changes

```typescript
// Updated handleLookupIngredient
async function handleLookupIngredient(input, ingredientDb) {
  const match = await ingredientDb.searchIngredient(input.name);

  if (match) {
    return {
      found: true,
      ingredient: match.ingredient,
      matchedName: match.ingredient.name,  // Show what it matched to
      similarity: match.similarity
    };
  }

  return { found: false, message: 'No matching ingredient found' };
}
```

Response includes `matchedName` so the agent can verify the match makes sense.

## Files Changed

**Create:**
- `src/services/ingredient-database.ts` - New main class
- `src/services/embedder.ts` - Wrapper around transformers.js
- `scripts/build-ingredient-db.ts` - USDA import script

**Modify:**
- `src/agent/tool-handlers.ts` - Use `IngredientDatabase` instead of KB + USDA
- `src/agent/agent-planner.ts` - Initialize `IngredientDatabase`, remove USDA client
- `src/commands/plan.ts` - Remove `usdaApiKey` option
- `package.json` - Add dependencies, add `build-ingredient-db` script
- `.env.example` - Remove `USDA_API_KEY`

**Delete:**
- `src/services/knowledge-base.ts`
- `src/services/knowledge-base.test.ts`
- `src/services/usda-client.ts`
- `src/services/usda-client.test.ts`
- `data/seed/ingredients.json`
- `scripts/seed-kb.ts`

## New Dependencies

- `better-sqlite3` - SQLite driver
- `sqlite-vec` - Vector search extension
- `@xenova/transformers` - Local embeddings

## Migration

- Old `knowledge/ingredients.json` becomes obsolete
- Users run `npm run build-ingredient-db` to create new database
- Manually-added ingredients in old KB need to be re-added
