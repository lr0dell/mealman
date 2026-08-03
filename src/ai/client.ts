import Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '../agent/types.js';
import {
  resolvePlanningModelConfig,
  DEFAULT_PLANNING_MODEL,
  PLANNING_MAX_TOKENS,
  type PlanningModelConfig,
} from './model-config.js';

export interface ChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AgentLoopOptions {
  systemPrompt: string;
  initialMessage: string;
  tools: ToolDefinition[];
  toolHandler: (name: string, input: unknown) => Promise<unknown>;
  maxIterations?: number;
  modelConfig?: PlanningModelConfig;
  onProgress?: (event: AgentProgressEvent) => void;
  /** Maximum number of assistant+tool-result pairs to keep in context. Older pairs are dropped. Default: unlimited. */
  contextWindow?: number;
}

export interface AgentResult {
  finalText: string;
  toolCalls: number;
  iterations: number;
}

export type AgentProgressEvent =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call_start'; name: string; input: unknown }
  | {
      type: 'tool_call_result';
      name: string;
      result: unknown;
      durationMs: number;
    }
  | { type: 'iteration_complete'; iteration: number; toolCalls: number }
  | { type: 'loop_complete'; totalIterations: number; totalToolCalls: number };

export class AIClient {
  private client: Anthropic;
  private model = DEFAULT_PLANNING_MODEL;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(userMessage: string, options: ChatOptions = {}): Promise<string> {
    const { systemPrompt, maxTokens = 4096 } = options;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    if (response.stop_reason === 'max_tokens') {
      throw new Error('Response was truncated due to token limit');
    }

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textContent.text;
  }

  async chatJSON<T>(
    userMessage: string,
    options: ChatOptions = {}
  ): Promise<T> {
    const response = await this.chat(userMessage, {
      ...options,
      systemPrompt:
        `${options.systemPrompt || ''}\n\nRespond with valid JSON only. No markdown code blocks.`.trim(),
    });

    // Extract JSON if wrapped in code blocks
    let jsonStr = response.trim();

    // Remove markdown code block wrapper if present
    if (jsonStr.startsWith('```')) {
      // Remove opening ```json or ```
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '');
      // Remove closing ```
      jsonStr = jsonStr.replace(/\n?```\s*$/, '');
    }

    return JSON.parse(jsonStr) as T;
  }

  async runAgentLoop(options: AgentLoopOptions): Promise<AgentResult> {
    const {
      systemPrompt,
      initialMessage,
      tools,
      toolHandler,
      maxIterations = 100,
      onProgress,
      contextWindow,
    } = options;

    const modelConfig = options.modelConfig ?? resolvePlanningModelConfig();

    const safeProgress = (event: AgentProgressEvent): void => {
      if (!onProgress) return;
      try {
        onProgress(event);
      } catch (error) {
        // Log but don't crash - progress callbacks shouldn't break execution
        console.warn('Progress callback error:', error);
      }
    };

    type MessageContent =
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: unknown }
      | { type: 'tool_result'; tool_use_id: string; content: string };

    const messages: Array<{
      role: 'user' | 'assistant';
      content: MessageContent[];
    }> = [{ role: 'user', content: [{ type: 'text', text: initialMessage }] }];

    let iterations = 0;
    let toolCalls = 0;
    let finalText = '';

    while (iterations < maxIterations) {
      safeProgress({ type: 'iteration_start', iteration: iterations + 1 });
      iterations++;

      // Prune history to contextWindow pairs (initial message always kept).
      // Always create a new array so mock-recorded references aren't affected by later pushes.
      const contextMessages =
        contextWindow !== undefined && messages.length > 1 + contextWindow * 2
          ? [messages[0], ...messages.slice(-(contextWindow * 2))]
          : [...messages];

      const response = await this.client.messages.create({
        model: modelConfig.model,
        max_tokens: PLANNING_MAX_TOKENS,
        system: systemPrompt,
        thinking: { type: modelConfig.thinking },
        output_config: { effort: modelConfig.effort },
        tools: tools as Anthropic.Tool[],
        messages: contextMessages as Anthropic.MessageParam[],
      });

      // Collect assistant response
      const assistantContent: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText = block.text;
          assistantContent.push({ type: 'text', text: block.text });
          safeProgress({ type: 'assistant_message', text: block.text });
        } else if (block.type === 'tool_use') {
          assistantContent.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }

      messages.push({ role: 'assistant', content: assistantContent });

      // If no tool use, we're done
      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Execute tool calls
      const toolResults: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCalls++;
          safeProgress({
            type: 'tool_call_start',
            name: block.name,
            input: block.input,
          });

          const startTime = Date.now();
          const result = await toolHandler(block.name, block.input);
          const durationMs = Date.now() - startTime;

          safeProgress({
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

      messages.push({ role: 'user', content: toolResults });

      safeProgress({
        type: 'iteration_complete',
        iteration: iterations,
        toolCalls: toolResults.length,
      });
    }

    safeProgress({
      type: 'loop_complete',
      totalIterations: iterations,
      totalToolCalls: toolCalls,
    });

    return { finalText, toolCalls, iterations };
  }
}
