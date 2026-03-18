import { describe, it, expect, vi } from 'vitest';
import { AIClient } from './client.js';
import type { ToolDefinition } from '../agent/types.js';

// We'll test the loop logic by mocking the Anthropic client
describe('AIClient.runAgentLoop', () => {
  function makeClient() {
    const client = new AIClient('test-key');
    const mockCreate = vi.fn();
    (
      client as unknown as {
        client: { messages: { create: typeof mockCreate } };
      }
    ).client = { messages: { create: mockCreate } };
    return { client, mockCreate };
  }

  function toolUseResponse(id: string) {
    return {
      content: [
        { type: 'tool_use', id, name: 'get_data', input: { key: 'test' } },
      ],
      stop_reason: 'tool_use',
    };
  }

  const endResponse = {
    content: [{ type: 'text', text: 'Done!' }],
    stop_reason: 'end_turn',
  };

  const tools: ToolDefinition[] = [
    {
      name: 'get_data',
      description: 'Get some data',
      input_schema: { type: 'object', properties: { key: { type: 'string' } } },
    },
  ];

  it('executes tool calls and returns final result', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(toolUseResponse('tool_1'));
    mockCreate.mockResolvedValueOnce(endResponse);

    const result = await client.runAgentLoop({
      systemPrompt: 'You are a test agent',
      initialMessage: 'Get the data',
      tools,
      toolHandler: vi.fn().mockResolvedValue({ data: 'test-value' }),
    });

    expect(result.finalText).toBe('Done!');
    expect(result.toolCalls).toBe(1);
  });

  it('sends only the last contextWindow pairs when history exceeds the limit', async () => {
    const { client, mockCreate } = makeClient();

    // 3 tool-use iterations then a final answer (4 API calls total)
    mockCreate.mockResolvedValueOnce(toolUseResponse('t1'));
    mockCreate.mockResolvedValueOnce(toolUseResponse('t2'));
    mockCreate.mockResolvedValueOnce(toolUseResponse('t3'));
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'start',
      tools,
      toolHandler: vi.fn().mockResolvedValue({}),
      contextWindow: 2,
    });

    // 4th API call should have: initial message + 2 pairs (= 5 messages), not 7
    const fourthCallMessages = mockCreate.mock.calls[3][0].messages as Array<{
      role: string;
    }>;
    expect(fourthCallMessages).toHaveLength(5);
    expect(fourthCallMessages[0].role).toBe('user'); // initial message preserved
    expect(fourthCallMessages[1].role).toBe('assistant'); // pair 2 assistant
    expect(fourthCallMessages[2].role).toBe('user'); // pair 2 tool results
    expect(fourthCallMessages[3].role).toBe('assistant'); // pair 3 assistant
    expect(fourthCallMessages[4].role).toBe('user'); // pair 3 tool results
  });

  it('does not prune when history is within the contextWindow', async () => {
    const { client, mockCreate } = makeClient();

    mockCreate.mockResolvedValueOnce(toolUseResponse('t1'));
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'start',
      tools,
      toolHandler: vi.fn().mockResolvedValue({}),
      contextWindow: 10,
    });

    // 2nd API call: initial + 1 pair = 3 messages — all within window of 10
    const secondCallMessages = mockCreate.mock.calls[1][0].messages as Array<{
      role: string;
    }>;
    expect(secondCallMessages).toHaveLength(3);
  });
});
