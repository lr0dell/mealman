# AI Meal Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI-first meal planning application that uses Claude to generate personalized weekly meal plans with macro/budget tracking, pantry management, and learning from feedback.

**Architecture:** Three-layer design with CLI (Commander.js) → AI Planning Engine (Anthropic SDK) → Data Layer (local JSON files). All AI responses validated with Zod schemas.

**Tech Stack:** TypeScript, Node.js, Commander.js, Anthropic SDK, Zod, Vitest (testing)

---

## Phase 1: Project Foundation

### Task 1: Initialize TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`

**Step 1: Initialize npm project**

Run: `npm init -y`

**Step 2: Install dependencies**

Run: `npm install typescript commander @anthropic-ai/sdk zod chalk`
Run: `npm install -D vitest @types/node tsx`

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 5: Update package.json scripts**

Add to package.json:
```json
{
  "type": "module",
  "bin": {
    "meal": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Step 6: Create minimal entry point**

Create `src/index.ts`:
```typescript
#!/usr/bin/env node

console.log('AI Meal Planner');
```

**Step 7: Verify setup works**

Run: `npm run dev`
Expected: Prints "AI Meal Planner"

Run: `npm run build`
Expected: Creates dist/index.js

**Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/index.ts
git commit -m "chore: initialize TypeScript project with Commander.js and Vitest"
```

---

## Phase 2: Data Layer - Schemas and Types

### Task 2: Define Core Zod Schemas

**Files:**
- Create: `src/schemas/profile.ts`
- Create: `src/schemas/pantry.ts`
- Create: `src/schemas/plan.ts`
- Create: `src/schemas/knowledge.ts`
- Create: `src/schemas/index.ts`
- Test: `src/schemas/profile.test.ts`

**Step 1: Write failing test for profile schema**

Create `src/schemas/profile.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ProfileSchema } from './profile';

describe('ProfileSchema', () => {
  it('validates a complete profile', () => {
    const validProfile = {
      household: {
        size: 2,
        members: [
          { name: 'User', dietaryRestrictions: [] },
          { name: 'Partner', dietaryRestrictions: ['vegetarian'] },
        ],
      },
      goals: {
        dailyCalories: 2000,
        macros: { protein: 150, carbs: 200, fat: 70 },
        weeklyBudget: 150,
      },
      dietary: {
        restrictions: ['nut-allergy'],
        dislikes: ['olives', 'blue cheese'],
      },
      preferences: {
        cuisines: ['thai', 'mexican', 'mediterranean'],
        maxPrepTime: { weekday: 30, weekend: 60 },
        complexityTolerance: 'medium',
      },
      constraints: {
        kitchenware: ['instant-pot', 'air-fryer', 'basic'],
        skillLevel: 'intermediate',
      },
      learned: {
        lovedMeals: [],
        dislikedMeals: [],
        patterns: [],
      },
    };

    const result = ProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it('rejects profile with missing required fields', () => {
    const invalidProfile = {
      household: { size: 2 },
    };

    const result = ProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/schemas/profile.test.ts`
Expected: FAIL - Cannot find module './profile'

**Step 3: Implement ProfileSchema**

Create `src/schemas/profile.ts`:
```typescript
import { z } from 'zod';

export const HouseholdMemberSchema = z.object({
  name: z.string(),
  dietaryRestrictions: z.array(z.string()),
});

export const HouseholdSchema = z.object({
  size: z.number().int().positive(),
  members: z.array(HouseholdMemberSchema),
});

export const MacrosSchema = z.object({
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const GoalsSchema = z.object({
  dailyCalories: z.number().positive(),
  macros: MacrosSchema,
  weeklyBudget: z.number().positive(),
});

export const DietarySchema = z.object({
  restrictions: z.array(z.string()),
  dislikes: z.array(z.string()),
});

export const PrepTimeSchema = z.object({
  weekday: z.number().positive(),
  weekend: z.number().positive(),
});

export const PreferencesSchema = z.object({
  cuisines: z.array(z.string()),
  maxPrepTime: PrepTimeSchema,
  complexityTolerance: z.enum(['low', 'medium', 'high']),
});

export const ConstraintsSchema = z.object({
  kitchenware: z.array(z.string()),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
});

export const LearnedSchema = z.object({
  lovedMeals: z.array(z.string()),
  dislikedMeals: z.array(z.string()),
  patterns: z.array(z.string()),
});

export const ProfileSchema = z.object({
  household: HouseholdSchema,
  goals: GoalsSchema,
  dietary: DietarySchema,
  preferences: PreferencesSchema,
  constraints: ConstraintsSchema,
  learned: LearnedSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Macros = z.infer<typeof MacrosSchema>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/schemas/profile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/profile.ts src/schemas/profile.test.ts
git commit -m "feat: add Zod schema for user profile"
```

---

### Task 3: Define Pantry Schema

**Files:**
- Create: `src/schemas/pantry.ts`
- Test: `src/schemas/pantry.test.ts`

**Step 1: Write failing test for pantry schema**

Create `src/schemas/pantry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PantrySchema, PantryItemSchema } from './pantry';

describe('PantrySchema', () => {
  it('validates a pantry item', () => {
    const item = {
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
      expirationDate: '2026-02-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('validates pantry with items', () => {
    const pantry = {
      items: [
        {
          name: 'chicken breast',
          quantity: 2,
          unit: 'lbs',
          addedDate: '2026-01-27',
          expirationDate: '2026-02-01',
        },
        {
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
      name: 'rice',
      quantity: 5,
      unit: 'lbs',
      addedDate: '2026-01-01',
    };

    const result = PantryItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/schemas/pantry.test.ts`
Expected: FAIL - Cannot find module './pantry'

**Step 3: Implement PantrySchema**

Create `src/schemas/pantry.ts`:
```typescript
import { z } from 'zod';

export const PantryItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  addedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const PantrySchema = z.object({
  items: z.array(PantryItemSchema),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;
export type Pantry = z.infer<typeof PantrySchema>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/schemas/pantry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/pantry.ts src/schemas/pantry.test.ts
git commit -m "feat: add Zod schema for pantry management"
```

---

### Task 4: Define Knowledge Tables Schema

**Files:**
- Create: `src/schemas/knowledge.ts`
- Test: `src/schemas/knowledge.test.ts`

**Step 1: Write failing test**

Create `src/schemas/knowledge.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { IngredientsKnowledgeSchema, MealsKnowledgeSchema } from './knowledge';

describe('Knowledge Schemas', () => {
  it('validates ingredient knowledge entry', () => {
    const ingredients = {
      'chicken breast': {
        pricePerUnit: 4.5,
        unit: 'lb',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        lastUpdated: '2026-01-20',
        source: 'manual',
      },
    };

    const result = IngredientsKnowledgeSchema.safeParse(ingredients);
    expect(result.success).toBe(true);
  });

  it('validates meal knowledge entry', () => {
    const meals = {
      'chipotle burrito bowl': {
        estimatedCalories: 800,
        estimatedProtein: 45,
        estimatedCarbs: 70,
        estimatedFat: 35,
        estimatedCost: 12,
        lastUpdated: '2026-01-15',
        source: 'ai-estimate',
      },
    };

    const result = MealsKnowledgeSchema.safeParse(meals);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/schemas/knowledge.test.ts`
