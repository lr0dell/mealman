/**
 * Extracts the validation metrics defined in
 * docs/superpowers/specs/2026-08-02-id-based-ingredient-binding-design.md
 * from a completed `plan week` run.
 *
 * Usage: npx tsx scripts/analyze-plan-run.ts <MEAL_DATA_DIR> [label]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface PantryFile {
  items: Array<{ ingredientId: number; name: string }>;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  const inter = [...ta].filter((w) => tb.has(w)).length;
  return inter / new Set([...ta, ...tb]).size;
}

function main(): void {
  const dataDir = process.argv[2];
  const label = process.argv[3] ?? dataDir;
  if (!dataDir) {
    console.error('usage: analyze-plan-run.ts <MEAL_DATA_DIR> [label]');
    process.exit(1);
  }

  const debugDir = join(dataDir, 'debug');
  const logs = existsSync(debugDir)
    ? readdirSync(debugDir)
        .filter((f) => f.endsWith('.log'))
        .sort()
    : [];

  const toolCounts = new Map<string, number>();
  let iterations = 0;

  for (const f of logs) {
    const log = readFileSync(join(debugDir, f), 'utf8');
    iterations += (log.match(/^ITERATION \d+$/gm) ?? []).length;
    for (const m of log.matchAll(/Tool call: (\w+)/g)) {
      toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1);
    }
  }

  const planDir = join(dataDir, 'plans');
  const planFiles = existsSync(planDir)
    ? readdirSync(planDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];

  let mismatches = 0;
  let distinctIngredients = 0;
  let totals = { calories: 0, cost: 0 };

  if (planFiles.length > 0) {
    const plan = JSON.parse(
      readFileSync(join(planDir, planFiles[planFiles.length - 1]), 'utf8')
    ) as {
      days: Array<{
        meals: Record<
          string,
          { ingredients: Array<{ ingredientId: number; name: string }> } | null
        >;
      }>;
      totals: { calories: number; estimatedCost: number };
    };
    const pantry = JSON.parse(
      readFileSync(join(dataDir, 'pantry.json'), 'utf8')
    ) as PantryFile;

    totals = {
      calories: Math.round(plan.totals.calories),
      cost: plan.totals.estimatedCost,
    };

    const used = new Map<number, string>();
    for (const day of plan.days) {
      for (const meal of Object.values(day.meals)) {
        if (!meal) continue;
        for (const ing of meal.ingredients) {
          used.set(ing.ingredientId, ing.name);
        }
      }
    }
    distinctIngredients = used.size;

    // A mismatch is a planned ingredient that is not a pantry id but is a
    // close name-neighbour of one, i.e. the bug this change removes.
    for (const [id, name] of used) {
      if (pantry.items.some((p) => p.ingredientId === id)) continue;
      const near = pantry.items.some(
        (p) => p.ingredientId !== id && jaccard(name, p.name) >= 0.5
      );
      if (near) mismatches++;
    }
  }

  const line = (k: string, v: string | number) =>
    console.log(`  ${k.padEnd(26)} ${v}`);

  console.log(`\n=== ${label} ===`);
  line('planning sessions', logs.length);
  line('iterations', iterations);
  for (const [tool, n] of [...toolCounts].sort((a, b) => b[1] - a[1])) {
    line(`  ${tool}`, n);
  }
  line('distinct ingredients', distinctIngredients);
  line('PANTRY MISMATCHES', mismatches);
  line('weekly calories', totals.calories);
  line('weekly cost', `$${totals.cost.toFixed(2)}`);
}

main();
