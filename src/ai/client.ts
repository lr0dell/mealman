import Anthropic from '@anthropic-ai/sdk';

export interface ChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
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

  async chatJSON<T>(userMessage: string, options: ChatOptions = {}): Promise<T> {
    const response = await this.chat(userMessage, {
      ...options,
      systemPrompt: `${options.systemPrompt || ''}\n\nRespond with valid JSON only. No markdown code blocks.`.trim(),
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
}