Expected: FAIL

**Step 3: Implement Knowledge Schemas**

Create `src/schemas/knowledge.ts`:
```typescript
import { z } from 'zod';

export const IngredientEntrySchema = z.object({
  pricePerUnit: z.number().nonnegative(),
  unit: z.string(),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['manual', 'ai-estimate', 'web']),
});

export const IngredientsKnowledgeSchema = z.record(z.string(), IngredientEntrySchema);

export const MealEntrySchema = z.object({
  estimatedCalories: z.number().nonnegative(),
  estimatedProtein: z.number().nonnegative(),
  estimatedCarbs: z.number().nonnegative(),
  estimatedFat: z.number().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['manual', 'ai-estimate']),
});

export const MealsKnowledgeSchema = z.record(z.string(), MealEntrySchema);

export type IngredientEntry = z.infer<typeof IngredientEntrySchema>;
export type MealEntry = z.infer<typeof MealEntrySchema>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/schemas/knowledge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/knowledge.ts src/schemas/knowledge.test.ts
git commit -m "feat: add Zod schemas for knowledge tables"
```

---

### Task 5: Define Weekly Plan Schema

**Files:**
- Create: `src/schemas/plan.ts`
- Test: `src/schemas/plan.test.ts`

**Step 1: Write failing test**

Create `src/schemas/plan.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { WeeklyPlanSchema, MealSchema } from './plan';

describe('Plan Schemas', () => {
  it('validates a meal entry', () => {
    const meal = {
      name: 'Greek yogurt with berries',
      recipe: 'Mix yogurt with fresh berries',
      ingredients: [
        { name: 'greek yogurt', amount: 1, unit: 'cup' },
        { name: 'mixed berries', amount: 0.5, unit: 'cup' },
      ],
      prepTime: 5,
      calories: 350,
      macros: { protein: 20, carbs: 40, fat: 10 },
      estimatedCost: 3.5,
      servings: 1,
      leftoverOf: null,
    };

    const result = MealSchema.safeParse(meal);
    expect(result.success).toBe(true);
  });

  it('validates a weekly plan', () => {
    const plan = {
      week: '2026-W05',
      generatedAt: '2026-01-29T10:00:00Z',
      days: [
        {
          date: '2026-01-27',
          meals: {
            breakfast: {
              name: 'Oatmeal',
              recipe: 'Cook oats with water',
              ingredients: [{ name: 'oats', amount: 0.5, unit: 'cup' }],
              prepTime: 10,
              calories: 300,
              macros: { protein: 10, carbs: 50, fat: 5 },
              estimatedCost: 0.5,
              servings: 1,
              leftoverOf: null,
            },
            lunch: null,
            dinner: null,
          },
        },
      ],
      totals: {
        calories: 2100,
        macros: { protein: 150, carbs: 200, fat: 70 },
        estimatedCost: 142.5,
      },
    };

    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/schemas/plan.test.ts`
Expected: FAIL

**Step 3: Implement Plan Schema**

Create `src/schemas/plan.ts`:
```typescript
import { z } from 'zod';
import { MacrosSchema } from './profile';

export const MealIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().positive(),
  unit: z.string(),
});

export const MealSchema = z.object({
  name: z.string(),
  recipe: z.string(),
  ingredients: z.array(MealIngredientSchema),
  prepTime: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  macros: MacrosSchema,
  estimatedCost: z.number().nonnegative(),
  servings: z.number().positive(),
  leftoverOf: z.string().nullable(),
});

export const DayMealsSchema = z.object({
  breakfast: MealSchema.nullable(),
  lunch: MealSchema.nullable(),
  dinner: MealSchema.nullable(),
});

export const DayPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meals: DayMealsSchema,
});

export const PlanTotalsSchema = z.object({
  calories: z.number().nonnegative(),
  macros: MacrosSchema,
  estimatedCost: z.number().nonnegative(),
});

export const WeeklyPlanSchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  generatedAt: z.string(),
  days: z.array(DayPlanSchema),
  totals: PlanTotalsSchema,
});

export type Meal = z.infer<typeof MealSchema>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/schemas/plan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/schemas/plan.ts src/schemas/plan.test.ts
git commit -m "feat: add Zod schema for weekly meal plans"
```

---

### Task 6: Create Schema Index and Defaults

**Files:**
- Create: `src/schemas/index.ts`
- Create: `src/schemas/defaults.ts`
- Test: `src/schemas/defaults.test.ts`

**Step 1: Write failing test for defaults**

Create `src/schemas/defaults.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createDefaultProfile, createDefaultPantry } from './defaults';
import { ProfileSchema, PantrySchema } from './index';

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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/schemas/defaults.test.ts`
Expected: FAIL

**Step 3: Create schema index**

Create `src/schemas/index.ts`:
```typescript
export * from './profile';
export * from './pantry';
export * from './knowledge';
export * from './plan';
```

**Step 4: Implement defaults**

Create `src/schemas/defaults.ts`:
```typescript
import type { Profile, Pantry } from './index';

export function createDefaultProfile(): Profile {
  return {
    household: {
      size: 1,
      members: [{ name: 'User', dietaryRestrictions: [] }],
    },
    goals: {
      dailyCalories: 2000,
      macros: { protein: 150, carbs: 200, fat: 65 },
      weeklyBudget: 100,
    },
    dietary: {
      restrictions: [],
      dislikes: [],
    },
    preferences: {
      cuisines: [],
      maxPrepTime: { weekday: 30, weekend: 60 },
      complexityTolerance: 'medium',
    },
    constraints: {
      kitchenware: ['basic'],
      skillLevel: 'beginner',
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };
}

export function createDefaultPantry(): Pantry {
  return {
    items: [],
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/schemas/defaults.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/schemas/index.ts src/schemas/defaults.ts src/schemas/defaults.test.ts
git commit -m "feat: add schema index and default data factories"
```

---

## Phase 3: Data Layer - File Operations

### Task 7: Implement Data Store

**Files:**
- Create: `src/data/store.ts`
- Test: `src/data/store.test.ts`

**Step 1: Write failing test**

