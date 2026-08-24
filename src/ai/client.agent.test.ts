import { describe, it, expect, vi, afterEach } from 'vitest';
import { AIClient } from './client.js';
import type { ToolDefinition } from '../agent/types.js';
import type { PlanningModelConfig } from './model-config.js';

// A fixed, explicit config so these tests never resolve from the real
// process.env — a developer with MEAL_MODEL/MEAL_THINKING/MEAL_EFFORT
// exported for a validation run should still get a green suite.
const TEST_MODEL_CONFIG: PlanningModelConfig = {
  model: 'claude-sonnet-5',
  thinking: 'disabled',
  effort: 'medium',
};

describe('AIClient.runAgentLoop', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeClient(): {
    client: AIClient;
    mockCreate: ReturnType<typeof vi.fn>;
  } {
    const client = new AIClient('test-key');
    const mockCreate = vi.fn();
    (
      client as unknown as {
        client: { messages: { create: typeof mockCreate } };
      }
    ).client = { messages: { create: mockCreate } };
    return { client, mockCreate };
  }

  function toolUseResponse(id: string): {
    content: Array<{
      type: string;
      id: string;
      name: string;
      input: Record<string, string>;
    }>;
    stop_reason: string;
  } {
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
      modelConfig: TEST_MODEL_CONFIG,
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
      modelConfig: TEST_MODEL_CONFIG,
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
      modelConfig: TEST_MODEL_CONFIG,
    });

    // 2nd API call: initial + 1 pair = 3 messages — all within window of 10
    const secondCallMessages = mockCreate.mock.calls[1][0].messages as Array<{
      role: string;
    }>;
    expect(secondCallMessages).toHaveLength(3);
  });

  it('sends the resolved model, thinking mode, and effort', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'go',
      tools,
      toolHandler: vi.fn().mockResolvedValue({}),
      modelConfig: TEST_MODEL_CONFIG,
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.output_config).toEqual({ effort: 'medium' });
    expect(request.max_tokens).toBe(4096);
  });

  it('resolves the shipped defaults from process.env when no modelConfig is passed', async () => {
    // Controls the env explicitly so this test can't leak a developer's
    // real MEAL_MODEL/MEAL_THINKING/MEAL_EFFORT into a false failure, while
    // still exercising the real default-resolution path (no modelConfig).
    vi.stubEnv('MEAL_MODEL', undefined);
    vi.stubEnv('MEAL_THINKING', undefined);
    vi.stubEnv('MEAL_EFFORT', undefined);

    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'go',
      tools,
      toolHandler: vi.fn().mockResolvedValue({}),
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.output_config).toEqual({ effort: 'medium' });
    expect(request.max_tokens).toBe(4096);
  });

  it('never sends sampling parameters, which 400 on Sonnet 5', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'go',
      tools,
      toolHandler: vi.fn().mockResolvedValue({}),
      modelConfig: TEST_MODEL_CONFIG,
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    expect(request).not.toHaveProperty('top_k');
  });

  it('caches the week-stable system block and the per-day planning message', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'day one',
      tools,
      toolHandler: () => Promise.resolve({}),
      modelConfig: TEST_MODEL_CONFIG,
    });

    const request = mockCreate.mock.calls[0][0];

    expect(request.system).toEqual([
      { type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } },
    ]);
    expect(request.messages[0].content[0]).toEqual({
      type: 'text',
      text: 'day one',
      cache_control: { type: 'ephemeral' },
    });
  });

  it('does not mark later turns, so only two breakpoints are ever sent', async () => {
    const { client, mockCreate } = makeClient();
    mockCreate.mockResolvedValueOnce(toolUseResponse('t1'));
    mockCreate.mockResolvedValueOnce(endResponse);

    await client.runAgentLoop({
      systemPrompt: 'sys',
      initialMessage: 'day one',
      tools,
      toolHandler: () => Promise.resolve({ ok: true }),
      modelConfig: TEST_MODEL_CONFIG,
    });

    const request = mockCreate.mock.calls[1][0];
    const marked = JSON.stringify(request).match(/cache_control/g) ?? [];
    expect(marked).toHaveLength(2);
  });
});
