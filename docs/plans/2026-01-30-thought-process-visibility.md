# Thought Process Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add progress tracking and debug logging to agent meal planning so users see minimal progress updates while detailed logs are written for debugging.

**Architecture:** Event-driven callback system where AIClient emits progress events, AgentPlanner's ProgressTracker handles them by updating console (minimal) and writing debug logs (detailed).

**Tech Stack:** TypeScript, Node.js fs streams, existing AIClient/AgentPlanner classes

---

## Task 1: Add Progress Event Types to AIClient

**Files:**
- Modify: `src/ai/client.ts` (add type definitions after imports)

**Step 1: Add progress event type definitions**

Add after the existing type definitions (around line 23):

```typescript
export type AgentProgressEvent =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call_start'; name: string; input: unknown }
  | { type: 'tool_call_result'; name: string; result: unknown; durationMs: number }
  | { type: 'iteration_complete'; iteration: number; toolCalls: number }
  | { type: 'loop_complete'; totalIterations: number; totalToolCalls: number };
```

**Step 2: Add onProgress to AgentLoopOptions interface**

Modify the `AgentLoopOptions` interface (around line 9):

```typescript
export interface AgentLoopOptions {
  systemPrompt: string;
  initialMessage: string;
  tools: ToolDefinition[];
  toolHandler: (name: string, input: unknown) => Promise<unknown>;
  maxIterations?: number;
  model?: string;
  onProgress?: (event: AgentProgressEvent) => void;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/ai/client.ts
git commit -m "feat: add progress event types to AIClient"
```

---

## Task 2: Emit Progress Events in runAgentLoop

**Files:**
- Modify: `src/ai/client.ts:78-156` (runAgentLoop method)

**Step 1: Extract onProgress from options**

Modify line 78-86 to extract onProgress:

```typescript
async runAgentLoop(options: AgentLoopOptions): Promise<AgentResult> {
  const {
    systemPrompt,
    initialMessage,
    tools,
    toolHandler,
    maxIterations = 100,
    model = 'claude-haiku-4-5-20251001',
    onProgress,
  } = options;
```

**Step 2: Emit iteration_start event**

Add after line 102 (start of while loop, before iterations++):

```typescript
while (iterations < maxIterations) {
  onProgress?.({ type: 'iteration_start', iteration: iterations + 1 });
  iterations++;
```

**Step 3: Emit assistant_message events**

Replace lines 116-120 with:

```typescript
for (const block of response.content) {
  if (block.type === 'text') {
    finalText = block.text;
    assistantContent.push({ type: 'text', text: block.text });
    onProgress?.({ type: 'assistant_message', text: block.text });
  } else if (block.type === 'tool_use') {
```

**Step 4: Emit tool_call_start and tool_call_result events**

Replace lines 138-149 with:

```typescript
// Execute tool calls
const toolResults: MessageContent[] = [];

for (const block of response.content) {
  if (block.type === 'tool_use') {
    toolCalls++;
    onProgress?.({
      type: 'tool_call_start',
      name: block.name,
      input: block.input,
    });

    const startTime = Date.now();
    const result = await toolHandler(block.name, block.input);
    const durationMs = Date.now() - startTime;

    onProgress?.({
      type: 'tool_call_result',
      name: block.name,
      result,
      durationMs,
    });

    toolResults.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: JSON.stringify(result),
    });
  }
}
```

**Step 5: Emit iteration_complete event**

Add after line 152 (after messages.push, before end of while loop):

```typescript
messages.push({ role: 'user', content: toolResults });

// Track tool calls in this iteration
const iterationToolCalls = toolResults.length;
onProgress?.({
  type: 'iteration_complete',
  iteration: iterations,
  toolCalls: iterationToolCalls,
});
```

**Step 6: Emit loop_complete event**

Add before the return statement (around line 155):

```typescript
onProgress?.({
  type: 'loop_complete',
  totalIterations: iterations,
  totalToolCalls: toolCalls,
});

return { finalText, toolCalls, iterations };
```

**Step 7: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 8: Commit**

```bash
git add src/ai/client.ts
git commit -m "feat: emit progress events in runAgentLoop"
```

---

## Task 3: Create PlanningProgressTracker Class

**Files:**
- Create: `src/services/planning-progress-tracker.ts`

**Step 1: Create tracker class with skeleton**

Create file with:

```typescript
import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WriteStream } from 'node:fs';
import type { AgentProgressEvent } from '../ai/client.js';
import type { AddMealInput } from '../agent/types.js';

export class PlanningProgressTracker {
  private logFilePath: string;
  private logStream: WriteStream | null = null;
  private startTime: number;
  private sessionStart: string;
  private week: string;
  private dataDir: string;
  private model: string;
  private systemPrompt: string;
  private initialMessage: string;

  // Console tracking
  private currentDay: string | null = null;
  private mealsPerDay = new Map<string, number>();
  private logWriteError = false;

  constructor(
    week: string,
    dataDir: string,
    debugDir: string,
    model: string,
    systemPrompt: string,
    initialMessage: string
  ) {
    this.week = week;
    this.dataDir = dataDir;
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.initialMessage = initialMessage;
    this.startTime = Date.now();
    this.sessionStart = new Date().toISOString().replace('T', ' ').split('.')[0];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = join(debugDir, `plan-${timestamp}.log`);

    try {
      if (!existsSync(debugDir)) {
        mkdirSync(debugDir, { recursive: true });
      }
      this.logStream = createWriteStream(this.logFilePath, { flags: 'w' });
      this.writeHeader();
    } catch (error) {
      this.logWriteError = true;
      console.warn('Warning: Could not create debug log file');
    }
  }

  handleEvent(event: AgentProgressEvent): void {
    this.writeToLog(event);
    this.updateConsole(event);
  }

  private writeHeader(): void {
    if (!this.logStream) return;

    const header = `================================
MEAL PLANNING SESSION
================================
Week: ${this.week}
Started: ${this.sessionStart}
Model: ${this.model}
Data Dir: ${this.dataDir}

================================
SYSTEM PROMPT
================================
${this.systemPrompt}

================================
INITIAL MESSAGE
================================
${this.initialMessage}

`;
    this.safeWrite(header);
  }

  private writeToLog(event: AgentProgressEvent): void {
    if (!this.logStream || this.logWriteError) return;

    const timestamp = this.formatTimestamp();

    switch (event.type) {
      case 'iteration_start':
        this.safeWrite(`\n================================\nITERATION ${event.iteration}\n================================\n`);
        break;

      case 'assistant_message':
        if (event.text) {
          this.safeWrite(`[${timestamp}] Assistant message:\n${event.text}\n\n`);
        }
        break;

      case 'tool_call_start':
        this.safeWrite(`[${timestamp}] Tool call: ${event.name}\n`);
        this.safeWrite(`Input: ${JSON.stringify(event.input, null, 2)}\n\n`);
        break;

      case 'tool_call_result':
        this.safeWrite(`[${timestamp}] Tool result (${event.durationMs}ms):\n`);
        this.safeWrite(`${JSON.stringify(event.result, null, 2)}\n\n`);
        break;

      case 'iteration_complete':
        // No extra logging needed - iterations are already separated
        break;

      case 'loop_complete':
        this.writeFooter(event);
        break;
    }
  }

  private updateConsole(event: AgentProgressEvent): void {
    if (event.type === 'tool_call_start' && event.name === 'add_meal') {
      const input = event.input as AddMealInput;
      const date = input.date;
      const slot = input.slot;
      const dayName = this.getDayName(date);

      // Track meals per day
      const currentCount = this.mealsPerDay.get(date) || 0;
      this.mealsPerDay.set(date, currentCount + 1);

      // If starting a new day, complete the previous day
      if (this.currentDay && this.currentDay !== date) {
        this.completeDayOutput(this.currentDay);
      }

      // Print meal being planned
      console.log(`Planning ${dayName} ${slot}...`);
      this.currentDay = date;
    } else if (event.type === 'loop_complete') {
      // Complete the final day
      if (this.currentDay) {
        this.completeDayOutput(this.currentDay);
      }
    }
  }

  private completeDayOutput(date: string): void {
    const mealCount = this.mealsPerDay.get(date) || 0;
    const dayName = this.getDayName(date);
    console.log(`✓ ${dayName} complete (${mealCount} meals)`);
  }

  private getDayName(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  private writeFooter(event: { totalIterations: number; totalToolCalls: number }): void {
    if (!this.logStream) return;

    const duration = Date.now() - this.startTime;
    const durationSec = (duration / 1000).toFixed(2);

    const footer = `
================================
SESSION SUMMARY
================================
Total iterations: ${event.totalIterations}
Total tool calls: ${event.totalToolCalls}
Duration: ${durationSec}s
Status: Completed

`;
    this.safeWrite(footer);
  }

  private formatTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const millis = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }

  private safeWrite(content: string): void {
    if (!this.logStream || this.logWriteError) return;

    try {
      this.logStream.write(content);
    } catch (error) {
      if (!this.logWriteError) {
        this.logWriteError = true;
        console.warn('Warning: Could not write to debug log');
      }
    }
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }

  getLogPath(): string {
    return this.logFilePath;
  }

  logError(error: Error): void {
    if (!this.logStream || this.logWriteError) return;

    const errorSection = `
================================
PLANNING FAILED
================================
Error: ${error.message}
Stack: ${error.stack}