Create `src/data/store.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from './store';
import { ProfileSchema, PantrySchema } from '../schemas';

describe('DataStore', () => {
  const testDir = join(process.cwd(), 'test-data');
  let store: DataStore;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('creates data directory structure on init', async () => {
    await store.init();
    expect(existsSync(join(testDir, 'knowledge'))).toBe(true);
    expect(existsSync(join(testDir, 'plans'))).toBe(true);
    expect(existsSync(join(testDir, 'history'))).toBe(true);
  });

  it('creates default profile if none exists', async () => {
    await store.init();
    const profile = await store.getProfile();
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('creates empty pantry if none exists', async () => {
    await store.init();
    const pantry = await store.getPantry();
    expect(PantrySchema.safeParse(pantry).success).toBe(true);
    expect(pantry.items).toHaveLength(0);
  });

  it('saves and loads profile', async () => {
    await store.init();
    const profile = await store.getProfile();
    profile.goals.dailyCalories = 2500;
    await store.saveProfile(profile);

    const loaded = await store.getProfile();
    expect(loaded.goals.dailyCalories).toBe(2500);
  });

  it('saves and loads pantry', async () => {
    await store.init();
    const pantry = await store.getPantry();
    pantry.items.push({
      name: 'eggs',
      quantity: 12,
      unit: 'count',
      addedDate: '2026-01-29',
    });
    await store.savePantry(pantry);

    const loaded = await store.getPantry();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0].name).toBe('eggs');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/data/store.test.ts`
Expected: FAIL

**Step 3: Implement DataStore**

Create `src/data/store.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ProfileSchema,
  PantrySchema,
  IngredientsKnowledgeSchema,
  WeeklyPlanSchema,
  type Profile,
  type Pantry,
} from '../schemas';
import { createDefaultProfile, createDefaultPantry } from '../schemas/defaults';

export class DataStore {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async init(): Promise<void> {
    const dirs = ['knowledge', 'plans', 'history'];
    for (const dir of dirs) {
      const path = join(this.dataDir, dir);
      if (!existsSync(path)) {
        await mkdir(path, { recursive: true });
      }
    }

    // Create default files if they don't exist
    if (!existsSync(this.profilePath)) {
      await this.saveProfile(createDefaultProfile());
    }
    if (!existsSync(this.pantryPath)) {
      await this.savePantry(createDefaultPantry());
    }
  }

  private get profilePath(): string {
    return join(this.dataDir, 'profile.json');
  }

  private get pantryPath(): string {
    return join(this.dataDir, 'pantry.json');
  }

  async getProfile(): Promise<Profile> {
    const content = await readFile(this.profilePath, 'utf-8');
    const data = JSON.parse(content);
    return ProfileSchema.parse(data);
  }

  async saveProfile(profile: Profile): Promise<void> {
    ProfileSchema.parse(profile); // Validate before saving
    await writeFile(this.profilePath, JSON.stringify(profile, null, 2));
  }

  async getPantry(): Promise<Pantry> {
    const content = await readFile(this.pantryPath, 'utf-8');
    const data = JSON.parse(content);
    return PantrySchema.parse(data);
  }

  async savePantry(pantry: Pantry): Promise<void> {
    PantrySchema.parse(pantry); // Validate before saving
    await writeFile(this.pantryPath, JSON.stringify(pantry, null, 2));
  }

  async getWeeklyPlan(week: string): Promise<WeeklyPlan | null> {
    const path = join(this.dataDir, 'plans', `${week}.json`);
    if (!existsSync(path)) {
      return null;
    }
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return WeeklyPlanSchema.parse(data);
  }

  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
    WeeklyPlanSchema.parse(plan);
    const path = join(this.dataDir, 'plans', `${plan.week}.json`);
    await writeFile(path, JSON.stringify(plan, null, 2));
  }
}

type WeeklyPlan = import('../schemas').WeeklyPlan;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/data/store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.test.ts
git commit -m "feat: implement DataStore for local JSON persistence"
```

---

### Task 8: Add Data Store Index

**Files:**
- Create: `src/data/index.ts`

**Step 1: Create index file**

Create `src/data/index.ts`:
```typescript
export { DataStore } from './store';
```

**Step 2: Verify tests still pass**

Run: `npm test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/data/index.ts
git commit -m "chore: add data module index"
```

---

## Phase 4: CLI Framework

### Task 9: Set Up Commander.js CLI Structure

**Files:**
- Modify: `src/index.ts`
- Create: `src/cli/index.ts`
- Test: `src/cli/index.test.ts`

**Step 1: Write failing test**

Create `src/cli/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createProgram } from './index';

describe('CLI Program', () => {
  it('creates a program with name and version', () => {
    const program = createProgram();
    expect(program.name()).toBe('meal');
    expect(program.version()).toBeDefined();
  });

  it('has pantry command', () => {
    const program = createProgram();
    const pantryCmd = program.commands.find((c) => c.name() === 'pantry');
    expect(pantryCmd).toBeDefined();
  });

  it('has plan command', () => {
    const program = createProgram();
    const planCmd = program.commands.find((c) => c.name() === 'plan');
    expect(planCmd).toBeDefined();
  });

  it('has profile command', () => {
    const program = createProgram();
    const profileCmd = program.commands.find((c) => c.name() === 'profile');
    expect(profileCmd).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/cli/index.test.ts`
Expected: FAIL

**Step 3: Implement CLI structure**

Create `src/cli/index.ts`:
```typescript
import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('meal')
    .description('AI-powered meal planning CLI')
    .version('0.1.0');

  // Pantry management
  const pantry = program
    .command('pantry')
    .description('Manage your pantry inventory');

  pantry
    .command('list')
    .description('List all pantry items')
    .action(() => {
      console.log('Pantry list command - not yet implemented');
    });

  pantry
    .command('add <items...>')
    .description('Add items to pantry (natural language)')
    .action((items: string[]) => {
      console.log('Adding:', items.join(' '));
    });

  pantry
    .command('remove <item>')
    .description('Remove an item from pantry')
    .action((item: string) => {
      console.log('Removing:', item);
    });

  pantry
    .command('expiring')
    .description('Show items expiring within 3 days')
    .action(() => {
      console.log('Expiring items - not yet implemented');
    });

  // Meal planning
  const plan = program
    .command('plan')
    .description('Generate and manage meal plans');

  plan
    .command('week')
    .description('Generate next week plan')
    .action(() => {
      console.log('Weekly plan - not yet implemented');
    });

  plan
    .command('today')
    .description('Regenerate just today')
    .action(() => {
      console.log('Today plan - not yet implemented');
    });

  plan
    .command('adjust <description>')
    .description('Adjust plan with natural language')
    .action((description: string) => {
      console.log('Adjusting:', description);
    });

  // Profile management
  const profile = program
    .command('profile')
    .description('Manage your profile and preferences');

  profile
    .command('show')
    .description('Show current profile')
    .action(() => {
      console.log('Profile show - not yet implemented');
    });

  profile
    .command('update')
    .description('Interactive profile update')
    .action(() => {
      console.log('Profile update - not yet implemented');
    });

  return program;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/cli/index.test.ts`
Expected: PASS

**Step 5: Update main entry point**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node

import { createProgram } from './cli/index';

const program = createProgram();
program.parse();
```

**Step 6: Verify CLI runs**

Run: `npm run dev -- --help`
Expected: Shows help with pantry, plan, profile commands

**Step 7: Commit**

```bash
git add src/index.ts src/cli/index.ts src/cli/index.test.ts
git commit -m "feat: set up Commander.js CLI structure with pantry, plan, profile commands"
```

---

## Phase 5: Pantry Commands Implementation

### Task 10: Implement Pantry List Command

**Files:**
- Create: `src/commands/pantry.ts`
- Test: `src/commands/pantry.test.ts`
- Modify: `src/cli/index.ts`

**Step 1: Write failing test**

Create `src/commands/pantry.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data';
import { listPantry, formatPantryList } from './pantry';

