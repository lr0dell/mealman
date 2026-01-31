import Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '../agent/types.js';

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
  model?: string;
}

export interface AgentResult {
  finalText: string;
  toolCalls: number;
  iterations: number;
}

export class AIClient {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';

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
      model = 'claude-haiku-4-5-20251001',
    } = options;

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
      iterations++;

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages: messages as Anthropic.MessageParam[],
      });

      // Collect assistant response
      const assistantContent: MessageContent[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText = block.text;
          assistantContent.push({ type: 'text', text: block.text });
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
          const result = await toolHandler(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }

    return { finalText, toolCalls, iterations };
  }
}