`;
    this.safeWrite(errorSection);
    this.close();
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/services/planning-progress-tracker.ts
git commit -m "feat: add PlanningProgressTracker class for debug logging"
```

---

## Task 4: Integrate ProgressTracker into AgentPlanner

**Files:**
- Modify: `src/services/agent-planner.ts`

**Step 1: Import the ProgressTracker**

Add import at top of file (around line 7):

```typescript
import { PlanningProgressTracker } from './planning-progress-tracker.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
```

**Step 2: Modify generateWeeklyPlan to use tracker**

Replace the `generateWeeklyPlan` method (lines 104-125) with:

```typescript
async generateWeeklyPlan(
  profile: Profile,
  pantry: Pantry,
  week: string,
  dataDir: string
): Promise<WeeklyPlan> {
  const planState = new PlanState(week, profile, pantry);
  const handlers = createToolHandlers(planState, this.kb, this.usdaClient);

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
```

**Step 3: Update constructor to not require dataDir**

The AgentPlannerOptions already has dataDir, so we're good. No change needed.

**Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add src/services/agent-planner.ts
git commit -m "feat: integrate ProgressTracker into AgentPlanner"
```

---

## Task 5: Pass dataDir from Command to AgentPlanner

**Files:**
- Modify: `src/commands/plan.ts:6-42`

**Step 1: Update generateWeekPlan to pass dataDir**

Modify the `generateWeekPlan` function (around line 6-42):

```typescript
export async function generateWeekPlan(dataDir: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const store = new DataStore(dataDir);
  await store.init();

  const profile = await store.getProfile();
  const pantry = await store.getPantry();

  // Calculate current week
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  const week = `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

  console.log(`Generating meal plan for ${week}...`);
  console.log('This may take a minute as the AI plans each meal.\n');

  const planner = new AgentPlanner({
    anthropicApiKey: apiKey,
    dataDir,
    usdaApiKey: process.env.USDA_API_KEY,
  });

  const plan = await planner.generateWeeklyPlan(profile, pantry, week, dataDir);

  await store.saveWeeklyPlan(plan);

  console.log(`\nPlan generated for ${week}:`);
  console.log(`- ${plan.days.length} days planned`);
  console.log(`- Total calories: ${plan.totals.calories}`);
  console.log(`- Estimated cost: $${plan.totals.estimatedCost.toFixed(2)}`);
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/commands/plan.ts
git commit -m "feat: pass dataDir to AgentPlanner.generateWeeklyPlan"
```

---

## Task 6: Manual Testing

**Files:**
- N/A (manual testing)

**Step 1: Set up environment**

Ensure you have:
- `ANTHROPIC_API_KEY` set in environment
- Optionally `USDA_API_KEY` for ingredient lookups

**Step 2: Run the plan command**

Run: `npm start -- plan week`

Expected output (example):
```
Generating meal plan for 2026-W05...
This may take a minute as the AI plans each meal.

Planning Monday breakfast...
Planning Monday lunch...
Planning Monday dinner...
✓ Monday complete (3 meals)
Planning Tuesday breakfast...
...
✓ Sunday complete (3 meals)

Planning complete: 45 tool calls, 23 iterations
Debug log: /home/user/.meal-planner/debug/plan-2026-01-30T16-30-45-123Z.log

Plan generated for 2026-W05:
- 7 days planned
- Total calories: 14000
- Estimated cost: $95.50
```

**Step 3: Verify debug log exists and has content**

Run: `ls -lh ~/.meal-planner/debug/`
Expected: See the log file created

Run: `head -50 ~/.meal-planner/debug/plan-*.log`
Expected: See header with session info, system prompt, initial message, iterations

**Step 4: Check log has tool calls**

Run: `grep -c "Tool call:" ~/.meal-planner/debug/plan-*.log`
Expected: Number matching tool calls from output (e.g., 45)

**Step 5: Verify error handling (optional)**

Test by temporarily breaking something (e.g., invalid API key) and verify:
- Planning fails gracefully
- Log file still created with error details
- No crash

**Step 6: Document test results**

If all tests pass, note it. If issues found, fix them before proceeding.

---

## Task 7: Final Commit and Cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npm test`
Expected: All existing tests pass (no new tests added yet for tracker)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build with no errors

**Step 3: Check git status**

Run: `git status`
Expected: Working tree clean (all changes committed)

**Step 4: Review commits**

Run: `git log --oneline -7`
Expected: See all feature commits in order

**Step 5: Done!**

Feature is complete. The agent now shows minimal progress to users and writes detailed debug logs for debugging.

---

## Future Enhancements (Not in Scope)

- Unit tests for PlanningProgressTracker class
- Integration test that mocks AIClient and verifies events
- Configuration option to disable debug logging
- Log rotation/cleanup for old debug files
- Structured JSON logging option
