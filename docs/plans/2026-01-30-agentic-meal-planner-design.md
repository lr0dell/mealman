# Agentic Meal Planner Design

**Date:** 2026-01-30
**Status:** Approved

## Overview

Transform the meal planner from a single-shot LLM prompt into an agentic tool-use system that builds weekly plans meal-by-meal with programmatic nutrition and cost calculation.

### Goals

1. **Accuracy** - All nutrition/cost calculations done in TypeScript from verified ingredient data, not LLM guesses
2. **Reliability** - Iterative building with verification; agent can backtrack and revise
3. **Learning** - Knowledge base grows over time with verified ingredient data
4. **Cost efficiency** - Target < $1 per weekly plan (estimated ~$0.07 with Haiku)

### Key Decisions

| Decision | Choice |
|----------|--------|
| Model | Claude Haiku (cost-efficient for structured tool-use) |
| Granularity | Meal-by-meal (21 meals per week) |
| Data sources | KB → USDA API → AI estimate |
| Course correction | Backtrack and modify earlier meals |
| User interaction | Fully autonomous |
| KB persistence | Auto-save with confidence flag |

## Architecture

### Core Loop

1. Agent receives planning task (profile, pantry, week)
2. Agent calls tools to build plan meal-by-meal
3. After each meal, agent sees updated totals and remaining budget
4. Agent can backtrack using "modify meal" tool if targets are off-track
5. Loop ends when agent calls "finalize plan" tool

### Components

- **AgentPlanner** - New service managing the tool-use conversation loop
- **PlanningTools** - Collection of tool implementations
- **PlanState** - In-memory state tracking the plan being built
- **KnowledgeBase** - Persisted ingredient data with confidence flags
- **MacroCalculator** - Pure functions for nutrition math
- **USDAClient** - USDA FoodData Central API integration

## Tool Definitions

### Plan Building

| Tool | Description |
|------|-------------|
| `get_plan_state` | Returns current plan: meals so far, daily/weekly totals, remaining targets |
| `add_meal` | Add meal to specific day/slot with ingredients and portions |
| `modify_meal` | Replace or update an existing meal (for backtracking) |
| `remove_meal` | Remove a meal entirely |
| `finalize_plan` | Signal completion, triggers validation and return |

### Nutrition & Cost Calculation

| Tool | Description |
|------|-------------|
| `lookup_ingredient` | Get nutrition data: KB → USDA → AI estimate |
| `calculate_meal_nutrition` | Compute totals from ingredient list using KB data |

### Knowledge Base

| Tool | Description |
|------|-------------|
| `search_knowledge_base` | Search ingredients by name (fuzzy match) |
| `get_known_ingredients` | List all ingredients in KB |

### Constraints Checking

| Tool | Description |
|------|-------------|
| `check_daily_totals` | Get day totals, compare against targets |
| `check_weekly_totals` | Get weekly totals, show remaining budget |

## Data Flow

### Adding a Meal

1. Agent calls `add_meal` with day, slot, meal name, ingredients list
2. For each ingredient, system looks up nutrition via `lookup_ingredient`
3. `MacroCalculator` computes totals: ingredient amounts × nutrition per 100g
4. Meal added to `PlanState` with computed (not guessed) values
5. Tool returns: success + updated daily totals + remaining weekly budget

### Ingredient Lookup Priority

1. **Local KB** - Exact or fuzzy match returns immediately
2. **USDA FoodData Central** - Free API, save to KB with `confidence: "usda"`
3. **AI Estimate** - Small focused prompt, save to KB with `confidence: "ai-estimate"`

### Key Principle

The agent proposes meals and ingredients. All nutrition math happens in TypeScript. The agent never calculates calories - it reads verified results from tools.

## State Management

### PlanState (in-memory during planning)

```typescript
interface PlanState {
  week: string;
  days: Map<string, DayMeals>;  // date -> meals
  profile: Profile;             // for target reference
  pantry: Pantry;               // for ingredient availability
}
```

### Knowledge Base Entry

```typescript
interface IngredientEntry {
  name: string;
  pricePerUnit: number;
  unit: string;                    // "kg", "each", "liter"
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  confidence: "usda" | "ai-estimate" | "manual";
  usdaFdcId?: number;              // for re-lookup
  lastUpdated: string;
}
```

