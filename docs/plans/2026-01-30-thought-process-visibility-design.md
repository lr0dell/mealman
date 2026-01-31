# Thought Process Visibility for Meal Planning

**Date:** 2026-01-30
**Purpose:** Add visibility into the agent's planning process for debugging and user feedback

## Requirements

- **User-facing output**: Minimal high-level progress shown during execution (no flags required)
- **Debug logging**: Detailed transcript written to file silently in background
- **Always on**: No command-line options needed - just works

## Architecture Overview

### Core Changes

We'll modify three main components:

1. **AIClient.runAgentLoop** - Add optional callback for progress events
2. **AgentPlanner** - Implement progress tracking and file logging
3. **generateWeekPlan command** - Display minimal progress to user

### Event-Driven Approach

Instead of modifying console.log statements throughout the code, we'll use a callback pattern. The `runAgentLoop` method will accept an optional `onProgress` callback that fires for key events:
- Tool call started
- Tool result received
- Assistant message received
- Iteration complete

This keeps the AI client clean and reusable while letting the `AgentPlanner` decide what to log and display.

### Two Output Streams

1. **Console output (minimal)**: AgentPlanner tracks meal additions and prints:
   - "Planning Monday breakfast..." when detecting new meal
   - "✓ Monday complete (3 meals)" when day completes

2. **Debug log file (detailed)**: Written to `~/.meal-planner/debug/plan-{timestamp}.log` including:
   - Timestamps for each event
   - System prompt and initial message
   - All tool calls with full inputs
   - All tool results with full outputs
   - Assistant text responses
   - Iteration/token counts and latencies

## Progress Callback Interface

### Event Types

```typescript
type AgentProgressEvent =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call_start'; name: string; input: unknown }
  | { type: 'tool_call_result'; name: string; result: unknown; durationMs: number }
  | { type: 'iteration_complete'; iteration: number; toolCalls: number }
  | { type: 'loop_complete'; totalIterations: number; totalToolCalls: number };
```

### AIClient Changes

Add optional `onProgress` callback to `AgentLoopOptions`:

```typescript
export interface AgentLoopOptions {
  // ... existing fields ...
  onProgress?: (event: AgentProgressEvent) => void;
}
```

The `runAgentLoop` method will call this callback at key points:
- Before each iteration starts
- When assistant sends text
- Before calling each tool
- After each tool completes (with duration)
- After each iteration
- When loop finishes

This gives the AgentPlanner complete visibility into what's happening without coupling the AI client to specific logging implementations.

## AgentPlanner Event Handling

### Progress Tracker Class

The AgentPlanner will use a helper class to manage both outputs:

```typescript
class PlanningProgressTracker {
  private logFilePath: string;
  private logStream: WriteStream;
  private startTime: number;
  private currentDay: string | null = null;
  private mealsThisDay: number = 0;

  constructor(week: string, debugDir: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = join(debugDir, `plan-${timestamp}.log`);
    this.startTime = Date.now();
    // Create debug directory if needed
    // Open file stream for writing
  }

  handleEvent(event: AgentProgressEvent): void {
    // Write detailed info to log file
    this.writeToLog(event);

    // Update console for meal-related events
    this.updateConsole(event);
  }
}
```

### Console Updates (Minimal)

The tracker watches `tool_call_start` events for `add_meal` to detect when meals are being planned. It extracts the date from the input and prints:
- "Planning Monday breakfast..." when a new day starts
- "✓ Monday complete (3 meals)" when the day changes or loop completes

## Debug Log Format

### Log File Structure

The debug log will be a plain text transcript with clear sections:

```
================================
MEAL PLANNING SESSION
================================
Week: 2026-W05
Started: 2026-01-30 15:40:33
Model: claude-haiku-4-5-20251001
Data Dir: /home/user/.meal-planner/data

================================
SYSTEM PROMPT
================================
You are a meal planning agent. Your task is to create...
[full system prompt]

================================
INITIAL MESSAGE
================================
Create a meal plan for week 2026-W05 (2026-01-27 to 2026-02-02)...
[full initial message]

================================
ITERATION 1
================================
[15:40:34.123] Tool call: get_plan_state
Input: {}

[15:40:34.456] Tool result (333ms):
{"week":"2026-W05","mealsPlanned":0,...}

[15:40:35.789] Assistant message:
[no text - continuing with tools]

================================
ITERATION 2
================================
[15:40:36.012] Tool call: lookup_ingredient
Input: {"name":"oats"}
...
```

### Footer Summary

At the end, include summary statistics:
- Total iterations
- Total tool calls
- Total duration
- Final status (completed/max iterations)

## Implementation Details

### File Changes Required

