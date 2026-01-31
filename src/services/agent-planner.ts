import { AIClient } from '../ai/client.js';
import { KnowledgeBase } from './knowledge-base.js';
import { PlanState } from './plan-state.js';
import { USDAClient } from './usda-client.js';
import { createToolHandlers } from '../agent/tool-handlers.js';
import { PLANNING_TOOLS } from '../agent/tools.js';
import type { Profile, Pantry } from '../schemas/index.js';
import type { WeeklyPlan } from '../schemas/plan.js';

export interface AgentPlannerOptions {
  anthropicApiKey: string;
  dataDir: string;
  usdaApiKey?: string;
}

export class AgentPlanner {
  private aiClient: AIClient;
  private kb: KnowledgeBase;
  private usdaClient: USDAClient | null;

  constructor(options: AgentPlannerOptions) {
    this.aiClient = new AIClient(options.anthropicApiKey);
    this.kb = new KnowledgeBase(options.dataDir);
    this.usdaClient = options.usdaApiKey
      ? new USDAClient(options.usdaApiKey)
      : null;
  }

  buildSystemPrompt(profile: Profile): string {
    const { goals, dietary, preferences, household } = profile;

    return `You are a meal planning agent. Your task is to create a complete 7-day meal plan by adding meals one at a time using the available tools.

## Targets
- Household size: ${household.size} people
- Daily calories: ${goals.dailyCalories.min}-${goals.dailyCalories.max} per person
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

## Process
1. Use lookup_ingredient before adding meals to ensure ingredients are in the knowledge base
2. Add meals one at a time with add_meal
3. Check remaining budget after each meal
4. If off-track, use modify_meal to adjust earlier meals
5. Call finalize_plan when complete

Be efficient with tokens. Don't explain your reasoning, just call tools.`;
  }

  buildInitialMessage(profile: Profile, pantry: Pantry, week: string): string {
    const dates = this.getWeekDates(week);
    const pantryItems = pantry.items.length
      ? pantry.items
          .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`)
          .join('\n')
      : 'Empty';

    return `Create a meal plan for week ${week} (${dates[0]} to ${dates[6]}).

Pantry:
${pantryItems}

Start by checking get_plan_state, then add meals day by day. Use lookup_ingredient for any ingredient before using it.`;
  }

  private getWeekDates(week: string): string[] {
    // Parse week string like "2026-W05"
    const [year, weekNum] = week.split('-W').map(Number);

    // Get first day of year
    const jan1 = new Date(year, 0, 1);

    // Find first Monday
    const dayOfWeek = jan1.getDay();
    const daysToMonday =
      dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;

    // Calculate start of requested week
    const weekStart = new Date(jan1);
    weekStart.setDate(jan1.getDate() + daysToMonday + (weekNum - 1) * 7);

    // Generate 7 dates
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  async generateWeeklyPlan(
    profile: Profile,
    pantry: Pantry,
    week: string
  ): Promise<WeeklyPlan> {
    const planState = new PlanState(week, profile, pantry);
    const handlers = createToolHandlers(planState, this.kb, this.usdaClient);

    const result = await this.aiClient.runAgentLoop({
      systemPrompt: this.buildSystemPrompt(profile),
      initialMessage: this.buildInitialMessage(profile, pantry, week),
      tools: PLANNING_TOOLS,
      toolHandler: handlers.handle,
      maxIterations: 100,
    });

    console.log(
      `Planning complete: ${result.toolCalls} tool calls, ${result.iterations} iterations`
    );

    return planState.toWeeklyPlan();
  }
}