Stored at `data/knowledge/ingredients.json`.

## Claude Tool-Use Integration

### New AIClient Method

```typescript
async runAgentLoop(
  systemPrompt: string,
  initialMessage: string,
  tools: ToolDefinition[],
  toolHandler: (name: string, input: unknown) => Promise<unknown>,
  maxIterations?: number
): Promise<AgentResult>
```

### Loop Mechanics

1. Send initial message with tool definitions to Claude
2. If response contains `tool_use` blocks, execute each via `toolHandler`
3. Send tool results back as `tool_result` messages
4. Repeat until `stop_reason: "end_turn"` or `finalize_plan` called
5. Safety limit: 100 iterations max

### Token Efficiency

Each Claude response is 1-3 tool calls (~200-500 tokens) rather than a 4000+ token JSON blob.

## Backtracking & Error Handling

### Backtracking

Agent calls `modify_meal` to revise earlier decisions:
1. Removes old meal's contribution from totals
2. Adds new meal and recalculates
3. Returns updated state showing impact

Agent sees running totals after every operation, enabling proactive adjustments like "I'm trending over on carbs, swap Tuesday's pasta for a salad."

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| Ingredient not found anywhere | Use AI estimate, mark low confidence |
| USDA API failure | Fall back to AI estimate, log failure |
| Budget/macro impossible | Finalize with `warnings` array explaining constraint violation |
| Max iterations reached | Force finalization, flag as incomplete |

### Validation on Finalize

Run schema validation on complete plan. Return issues to agent for one final correction attempt.

## USDA Integration

### FoodData Central API

- **Cost:** Free (requires API key registration)
- **Endpoint:** `https://api.nal.usda.gov/fdc/v1/foods/search`
- **Data available:** Energy (kcal), protein, carbs, fat, fiber per 100g
- **Not available:** Price data (use AI estimate)

### Lookup Flow

1. Search by ingredient name
2. Get `fdcId` from results
3. Fetch nutrient details
4. Extract and normalize to per-100g values
5. Save to KB with `confidence: "usda"`

## Cost Optimization

### Target: < $1 per weekly plan

### Model Choice: Claude Haiku

- Tool-use is highly structured
- Each decision is small
- Tools return computed data
- ~$0.25/M input, $1.25/M output

### Estimated Cost

| Item | Calculation | Cost |
|------|-------------|------|
| Output tokens | 63 turns × 500 tokens = 31,500 | ~$0.04 |
| Input tokens | ~126,000 average | ~$0.03 |
| **Total** | | **~$0.07** |

### Optimizations

1. **Compact tool results** - Return only essential data, not full state
2. **Lean system prompt** - ~500 tokens max
3. **Summarize mid-conversation** - After each day, summarize rather than list all meals
4. **Pre-seeded KB** - Ship with 100+ common ingredients
5. **Batch ingredient checks** - Look up multiple ingredients before adding meal

### Fallback Strategy

If Haiku struggles (detected via repeated failures), escalate to Sonnet for that specific plan.

## Testing Strategy

### Unit Tests

- `MacroCalculator` - Verify calorie/macro math
- `KnowledgeBase` - Read/write/search operations
- `PlanState` - Add/modify/remove and total recalculation
- Individual tools - Mock dependencies, verify structure

### Integration Tests

- `USDAClient` - Real API calls (skippable in CI)
- `AgentLoop` - Mock Claude responses, verify state updates

### End-to-End Tests

- Full planning with mocked Claude (scripted tool calls)
- Optional real Claude test (expensive, manual)

### Test Data

- Fixture KB with ~20 common ingredients
- Fixture profile with specific targets

## Implementation Order

1. `MacroCalculator` - Pure functions, no dependencies
2. `KnowledgeBase` - File-based persistence
3. `USDAClient` - External API integration
4. `PlanState` - In-memory state management
5. `PlanningTools` - Tool implementations
6. `AIClient.runAgentLoop` - Tool-use conversation loop
7. `AgentPlanner` - Orchestration service
8. Integration and E2E tests
9. Pre-seed KB with common ingredients
