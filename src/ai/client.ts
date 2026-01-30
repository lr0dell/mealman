import Anthropic from '@anthropic-ai/sdk';

export interface ChatOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

export class AIClient {
  private client: Anthropic;
  private model = 'claude-sonnet-4-5';

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
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonStr) as T;
  }
}