describe('Pantry Commands', () => {
  const testDir = join(process.cwd(), 'test-data-pantry');
  let store: DataStore;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('listPantry', () => {
    it('returns empty list for new pantry', async () => {
      const items = await listPantry(store);
      expect(items).toHaveLength(0);
    });

    it('returns items from pantry', async () => {
      const pantry = await store.getPantry();
      pantry.items.push({
        name: 'eggs',
        quantity: 12,
        unit: 'count',
        addedDate: '2026-01-29',
      });
      await store.savePantry(pantry);

      const items = await listPantry(store);
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('eggs');
    });
  });

  describe('formatPantryList', () => {
    it('formats empty pantry', () => {
      const output = formatPantryList([]);
      expect(output).toContain('empty');
    });

    it('formats items with quantities', () => {
      const items = [
        { name: 'eggs', quantity: 12, unit: 'count', addedDate: '2026-01-29' },
        { name: 'milk', quantity: 1, unit: 'gallon', addedDate: '2026-01-28' },
      ];
      const output = formatPantryList(items);
      expect(output).toContain('eggs');
      expect(output).toContain('12 count');
      expect(output).toContain('milk');
      expect(output).toContain('1 gallon');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: FAIL

**Step 3: Implement pantry commands**

Create `src/commands/pantry.ts`:
```typescript
import type { DataStore } from '../data';
import type { PantryItem } from '../schemas';

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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/pantry.ts src/commands/pantry.test.ts
git commit -m "feat: implement pantry list and expiring commands"
```

---

### Task 11: Implement Pantry Add Command

**Files:**
- Modify: `src/commands/pantry.ts`
- Modify: `src/commands/pantry.test.ts`

**Step 1: Write failing test**

Add to `src/commands/pantry.test.ts`:
```typescript
describe('addPantryItem', () => {
  it('adds a simple item', async () => {
    await addPantryItem(store, 'eggs', 12, 'count');

    const items = await listPantry(store);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('eggs');
    expect(items[0].quantity).toBe(12);
  });

  it('adds item with expiration', async () => {
    await addPantryItem(store, 'chicken breast', 2, 'lbs', '2026-02-01');

    const items = await listPantry(store);
    expect(items[0].expirationDate).toBe('2026-02-01');
  });

  it('updates quantity of existing item', async () => {
    await addPantryItem(store, 'eggs', 12, 'count');
    await addPantryItem(store, 'eggs', 6, 'count');

    const items = await listPantry(store);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(18);
  });
});
```

Update imports at top:
```typescript
import { listPantry, formatPantryList, addPantryItem } from './pantry';
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: FAIL - addPantryItem not found

**Step 3: Implement addPantryItem**

Add to `src/commands/pantry.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/pantry.ts src/commands/pantry.test.ts
git commit -m "feat: implement pantry add with quantity merging"
```

---

### Task 12: Implement Pantry Remove Command

**Files:**
- Modify: `src/commands/pantry.ts`
- Modify: `src/commands/pantry.test.ts`

**Step 1: Write failing test**

Add to `src/commands/pantry.test.ts`:
```typescript
describe('removePantryItem', () => {
  it('removes an existing item', async () => {
    await addPantryItem(store, 'eggs', 12, 'count');
    const removed = await removePantryItem(store, 'eggs');

    expect(removed).toBe(true);
    const items = await listPantry(store);
    expect(items).toHaveLength(0);
  });

  it('returns false for non-existent item', async () => {
    const removed = await removePantryItem(store, 'phantom item');
    expect(removed).toBe(false);
  });

  it('removes item case-insensitively', async () => {
    await addPantryItem(store, 'Eggs', 12, 'count');
    const removed = await removePantryItem(store, 'eggs');

    expect(removed).toBe(true);
  });
});
```

Update imports:
```typescript
import { listPantry, formatPantryList, addPantryItem, removePantryItem } from './pantry';
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: FAIL

**Step 3: Implement removePantryItem**

Add to `src/commands/pantry.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/commands/pantry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/pantry.ts src/commands/pantry.test.ts
git commit -m "feat: implement pantry remove command"
```

---

### Task 13: Create Commands Index and Wire Up CLI

**Files:**
- Create: `src/commands/index.ts`
- Modify: `src/cli/index.ts`

**Step 1: Create commands index**

Create `src/commands/index.ts`:
```typescript
export * from './pantry';
```

**Step 2: Wire up CLI commands with DataStore**

Update `src/cli/index.ts`:
```typescript
import { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataStore } from '../data';
import {
  listPantry,
  formatPantryList,
  addPantryItem,
  removePantryItem,
  getExpiringItems,
  formatExpiringList,
} from '../commands';

function getDataDir(): string {
  return process.env.MEAL_DATA_DIR || join(homedir(), '.meal-planner', 'data');
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('meal')
    .description('AI-powered meal planning CLI')
    .version('0.1.0');

  // Pantry management
  const pantry = program
    .command('pantry')
    .description('Manage your pantry inventory');

  pantry
    .command('list')
    .description('List all pantry items')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const items = await listPantry(store);
      console.log(formatPantryList(items));
    });

  pantry
    .command('add <name> <quantity> <unit>')
    .description('Add item to pantry')
    .option('-e, --expires <date>', 'Expiration date (YYYY-MM-DD)')
    .action(async (name: string, quantity: string, unit: string, options: { expires?: string }) => {
      const store = new DataStore(getDataDir());
      await store.init();
      await addPantryItem(store, name, parseFloat(quantity), unit, options.expires);
      console.log(`Added ${quantity} ${unit} of ${name}`);
    });

  pantry
    .command('remove <item>')
    .description('Remove an item from pantry')
    .action(async (item: string) => {
      const store = new DataStore(getDataDir());
      await store.init();
      const removed = await removePantryItem(store, item);
      if (removed) {
        console.log(`Removed ${item} from pantry`);
      } else {
        console.log(`Item "${item}" not found in pantry`);
      }
    });

  pantry
    .command('expiring')
    .description('Show items expiring within 3 days')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const items = await getExpiringItems(store);
      console.log(formatExpiringList(items));
    });

  // Meal planning (placeholders)
  const plan = program
    .command('plan')
    .description('Generate and manage meal plans');

  plan
    .command('week')
    .description('Generate next week plan')
    .action(() => {
      console.log('Weekly plan - coming in Phase 6');
    });

  plan
    .command('today')
    .description('Regenerate just today')
    .action(() => {
      console.log('Today plan - coming in Phase 6');
    });

  plan
    .command('adjust <description>')
    .description('Adjust plan with natural language')
    .action((description: string) => {
      console.log('Adjusting:', description, '- coming in Phase 6');
    });

  // Profile management (placeholders)
  const profile = program
    .command('profile')
    .description('Manage your profile and preferences');

  profile
    .command('show')
    .description('Show current profile')
    .action(() => {
      console.log('Profile show - coming in Phase 7');
    });

  profile
    .command('update')
    .description('Interactive profile update')
    .action(() => {
      console.log('Profile update - coming in Phase 7');
    });

  return program;
}
```

**Step 3: Verify CLI works**

Run: `npm run dev -- pantry list`
Expected: Shows empty pantry message

Run: `npm run dev -- pantry add eggs 12 count`
Expected: Shows "Added 12 count of eggs"

**Step 4: Commit**

```bash
git add src/commands/index.ts src/cli/index.ts
git commit -m "feat: wire up pantry commands to CLI"
```

---

## Phase 6: AI Integration - Claude API

### Task 14: Create AI Client Wrapper

**Files:**
- Create: `src/ai/client.ts`
- Test: `src/ai/client.test.ts`
- Create: `src/ai/index.ts`

**Step 1: Write failing test**

Create `src/ai/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient } from './client';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"test": "response"}' }],
      }),
    },
  })),
}));

describe('AIClient', () => {
  let client: AIClient;

  beforeEach(() => {
    client = new AIClient('test-api-key');
  });

  it('initializes with API key', () => {
    expect(client).toBeDefined();
  });

  it('sends messages to Claude', async () => {
    const response = await client.chat('Hello');
    expect(response).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/ai/client.test.ts`
Expected: FAIL

**Step 3: Implement AIClient**

Create `src/ai/client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';

export interface ChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

export class AIClient {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(userMessage: string, options: ChatOptions = {}): Promise<string> {
    const { systemPrompt, maxTokens = 4096 } = options;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textContent.text;
  }

  async chatJSON<T>(userMessage: string, options: ChatOptions = {}): Promise<T> {
    const response = await this.chat(userMessage, {
      ...options,
      systemPrompt: `${options.systemPrompt || ''}\n\nRespond with valid JSON only. No markdown code blocks.`.trim(),
    });

    // Extract JSON if wrapped in code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonStr) as T;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/ai/client.test.ts`
Expected: PASS

**Step 5: Create index**

Create `src/ai/index.ts`:
```typescript
export { AIClient } from './client';
export type { ChatOptions } from './client';
```

**Step 6: Commit**

```bash
git add src/ai/client.ts src/ai/client.test.ts src/ai/index.ts
git commit -m "feat: add AIClient wrapper for Anthropic SDK"
```

---

### Task 15: Create Meal Planning Prompts

**Files:**
- Create: `src/ai/prompts.ts`
- Test: `src/ai/prompts.test.ts`

**Step 1: Write failing test**

Create `src/ai/prompts.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildWeeklyPlanPrompt, buildPlanningSystemPrompt } from './prompts';
import { createDefaultProfile, createDefaultPantry } from '../schemas/defaults';

describe('Planning Prompts', () => {
  it('builds system prompt with guidelines', () => {
    const prompt = buildPlanningSystemPrompt();
    expect(prompt).toContain('meal planner');
    expect(prompt).toContain('JSON');
  });

  it('builds weekly plan prompt with context', () => {
    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    const prompt = buildWeeklyPlanPrompt(profile, pantry, '2026-W05');

    expect(prompt).toContain('2026-W05');
    expect(prompt).toContain('2000'); // daily calories
    expect(prompt).toContain('protein');
  });

  it('includes pantry items in prompt', () => {
    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    pantry.items.push({
      name: 'chicken breast',
      quantity: 2,
      unit: 'lbs',
      addedDate: '2026-01-27',
      expirationDate: '2026-02-01',
    });

    const prompt = buildWeeklyPlanPrompt(profile, pantry, '2026-W05');
    expect(prompt).toContain('chicken breast');
    expect(prompt).toContain('expir');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/ai/prompts.test.ts`
Expected: FAIL

**Step 3: Implement prompts**

Create `src/ai/prompts.ts`:
```typescript
import type { Profile, Pantry } from '../schemas';

export function buildPlanningSystemPrompt(): string {
  return `You are an expert meal planner AI assistant. Your role is to create personalized weekly meal plans that:

1. Meet the user's macro and calorie targets (within 10% tolerance)
2. Stay within the weekly budget
3. Use pantry items, prioritizing those expiring soon
4. Plan leftovers intentionally for efficiency
5. Respect time constraints (quick meals on weekdays)
6. Vary cuisines and avoid recent repeats
7. Accommodate dietary restrictions

CRITICAL: Always respond with valid JSON matching the requested schema. No markdown, no explanations outside the JSON.

When planning meals:
- Be realistic about portions and cooking times
- Use common, accessible ingredients
- Consider leftover potential (batch cooking)
- Account for prep time on busy weekdays vs relaxed weekends`;
}

export function buildWeeklyPlanPrompt(
  profile: Profile,
  pantry: Pantry,
  week: string
): string {
  const pantrySection = formatPantryForPrompt(pantry);
  const profileSection = formatProfileForPrompt(profile);

  return `Generate a complete 7-day meal plan for week ${week}.

## User Profile
${profileSection}

## Current Pantry
${pantrySection}

## Output Format
Return a JSON object with this exact structure:
{
  "week": "${week}",
  "generatedAt": "<ISO timestamp>",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": {
        "breakfast": { meal object or null },
        "lunch": { meal object or null },
        "dinner": { meal object or null }
      }
    }
  ],
  "totals": {
    "calories": <number>,
    "macros": { "protein": <g>, "carbs": <g>, "fat": <g> },
    "estimatedCost": <number>
  },
  "shoppingList": [
    { "name": "<ingredient>", "amount": <number>, "unit": "<unit>", "estimatedCost": <number> }
  ]
}

Each meal object:
{
  "name": "<meal name>",
  "recipe": "<brief instructions>",
  "ingredients": [{ "name": "<name>", "amount": <number>, "unit": "<unit>" }],
  "prepTime": <minutes>,
  "calories": <number>,
  "macros": { "protein": <g>, "carbs": <g>, "fat": <g> },
  "estimatedCost": <number>,
  "servings": <number>,
  "leftoverOf": "<original meal name>" or null
}`;
}

function formatPantryForPrompt(pantry: Pantry): string {
  if (pantry.items.length === 0) {
    return 'Pantry is empty - all ingredients need to be purchased.';
  }

  const lines = pantry.items.map((item) => {
    let line = `- ${item.name}: ${item.quantity} ${item.unit}`;
    if (item.expirationDate) {
      line += ` (expires: ${item.expirationDate} - USE SOON)`;
    }
    return line;
  });

  return lines.join('\n');
}

function formatProfileForPrompt(profile: Profile): string {
  const { goals, dietary, preferences, constraints, household } = profile;

  return `Household: ${household.size} people
Daily calories target: ${goals.dailyCalories}
Macro targets (daily): protein ${goals.macros.protein}g, carbs ${goals.macros.carbs}g, fat ${goals.macros.fat}g
Weekly budget: $${goals.weeklyBudget}

Dietary restrictions: ${dietary.restrictions.length ? dietary.restrictions.join(', ') : 'none'}
Dislikes: ${dietary.dislikes.length ? dietary.dislikes.join(', ') : 'none'}

Preferred cuisines: ${preferences.cuisines.length ? preferences.cuisines.join(', ') : 'any'}
Max prep time: ${preferences.maxPrepTime.weekday}min weekday, ${preferences.maxPrepTime.weekend}min weekend
Complexity tolerance: ${preferences.complexityTolerance}
Skill level: ${constraints.skillLevel}
Kitchen equipment: ${constraints.kitchenware.join(', ')}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/ai/prompts.test.ts`
Expected: PASS

**Step 5: Update index**

Update `src/ai/index.ts`:
```typescript
export { AIClient } from './client';
export type { ChatOptions } from './client';
export { buildPlanningSystemPrompt, buildWeeklyPlanPrompt } from './prompts';
```

**Step 6: Commit**

```bash
git add src/ai/prompts.ts src/ai/prompts.test.ts src/ai/index.ts
git commit -m "feat: add meal planning prompts for Claude"
```

---

### Task 16: Implement Plan Generation Service

**Files:**
- Create: `src/services/planner.ts`
- Test: `src/services/planner.test.ts`
- Create: `src/services/index.ts`

**Step 1: Write failing test**

Create `src/services/planner.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MealPlanner } from './planner';
import { WeeklyPlanSchema } from '../schemas';
import { createDefaultProfile, createDefaultPantry } from '../schemas/defaults';

// Mock AI client
const mockChatJSON = vi.fn();
vi.mock('../ai', () => ({
  AIClient: vi.fn().mockImplementation(() => ({
    chatJSON: mockChatJSON,
  })),
  buildPlanningSystemPrompt: vi.fn().mockReturnValue('system prompt'),
  buildWeeklyPlanPrompt: vi.fn().mockReturnValue('user prompt'),
}));

describe('MealPlanner', () => {
  let planner: MealPlanner;

  beforeEach(() => {
    mockChatJSON.mockReset();
    planner = new MealPlanner('test-api-key');
  });

  it('generates a valid weekly plan', async () => {
    const mockPlan = {
      week: '2026-W05',
      generatedAt: '2026-01-29T10:00:00Z',
      days: [
        {
          date: '2026-01-27',
          meals: {
            breakfast: {
              name: 'Oatmeal',
              recipe: 'Cook oats',
              ingredients: [{ name: 'oats', amount: 0.5, unit: 'cup' }],
              prepTime: 10,
              calories: 300,
              macros: { protein: 10, carbs: 50, fat: 5 },
              estimatedCost: 0.5,
              servings: 1,
              leftoverOf: null,
            },
            lunch: null,
            dinner: null,
          },
        },
      ],
      totals: {
        calories: 14000,
        macros: { protein: 1050, carbs: 1400, fat: 455 },
        estimatedCost: 95,
      },
    };

    mockChatJSON.mockResolvedValue(mockPlan);

    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();
    const plan = await planner.generateWeeklyPlan(profile, pantry, '2026-W05');

    expect(WeeklyPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.week).toBe('2026-W05');
  });

  it('validates AI response against schema', async () => {
    mockChatJSON.mockResolvedValue({ invalid: 'response' });

    const profile = createDefaultProfile();
    const pantry = createDefaultPantry();

    await expect(planner.generateWeeklyPlan(profile, pantry, '2026-W05')).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/services/planner.test.ts`
Expected: FAIL

**Step 3: Implement MealPlanner service**

Create `src/services/planner.ts`:
```typescript
import { AIClient, buildPlanningSystemPrompt, buildWeeklyPlanPrompt } from '../ai';
import { WeeklyPlanSchema, type WeeklyPlan, type Profile, type Pantry } from '../schemas';

export class MealPlanner {
  private client: AIClient;

  constructor(apiKey: string) {
    this.client = new AIClient(apiKey);
  }

  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string
  ): Promise<WeeklyPlan> {
    const systemPrompt = buildPlanningSystemPrompt();
    const userPrompt = buildWeeklyPlanPrompt(profile, pantry, week);

    const response = await this.client.chatJSON<unknown>(userPrompt, {
      systemPrompt,
      maxTokens: 8192,
    });

    // Validate response against schema
    const result = WeeklyPlanSchema.safeParse(response);
    if (!result.success) {
      throw new Error(`Invalid plan from AI: ${result.error.message}`);
    }

    return result.data;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/services/planner.test.ts`
Expected: PASS

**Step 5: Create services index**

Create `src/services/index.ts`:
```typescript
export { MealPlanner } from './planner';
```

**Step 6: Commit**

```bash
git add src/services/planner.ts src/services/planner.test.ts src/services/index.ts
git commit -m "feat: implement MealPlanner service with schema validation"
```

---

### Task 17: Wire Up Plan Commands to CLI

**Files:**
- Create: `src/commands/plan.ts`
- Modify: `src/commands/index.ts`
- Modify: `src/cli/index.ts`

**Step 1: Implement plan commands**

Create `src/commands/plan.ts`:
```typescript
import { MealPlanner } from '../services';
import type { DataStore } from '../data';
import type { WeeklyPlan, Meal } from '../schemas';

export async function generateWeeklyPlan(
  store: DataStore,
  apiKey: string,
  week: string
): Promise<WeeklyPlan> {
  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  const planner = new MealPlanner(apiKey);
  const plan = await planner.generateWeeklyPlan(profile, pantry, week);

  await store.saveWeeklyPlan(plan);
  return plan;
}

export function formatWeeklyPlan(plan: WeeklyPlan): string {
  const lines: string[] = [
    `Meal Plan for ${plan.week}`,
    `Generated: ${plan.generatedAt}`,
    '',
  ];

  for (const day of plan.days) {
    lines.push(`## ${day.date}`);
    lines.push('');

    for (const [mealType, meal] of Object.entries(day.meals)) {
      if (meal) {
        lines.push(formatMeal(mealType, meal));
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('## Weekly Totals');
  lines.push(`Calories: ${plan.totals.calories}`);
  lines.push(`Protein: ${plan.totals.macros.protein}g`);
  lines.push(`Carbs: ${plan.totals.macros.carbs}g`);
  lines.push(`Fat: ${plan.totals.macros.fat}g`);
  lines.push(`Estimated Cost: $${plan.totals.estimatedCost.toFixed(2)}`);

  return lines.join('\n');
}

function formatMeal(type: string, meal: Meal): string {
  const lines = [
    `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${meal.name}`,
    `  Calories: ${meal.calories} | P: ${meal.macros.protein}g C: ${meal.macros.carbs}g F: ${meal.macros.fat}g`,
    `  Prep: ${meal.prepTime}min | Cost: $${meal.estimatedCost.toFixed(2)}`,
  ];

  if (meal.leftoverOf) {
    lines.push(`  (Leftover from: ${meal.leftoverOf})`);
  }

  return lines.join('\n');
}

export function getCurrentWeek(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const weekNum = Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
```

**Step 2: Update commands index**

Update `src/commands/index.ts`:
```typescript
export * from './pantry';
export * from './plan';
```

**Step 3: Update CLI**

Update the plan commands in `src/cli/index.ts`:
```typescript
import {
  generateWeeklyPlan,
  formatWeeklyPlan,
  getCurrentWeek,
} from '../commands';

// ... in createProgram(), replace plan command placeholders:

  plan
    .command('week')
    .description('Generate next week plan')
    .action(async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('Error: ANTHROPIC_API_KEY environment variable is required');
        process.exit(1);
      }

      const store = new DataStore(getDataDir());
      await store.init();

      const week = getCurrentWeek();
      console.log(`Generating meal plan for ${week}...`);

      try {
        const plan = await generateWeeklyPlan(store, apiKey, week);
        console.log(formatWeeklyPlan(plan));
      } catch (error) {
        console.error('Failed to generate plan:', error);
        process.exit(1);
      }
    });
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: No errors

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/commands/index.ts src/cli/index.ts
git commit -m "feat: wire up plan week command with Claude integration"
```

---

## Phase 7: Profile Management

### Task 18: Implement Profile Show Command

**Files:**
- Create: `src/commands/profile.ts`
- Test: `src/commands/profile.test.ts`

**Step 1: Write failing test**

Create `src/commands/profile.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../data';
import { formatProfile } from './profile';
import { createDefaultProfile } from '../schemas/defaults';

describe('Profile Commands', () => {
  const testDir = join(process.cwd(), 'test-data-profile');
  let store: DataStore;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('formatProfile', () => {
    it('formats profile for display', () => {
      const profile = createDefaultProfile();
      profile.goals.dailyCalories = 2500;
      profile.dietary.restrictions = ['gluten-free'];

      const output = formatProfile(profile);

      expect(output).toContain('2500');
      expect(output).toContain('gluten-free');
      expect(output).toContain('Household');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/commands/profile.test.ts`
Expected: FAIL

**Step 3: Implement profile commands**

Create `src/commands/profile.ts`:
```typescript
import type { Profile } from '../schemas';

export function formatProfile(profile: Profile): string {
  const lines: string[] = [
    '# Your Meal Planning Profile',
    '',
    '## Household',
    `Size: ${profile.household.size}`,
    `Members:`,
  ];

  for (const member of profile.household.members) {
    const restrictions = member.dietaryRestrictions.length
      ? ` (${member.dietaryRestrictions.join(', ')})`
      : '';
    lines.push(`  - ${member.name}${restrictions}`);
  }

  lines.push('');
  lines.push('## Goals');
  lines.push(`Daily Calories: ${profile.goals.dailyCalories}`);
  lines.push(`Macros: P ${profile.goals.macros.protein}g / C ${profile.goals.macros.carbs}g / F ${profile.goals.macros.fat}g`);
  lines.push(`Weekly Budget: $${profile.goals.weeklyBudget}`);

  lines.push('');
  lines.push('## Dietary');
  lines.push(`Restrictions: ${profile.dietary.restrictions.length ? profile.dietary.restrictions.join(', ') : 'none'}`);
  lines.push(`Dislikes: ${profile.dietary.dislikes.length ? profile.dietary.dislikes.join(', ') : 'none'}`);

  lines.push('');
  lines.push('## Preferences');
  lines.push(`Cuisines: ${profile.preferences.cuisines.length ? profile.preferences.cuisines.join(', ') : 'any'}`);
  lines.push(`Max Prep Time: ${profile.preferences.maxPrepTime.weekday}min weekday / ${profile.preferences.maxPrepTime.weekend}min weekend`);
  lines.push(`Complexity: ${profile.preferences.complexityTolerance}`);

  lines.push('');
  lines.push('## Constraints');
  lines.push(`Skill Level: ${profile.constraints.skillLevel}`);
  lines.push(`Kitchen Equipment: ${profile.constraints.kitchenware.join(', ')}`);

  if (profile.learned.lovedMeals.length || profile.learned.dislikedMeals.length) {
    lines.push('');
    lines.push('## Learned Preferences');
    if (profile.learned.lovedMeals.length) {
      lines.push(`Loved: ${profile.learned.lovedMeals.join(', ')}`);
    }
    if (profile.learned.dislikedMeals.length) {
      lines.push(`Disliked: ${profile.learned.dislikedMeals.join(', ')}`);
    }
  }

  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/commands/profile.test.ts`
Expected: PASS

**Step 5: Update commands index and CLI**

Update `src/commands/index.ts`:
```typescript
export * from './pantry';
export * from './plan';
export * from './profile';
```

Update profile commands in `src/cli/index.ts`:
```typescript
import { formatProfile } from '../commands';

// ... in createProgram():
  profile
    .command('show')
    .description('Show current profile')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();
      const userProfile = await store.getProfile();
      console.log(formatProfile(userProfile));
    });
```

**Step 6: Commit**

```bash
git add src/commands/profile.ts src/commands/profile.test.ts src/commands/index.ts src/cli/index.ts
git commit -m "feat: implement profile show command"
```

---

## Phase 8: Shopping List

### Task 19: Implement Shopping List Generation

**Files:**
- Create: `src/commands/shop.ts`
- Test: `src/commands/shop.test.ts`

**Step 1: Write failing test**

Create `src/commands/shop.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateShoppingList, formatShoppingList } from './shop';
import type { WeeklyPlan, Pantry } from '../schemas';

describe('Shopping Commands', () => {
  const mockPlan: WeeklyPlan = {
    week: '2026-W05',
    generatedAt: '2026-01-29T10:00:00Z',
    days: [
      {
        date: '2026-01-27',
        meals: {
          breakfast: {
            name: 'Oatmeal',
            recipe: 'Cook oats',
            ingredients: [
              { name: 'oats', amount: 0.5, unit: 'cup' },
              { name: 'milk', amount: 1, unit: 'cup' },
            ],
            prepTime: 10,
            calories: 300,
            macros: { protein: 10, carbs: 50, fat: 5 },
            estimatedCost: 1,
            servings: 1,
            leftoverOf: null,
          },
          lunch: null,
          dinner: {
            name: 'Chicken Stir Fry',
            recipe: 'Stir fry chicken with veggies',
            ingredients: [
              { name: 'chicken breast', amount: 1, unit: 'lb' },
              { name: 'broccoli', amount: 2, unit: 'cups' },
            ],
            prepTime: 25,
            calories: 450,
            macros: { protein: 40, carbs: 20, fat: 15 },
            estimatedCost: 8,
            servings: 2,
            leftoverOf: null,
          },
        },
      },
    ],
    totals: {
      calories: 14000,
      macros: { protein: 1050, carbs: 1400, fat: 455 },
      estimatedCost: 95,
    },
  };

  describe('generateShoppingList', () => {
    it('aggregates ingredients from all meals', () => {
      const pantry: Pantry = { items: [] };
      const list = generateShoppingList(mockPlan, pantry);

      expect(list).toHaveLength(4);
      expect(list.find((i) => i.name === 'oats')).toBeDefined();
      expect(list.find((i) => i.name === 'chicken breast')).toBeDefined();
    });

    it('subtracts pantry items', () => {
      const pantry: Pantry = {
        items: [
          { name: 'chicken breast', quantity: 0.5, unit: 'lb', addedDate: '2026-01-27' },
        ],
      };
      const list = generateShoppingList(mockPlan, pantry);

      const chicken = list.find((i) => i.name === 'chicken breast');
      expect(chicken?.amount).toBe(0.5); // 1 - 0.5 = 0.5
    });

    it('excludes items fully covered by pantry', () => {
      const pantry: Pantry = {
        items: [
          { name: 'chicken breast', quantity: 2, unit: 'lb', addedDate: '2026-01-27' },
        ],
      };
      const list = generateShoppingList(mockPlan, pantry);

      const chicken = list.find((i) => i.name === 'chicken breast');
      expect(chicken).toBeUndefined();
    });
  });

  describe('formatShoppingList', () => {
    it('formats list for display', () => {
      const list = [
        { name: 'oats', amount: 0.5, unit: 'cup' },
        { name: 'milk', amount: 1, unit: 'cup' },
      ];
      const output = formatShoppingList(list);

      expect(output).toContain('oats');
      expect(output).toContain('milk');
      expect(output).toContain('Shopping List');
    });

    it('shows message for empty list', () => {
      const output = formatShoppingList([]);
      expect(output).toContain('pantry');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/commands/shop.test.ts`
Expected: FAIL

**Step 3: Implement shopping commands**

Create `src/commands/shop.ts`:
```typescript
import type { WeeklyPlan, Pantry } from '../schemas';

export interface ShoppingItem {
  name: string;
  amount: number;
  unit: string;
}

export function generateShoppingList(plan: WeeklyPlan, pantry: Pantry): ShoppingItem[] {
  // Aggregate all ingredients from meals
  const ingredients = new Map<string, ShoppingItem>();

  for (const day of plan.days) {
    for (const meal of Object.values(day.meals)) {
      if (!meal) continue;

      for (const ing of meal.ingredients) {
        const key = `${ing.name.toLowerCase()}|${ing.unit}`;
        const existing = ingredients.get(key);

        if (existing) {
          existing.amount += ing.amount;
        } else {
          ingredients.set(key, {
            name: ing.name.toLowerCase(),
            amount: ing.amount,
            unit: ing.unit,
          });
        }
      }
    }
  }

  // Subtract pantry items
  for (const pantryItem of pantry.items) {
    const key = `${pantryItem.name.toLowerCase()}|${pantryItem.unit}`;
    const needed = ingredients.get(key);

    if (needed) {
      needed.amount -= pantryItem.quantity;
      if (needed.amount <= 0) {
        ingredients.delete(key);
      }
    }
  }

  return Array.from(ingredients.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatShoppingList(items: ShoppingItem[]): string {
  if (items.length === 0) {
    return 'Your pantry has everything you need!';
  }

  const lines: string[] = ['# Shopping List', ''];

  for (const item of items) {
    lines.push(`- [ ] ${item.name}: ${item.amount} ${item.unit}`);
  }

  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/commands/shop.test.ts`
Expected: PASS

**Step 5: Update commands index and CLI**

Update `src/commands/index.ts`:
```typescript
export * from './pantry';
export * from './plan';
export * from './profile';
export * from './shop';
```

Add to `src/cli/index.ts`:
```typescript
import { generateShoppingList, formatShoppingList } from '../commands';

// Add shop command in createProgram():
  const shop = program
    .command('shop')
    .description('Shopping list management');

  shop
    .command('list')
    .description('Generate shopping list for current plan')
    .action(async () => {
      const store = new DataStore(getDataDir());
      await store.init();

      const week = getCurrentWeek();
      const plan = await store.getWeeklyPlan(week);

      if (!plan) {
        console.log(`No plan found for ${week}. Run 'meal plan week' first.`);
        return;
      }

      const pantry = await store.getPantry();
      const list = generateShoppingList(plan, pantry);
      console.log(formatShoppingList(list));
    });
```

**Step 6: Commit**

```bash
git add src/commands/shop.ts src/commands/shop.test.ts src/commands/index.ts src/cli/index.ts
git commit -m "feat: implement shopping list generation"
```

---

## Phase 9: Final Integration

### Task 20: Add Environment Config and README

**Files:**
- Create: `.env.example`
- Update: `package.json` with final scripts

**Step 1: Create env example**

Create `.env.example`:
```
# Required: Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Custom data directory (defaults to ~/.meal-planner/data)
# MEAL_DATA_DIR=/path/to/data
```

**Step 2: Update package.json**

Ensure scripts are correct:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit"
  }
}
```

**Step 3: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Verify build**

Run: `npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add .env.example package.json
git commit -m "chore: add environment config and finalize package scripts"
```

---

### Task 21: Integration Test - Full Workflow

**Files:**
- Create: `src/integration.test.ts`

**Step 1: Write integration test**

Create `src/integration.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from './data';
import { addPantryItem, listPantry, generateShoppingList } from './commands';

describe('Integration: Full Workflow', () => {
  const testDir = join(process.cwd(), 'test-data-integration');
  let store: DataStore;

  beforeEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    store = new DataStore(testDir);
    await store.init();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('manages pantry items through full lifecycle', async () => {
    // Add items
    await addPantryItem(store, 'eggs', 12, 'count');
    await addPantryItem(store, 'milk', 1, 'gallon', '2026-02-05');

    // List and verify
    const items = await listPantry(store);
    expect(items).toHaveLength(2);

    // Reload store and verify persistence
    const newStore = new DataStore(testDir);
    await newStore.init();
    const reloadedItems = await listPantry(newStore);
    expect(reloadedItems).toHaveLength(2);
  });

  it('creates valid default profile on init', async () => {
    const profile = await store.getProfile();

    expect(profile.household.size).toBeGreaterThan(0);
    expect(profile.goals.dailyCalories).toBeGreaterThan(0);
    expect(profile.goals.weeklyBudget).toBeGreaterThan(0);
  });
});
```

**Step 2: Run integration test**

Run: `npm test -- --run src/integration.test.ts`
Expected: PASS

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/integration.test.ts
git commit -m "test: add integration test for full workflow"
```

---

## Summary

This implementation plan covers:

1. **Phase 1**: Project foundation (TypeScript, Vitest, Commander.js)
2. **Phase 2**: Zod schemas for all data types (profile, pantry, plan, knowledge)
3. **Phase 3**: DataStore for local JSON persistence
4. **Phase 4**: CLI framework with command structure
5. **Phase 5**: Pantry commands (list, add, remove, expiring)
6. **Phase 6**: AI integration (Claude API client, prompts, MealPlanner service)
7. **Phase 7**: Profile management (show command)
8. **Phase 8**: Shopping list generation
9. **Phase 9**: Final integration and testing

Each task follows TDD: failing test → minimal implementation → passing test → commit.

Total: 21 tasks across 9 phases.
