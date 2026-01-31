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
    this.sessionStart = new Date()
      .toISOString()
      .replace('T', ' ')
      .split('.')[0];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = join(debugDir, `plan-${timestamp}.log`);

    try {
      if (!existsSync(debugDir)) {
        mkdirSync(debugDir, { recursive: true });
      }
      this.logStream = createWriteStream(this.logFilePath, { flags: 'w' });
      this.writeHeader();
    } catch {
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
        this.safeWrite(
          `\n================================\nITERATION ${event.iteration}\n================================\n`
        );
        break;

      case 'assistant_message':
        if (event.text) {
          this.safeWrite(
            `[${timestamp}] Assistant message:\n${event.text}\n\n`
          );
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
    console.log(`* ${dayName} complete (${mealCount} meals)`);
  }

  private getDayName(dateStr: string): string {
    const date = new Date(dateStr);
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[date.getDay()];
  }

  private writeFooter(event: {
    totalIterations: number;
    totalToolCalls: number;
  }): void {
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
    } catch {
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
