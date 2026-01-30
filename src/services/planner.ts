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