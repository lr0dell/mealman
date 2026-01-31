import { describe, it, expect, vi } from 'vitest';
import { AIClient } from './client.js';
import type { ToolDefinition } from '../agent/types.js';

// We'll test the loop logic by mocking the Anthropic client
describe('AIClient.runAgentLoop', () => {
  it('executes tool calls and returns final result', async () => {
    const client = new AIClient('test-key');

    // Mock the internal client
    const mockCreate = vi.fn();
    (
      client as unknown as {
        client: { messages: { create: typeof mockCreate } };
      }
    ).client = {
      messages: { create: mockCreate },
    };

    // First call: Claude wants to use a tool
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'get_data',
          input: { key: 'test' },
        },
      ],
      stop_reason: 'tool_use',
    });

    // Second call: Claude responds with final answer
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Done!',
        },
      ],
      stop_reason: 'end_turn',
    });

    const tools: ToolDefinition[] = [
      {
        name: 'get_data',
        description: 'Get some data',
        input_schema: {
          type: 'object',
          properties: { key: { type: 'string' } },
        },
      },
    ];

    const toolHandler = vi.fn().mockResolvedValue({ data: 'test-value' });

    const result = await client.runAgentLoop({
      systemPrompt: 'You are a test agent',
      initialMessage: 'Get the data',
      tools,
      toolHandler,
    });

    expect(toolHandler).toHaveBeenCalledWith('get_data', { key: 'test' });
    expect(result.finalText).toBe('Done!');
    expect(result.toolCalls).toBe(1);
  });
});
