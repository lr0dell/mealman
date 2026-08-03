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

  interface Mismatch {
    id: number;
    name: string;
    pantryId: number;
    pantryName: string;
    score: number;
  }

  let planFileUsed: string | null = null;
  let mismatches: Mismatch[] = [];
  let pantryMissing = false;
  let distinctIngredients = 0;
  let totals = { calories: 0, cost: 0 };

  if (planFiles.length > 0) {
    planFileUsed = planFiles[planFiles.length - 1];
    const plan = JSON.parse(readFileSync(join(planDir, planFileUsed), 'utf8')) as {
      days: Array<{
        meals: Record<
          string,
          { ingredients: Array<{ ingredientId: number; name: string }> } | null
        >;
      }>;
      totals: { calories: number; estimatedCost: number };
    };

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

    const pantryPath = join(dataDir, 'pantry.json');
    if (existsSync(pantryPath)) {
      const pantry = JSON.parse(readFileSync(pantryPath, 'utf8')) as PantryFile;

      // A mismatch is a planned ingredient that is not a pantry id but is a
      // close name-neighbour of one, i.e. the bug this change removes. When
      // an id has multiple near-neighbours, report the closest one.
      for (const [id, name] of used) {
        if (pantry.items.some((p) => p.ingredientId === id)) continue;
        let best: { p: PantryFile['items'][number]; score: number } | null = null;
        for (const p of pantry.items) {
          if (p.ingredientId === id) continue;
          const score = jaccard(name, p.name);
          if (score >= 0.5 && (!best || score > best.score)) {
            best = { p, score };
          }
        }
        if (best) {
          mismatches.push({
            id,
            name,
            pantryId: best.p.ingredientId,
            pantryName: best.p.name,
            score: best.score,
          });
        }
      }
    } else {
      pantryMissing = true;
    }
  }

  const line = (k: string, v: string | number) =>
    console.log(`  ${k.padEnd(26)} ${v}`);

  console.log(`\n=== ${label} ===`);
  console.log(
    '  (tool/iteration counts below cover every log in debug/; distinct'
  );
  console.log(
    '   ingredients, mismatches, and totals cover only "plan analyzed")'
  );
  line('planning sessions (debug/)', logs.length);
  line('iterations (debug/)', iterations);
  for (const [tool, n] of [...toolCounts].sort((a, b) => b[1] - a[1])) {
    line(`  ${tool}`, n);
  }
  line('plan analyzed', planFileUsed ?? '(no plan files found)');
  line('distinct ingredients', distinctIngredients);
  if (pantryMissing) {
    line('PANTRY MISMATCHES', 'not measured (pantry.json missing)');
  } else {
    line('PANTRY MISMATCHES', mismatches.length);
    for (const m of mismatches) {
      console.log(
        `    id=${m.id} "${m.name}"  ~  pantry id=${m.pantryId} "${m.pantryName}"  (jaccard ${m.score.toFixed(2)})`
      );
    }
  }
  line('weekly calories', totals.calories);
  line('weekly cost', `$${totals.cost.toFixed(2)}`);
}

main();
