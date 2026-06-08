import { AIClient } from '../ai/client.js';
import { IngredientDatabase } from './ingredient-database.js';
import { PlanState } from './plan-state.js';
import { createToolHandlers } from '../agent/tool-handlers.js';
import { PLANNING_TOOLS } from '../agent/tools.js';
import { PlanningProgressTracker } from './planning-progress-tracker.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Profile, Pantry } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';
import { parseWeekKey } from '../utils/week.js';

export interface AgentPlannerOptions {
  anthropicApiKey: string;
  dataDir: string;
}

export class AgentPlanner {
  private aiClient: AIClient;
  private ingredientDb: IngredientDatabase;
  private initialized = false;

  constructor(options: AgentPlannerOptions) {
    this.aiClient = new AIClient(options.anthropicApiKey);
    this.ingredientDb = new IngredientDatabase(
      join(options.dataDir, 'ingredients.db')
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.ingredientDb.init();
      this.initialized = true;
    }
  }
  buildSystemPrompt(profile: Profile): string {
    const { goals, dietary, preferences, household } = profile;

    return `You are a meal planning agent. Your task is to create a complete 7-day meal plan by adding meals one at a time using the available tools.

## Targets
- Household size: ${household.size} people
- Daily calories: ${goals.dailyCalories} per person
- Weekly budget: $${goals.weeklyBudget}
- Protein: ${goals.macros.protein.min}-${goals.macros.protein.max}g/day
- Carbs: ${goals.macros.carbs.min}-${goals.macros.carbs.max}g/day
- Fat: ${goals.macros.fat.min}-${goals.macros.fat.max}g/day
- Fiber: ${goals.macros.fiber.min}-${goals.macros.fiber.max}g/day

## Dietary
- Restrictions: ${dietary.restrictions.length ? dietary.restrictions.join(', ') : 'none'}
- Dislikes: ${dietary.dislikes.length ? dietary.dislikes.join(', ') : 'none'}

## Preferences
- Cuisines: ${preferences.cuisines.length ? preferences.cuisines.join(', ') : 'any'}
- Complexity: ${preferences.complexityTolerance}

## Understanding remainingBudget
Each macro in the response has a status field:
- "under" = below minimum target, need to ADD more of this macro
- "in_range" = within target range, this macro is GOOD
- "over" = above maximum target, need to REDUCE this macro

## Success Condition
The plan is COMPLETE when:
1. All 21 meals are planned (7 days × 3 meals)
2. calories.status is "in_range"
3. All macro statuses are "in_range" OR acceptable ("under" for fat is fine)

When ALL statuses are "in_range": STOP. Immediately call finalize_plan. Do not call check_daily_totals, get_plan_state, or any other tool first — call finalize_plan immediately and you are done.

## Process
1. Use lookup_ingredient before adding meals to ensure ingredients are in the knowledge base
2. Add meals one at a time with add_meal (response includes remainingBudget)
3. Check the status fields - only adjust if status is "under" or "over"
4. If off-track, use modify_meal to adjust earlier meals
5. Call finalize_plan immediately when all statuses are acceptable — no further tool calls

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
- You are encouraged to incorporate pantry items when they fit naturally
- Check pantryStatus.unusedItems in get_plan_state to see available pantry items
- Keep the shopping list small (under 30 unique ingredients) by reusing ingredients across meals
- When shoppingList.warning appears, prioritize ingredients already in the plan
- A compact shopping list is more economical and practical for the user.`;
  }

  buildInitialMessage(profile: Profile, pantry: Pantry, week: string): string {
    const { start, end } = parseWeekKey(week);
    const pantryItems = pantry.items.length
      ? pantry.items
          .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`)
          .join('\n')
      : 'Empty';

    return `Create a meal plan for ${start} to ${end}.

  Pantry:
  ${pantryItems}

  Start by checking get_plan_state, then add meals day by day. Use lookup_ingredient for any ingredient before using it.`;
  }

  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string,
    dataDir: string
  ): Promise<WeeklyPlan> {
    await this.ensureInitialized();

    const planState = new PlanState(week, profile, pantry);
    const handlers = createToolHandlers(planState, this.ingredientDb);

    const systemPrompt = this.buildSystemPrompt(profile);
    const initialMessage = this.buildInitialMessage(profile, pantry, week);

    // Set up progress tracking
    const debugDir = join(homedir(), '.meal-planner', 'debug');
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
        tools: PLANNING_TOOLS,
        toolHandler: handlers.handle,
        maxIterations: 100,
        contextWindow: 15,
        onProgress: tracker.handleEvent.bind(tracker),
      });

      console.log(
        `\nPlanning complete: ${result.toolCalls} tool calls, ${result.iterations} iterations`
      );
      console.log(`Debug log: ${tracker.getLogPath()}`);

      tracker.close();
      return planState.toWeeklyPlan();
    } catch (error) {
      tracker.logError(error as Error);
      throw error;
    }
  }
}