1. **`src/ai/client.ts`**:
   - Add `AgentProgressEvent` type definition
   - Add `onProgress?: (event: AgentProgressEvent) => void` to `AgentLoopOptions`
   - Emit events at 6 key points in `runAgentLoop`:
     - Start of each iteration
     - When assistant text block appears
     - Before each tool call (with timing)
     - After each tool completes (with duration)
     - End of each iteration
     - End of loop

2. **`src/services/agent-planner.ts`**:
   - Create `PlanningProgressTracker` helper class
   - Instantiate tracker in `generateWeeklyPlan` method
   - Pass `tracker.handleEvent.bind(tracker)` as `onProgress` callback
   - Return log file path in console output

3. **`src/commands/plan.ts`**:
   - Remove hardcoded console.log statements
   - Let AgentPlanner handle all output
   - Maybe print log file location at the end

### Data Flow

```
AIClient
  → emits events
    → ProgressTracker
      → writes log file + updates console
        → user sees minimal progress
```

## Error Handling & Edge Cases

### Directory Creation

- Check if `~/.meal-planner/debug/` exists before writing
- Create it (with parent directories) if missing using `mkdirSync(..., { recursive: true })`
- Handle permission errors gracefully - if log file can't be created, continue without it (don't fail the planning)

### File Write Failures

- Wrap all log writes in try-catch
- If write fails, silently continue (planning is more important than logging)
- Optionally print warning once: "Warning: Could not write debug log"

### Planning Failures

- If planning fails/throws, ensure log file is properly closed with error details
- Add final section to log: `PLANNING FAILED: [error message]`
- Include partial progress so user can debug what happened before failure

### Max Iterations Reached

- Log clearly shows this: `REACHED MAX ITERATIONS (100)`
- Console shows partial completion: "✓ Monday-Wednesday complete (9 meals) - stopped at max iterations"

### Day Detection Logic

- Parse dates from `add_meal` tool inputs
- Handle out-of-order meal additions (agent might skip around)
- Track meals per day in a Map<string, number>
- Only print day completion when moving to new day or at end

## Testing & Validation

### Manual Testing

1. **Happy path**: Run `meal plan week` and verify:
   - Console shows "Planning Monday breakfast..." messages
   - Each day completion prints "✓ Monday complete (N meals)"
   - Debug log file created in `~/.meal-planner/debug/`
   - Log contains all system prompt, tool calls, results, timestamps

2. **Error scenarios**:
   - Planning fails mid-execution → log shows error and partial progress
   - Debug directory doesn't exist → gets created automatically
   - Debug directory not writable → planning continues without log

3. **Edge cases**:
   - Agent reaches max iterations → proper messaging in console and log
   - Agent plans meals out of order → day tracking still works correctly
   - Empty/minimal plan → doesn't crash on zero meals

### Unit Tests

Add tests for `PlanningProgressTracker`:
- Event handling logic (day detection from add_meal inputs)
- Console message formatting
- Log file writing (using temp directory)

### Acceptance Criteria

- ✓ User sees minimal progress without any flags
- ✓ Debug log written to `~/.meal-planner/debug/plan-{timestamp}.log`
- ✓ Log contains complete conversation with timestamps and metadata
- ✓ Planning doesn't fail if logging fails
- ✓ Works correctly even if agent plans meals out of order

## Example Output

### Console (what user sees)

```
Generating meal plan for 2026-W05...
This may take a minute as the AI plans each meal.

Planning Monday breakfast...
Planning Monday lunch...
Planning Monday dinner...
✓ Monday complete (3 meals)
Planning Tuesday breakfast...
Planning Tuesday lunch...
Planning Tuesday dinner...
✓ Tuesday complete (3 meals)
...
✓ Sunday complete (3 meals)

Plan generated for 2026-W05:
- 7 days planned
- Total calories: 14000
- Estimated cost: $95.50

Debug log: /home/user/.meal-planner/debug/plan-2026-01-30T15-40-33-123Z.log
```

### Debug Log (excerpt)

```
================================
ITERATION 5
================================
[15:40:41.234] Tool call: add_meal
Input: {
  "date": "2026-01-27",
  "slot": "breakfast",
  "name": "Oatmeal with Berries",
  "recipe": "Cook 1 cup oats...",
  "ingredients": [
    {"name": "oats", "amountGrams": 80},
    {"name": "blueberries", "amountGrams": 100}
  ],
  "prepTime": 10,
  "servings": 2
}

[15:40:41.567] Tool result (333ms):
{
  "success": true,
  "meal": {
    "name": "Oatmeal with Berries",
    "calories": 350,
    "macros": {"protein": 12, "carbs": 58, "fat": 8, "fiber": 10},
    "cost": 2.50
  },
  "dayTotals": {"calories": 350, "macros": {...}, "estimatedCost": 2.50},
  "remainingBudget": {"calories": {...}, "cost": 147.50}
}
```
