import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient } from './client';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      constructor(_opts: { apiKey: string }) {}

      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'hello' }],
        }),
      };
    },
  };
});

describe('AIClient', () => {
  let client: AIClient;

  beforeEach(() => {
    client = new AIClient('test-api-key');
  });

  it('initializes with API key', () => {
    expect(client).toBeDefined();
  });

  it('sends messages to Claude', async () => {
    const response = await client.chat('Hello');
    expect(response).toBeDefined();
  });
});