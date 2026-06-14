import { AIClient } from '../ai/client.js';
import { IngredientDatabase } from './ingredient-database.js';
import { PlanState } from './plan-state.js';
import { createToolHandlers } from '../agent/tool-handlers.js';
import { DAY_PLANNING_TOOLS } from '../agent/tools.js';
import { PlanningProgressTracker } from './planning-progress-tracker.js';
import { join } from 'node:path';
import type { Profile, Pantry, PantryItem } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';
import { getWeekDates } from '../utils/week.js';
import type { PaceContext } from './plan-state.js';
import type { IngredientRequirement } from './pantry-math.js';

export interface AgentPlannerOptions {
  anthropicApiKey: string;
  dataDir: string;
  aiClient?: AIClient;
  ingredientDb?: IngredientDatabase;
}

export class AgentPlanner {
  private aiClient: AIClient;
  private ingredientDb: IngredientDatabase;
  private initialized = false;

  constructor(options: AgentPlannerOptions) {
    this.aiClient = options.aiClient ?? new AIClient(options.anthropicApiKey);
    this.ingredientDb =
      options.ingredientDb ??
      new IngredientDatabase(join(options.dataDir, 'ingredients.db'));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.ingredientDb.init();
      this.initialized = true;
    }
  }

  buildDaySystemPrompt(profile: Profile): string {
    const { goals, dietary, preferences, household } = profile;

    return `You are a meal planning agent. Plan ONE day of meals (breakfast, lunch, dinner) by adding meals one at a time using the available tools.

## Daily Targets (must be met for this day)
- Household size: ${household.size} people
- Protein: ${goals.macros.protein.min}-${goals.macros.protein.max}g
- Carbs: ${goals.macros.carbs.min}-${goals.macros.carbs.max}g
- Fat: ${goals.macros.fat.min}-${goals.macros.fat.max}g
- Fiber: ${goals.macros.fiber.min}-${goals.macros.fiber.max}g

## Calories & Cost (weekly goals — stay on pace)
The planning message gives this day's calorie and cost pace targets. Aim within ~150 kcal of the calorie pace target. Keep the day's cost at or under the cost pace target.

## Dietary
- Restrictions: ${dietary.restrictions.length ? dietary.restrictions.join(', ') : 'none'}
- Dislikes: ${dietary.dislikes.length ? dietary.dislikes.join(', ') : 'none'}

## Preferences
- Cuisines: ${preferences.cuisines.length ? preferences.cuisines.join(', ') : 'any'}
- Complexity: ${preferences.complexityTolerance}

## Variety
Plan meals the way a person actually eats across a week. Some repetition is natural — a recurring breakfast staple or a favorite ingredient is fine — but avoid the exact same dish two days running, and let dishes vary in preparation and cuisine even when they share a core ingredient (e.g. chicken cooked differently, not the same plate nightly). Don't force seven unique meals.

## Process
1. Use lookup_ingredient before adding any meal's ingredients.
2. Add the day's three meals with add_meal (only for the date in the planning message).
3. Use check_daily_totals to confirm protein/carbs/fat/fiber are in range and calories are near the pace target.
4. When all three slots are filled, macros and fiber are in range, and calories are near pace: call finalize_plan immediately.

Be efficient with tokens. Don't explain your reasoning, just call tools.

## Ingredient Naming
Use recipe-accurate ingredient names for reliable nutrition matching:
- "chicken breast" or "chicken thigh" not "chicken"
- "black beans" or "kidney beans" not "beans"
- "salmon" or "cod" not "fish"
- "brown rice" or "jasmine rice" not "rice"
- "olive oil" not "oil"

If lookup_ingredient returns found: false, use one of the suggested names.

## Pantry & Shopping Efficiency
- The planning message lists the pantry still available this week and the shopping list built up so far. Prefer available pantry items when they fit a dish naturally.
- Reusing an ingredient already on the shopping list avoids growing it. Variety and reuse both matter — balance them; don't collapse the week onto one ingredient set just to keep the list short, and don't avoid buying a needed staple just because the pantry is large.`;
  }

  private formatAvailablePantry(items: PantryItem[]): string {
    if (items.length === 0) return 'Empty';
    return items
      .map((i) => `- ${i.name} (id ${i.ingredientId}): ${i.quantity} ${i.unit}`)
      .join('\n');
  }

  private formatShoppingList(
    items: IngredientRequirement[],
    limit: number
  ): string {
    if (items.length === 0) {
      return 'Nothing yet — the pantry covers everything planned so far.';
    }
    const lines = items.map(
      (i) => `- ${i.name} (id ${i.ingredientId}): ${i.amount} g`
    );
    lines.push(`${items.length} items (aim to stay under ${limit}).`);
    return lines.join('\n');
  }

  buildDayInitialMessage(
    availablePantry: PantryItem[],
    shoppingList: IngredientRequirement[],
    shoppingLimit: number,
    date: string,
    pace: PaceContext,
    mealsSoFar: string
  ): string {
    const priorSection = mealsSoFar
      ? `Already on the menu earlier this week (plan today like a person would — lean toward something different when it's easy, but reusing a staple or ingredient is fine; don't force novelty, and don't just repeat these):\n${mealsSoFar}`
      : 'This is the first day of the week — no meals planned yet.';

    return `Plan all meals for ${date}.

Today's pace targets (to stay on track for the weekly goals):
- Calories: ~${pace.paceCalories} kcal
- Cost: ~$${pace.paceCost.toFixed(2)}

${priorSection}

Available pantry (quantities remaining after meals already planned this week):
${this.formatAvailablePantry(availablePantry)}

Shopping list so far (ingredients planned this week the pantry does not cover):
${this.formatShoppingList(shoppingList, shoppingLimit)}

Add today's breakfast, lunch, and dinner with add_meal (date ${date}). Use lookup_ingredient for any ingredient before using it. Call finalize_plan when the day is complete.`;
  }

  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string,
    dataDir: string
  ): Promise<WeeklyPlan> {
    await this.ensureInitialized();

    const planState = new PlanState(week, profile, pantry);
    const dates = getWeekDates(week);
    const debugDir = join(dataDir, 'debug');

    for (const date of dates) {
      const pace = planState.getPaceContext(date);
      const mealsSoFar = planState.getMealsSummaryBefore(date);
      const handlers = createToolHandlers(planState, this.ingredientDb, {
        lockedDate: date,
      });
      const systemPrompt = this.buildDaySystemPrompt(profile);
      const initialMessage = this.buildDayInitialMessage(
        planState.getAvailablePantry(),
        planState.getShoppingList(),
        planState.getShoppingListLimit(),
        date,
        pace,
        mealsSoFar
      );

      const tracker = new PlanningProgressTracker(
        week,
        dataDir,
        debugDir,
        'claude-haiku-4-5-20251001',
        systemPrompt,
        initialMessage
      );

      try {
        const result = await this.aiClient.runAgentLoop({
          systemPrompt,
          initialMessage,
          tools: DAY_PLANNING_TOOLS,
          toolHandler: handlers.handle,
          maxIterations: 100,
          contextWindow: 15,
          onProgress: tracker.handleEvent.bind(tracker),
        });
        console.log(
          `${date}: ${result.toolCalls} tool calls, ${result.iterations} iterations`
        );
        tracker.close();
      } catch (error) {
        tracker.logError(error as Error);
        throw error;
      }
    }

    const plan = planState.toWeeklyPlan();
    this.reportWeeklyTotals(plan, profile);
    return plan;
  }

  private reportWeeklyTotals(plan: WeeklyPlan, profile: Profile): void {
    const target = profile.goals.dailyCalories * 7;
    const cal = Math.round(plan.totals.calories);
    const calOk = cal >= target - 500 && cal <= target + 500;
    const cost = plan.totals.estimatedCost;
    const costOk = cost <= profile.goals.weeklyBudget;

    console.log(
      `\nWeekly calories: ${cal} (target ${target} ±500) ${calOk ? 'OK' : 'OUT OF BAND'}`
    );
    console.log(
      `Weekly cost: $${cost.toFixed(2)} (budget $${profile.goals.weeklyBudget}) ${costOk ? 'OK' : 'OVER'}`
    );
  }
}
