/**
 * The single definition of which model the planning agent runs on and how.
 *
 * Env overrides exist so the validation runs in the design doc can sweep
 * model, thinking, and effort without patching source.
 */

export const DEFAULT_PLANNING_MODEL = 'claude-sonnet-5';

/** Non-streaming request, so this stays well under the SDK HTTP timeout. */
export const PLANNING_MAX_TOKENS = 4096;

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export type ThinkingMode = 'disabled' | 'adaptive';

export interface PlanningModelConfig {
  model: string;
  thinking: ThinkingMode;
  effort: EffortLevel;
}

/**
 * Thinking defaults to 'disabled'. This must always be sent explicitly:
 * on Sonnet 5, omitting the thinking parameter enables adaptive thinking,
 * unlike Haiku 4.5 where omitting it meant no thinking.
 */
export function resolvePlanningModelConfig(
  env: NodeJS.ProcessEnv = process.env
): PlanningModelConfig {
  const model = env.MEAL_MODEL?.trim() || DEFAULT_PLANNING_MODEL;

  const thinking = (env.MEAL_THINKING?.trim() || 'disabled').toLowerCase();
  if (thinking !== 'disabled' && thinking !== 'adaptive') {
    throw new Error(
      `MEAL_THINKING must be "disabled" or "adaptive", got "${thinking}"`
    );
  }

  const effort = (env.MEAL_EFFORT?.trim() || 'medium').toLowerCase();
  if (!(EFFORT_LEVELS as readonly string[]).includes(effort)) {
    throw new Error(
      `MEAL_EFFORT must be one of ${EFFORT_LEVELS.join(', ')}, got "${effort}"`
    );
  }

  return { model, thinking, effort: effort as EffortLevel };
}
