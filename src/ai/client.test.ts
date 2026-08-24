import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient } from './client.js';

const mockCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'hello' }],
});

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      constructor(_opts: { apiKey: string }) {}

      messages = {
        create: mockCreate,
      };
    },
  };
});

describe('AIClient', () => {
  let client: AIClient;

  beforeEach(() => {
    mockCreate.mockClear();
    client = new AIClient('test-api-key');
  });

  it('sends thinking disabled explicitly, since an omitted thinking param enables adaptive thinking on Sonnet 5', async () => {
    await client.chat('Hello');

    const request = mockCreate.mock.calls[0][0];
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect(request.model).toBe('claude-sonnet-5');
  });
});
