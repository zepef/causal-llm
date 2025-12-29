// DEMOCRITUS - Anthropic Claude API client
// Configured for causal knowledge extraction

import Anthropic from '@anthropic-ai/sdk';

// Create an Anthropic client with optional API key
// Falls back to ANTHROPIC_API_KEY environment variable if not provided
export function createAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });
}

// Default client using environment variable
const anthropic = createAnthropicClient();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 50,
  requestQueue: [] as number[],
};

/**
 * Check and enforce rate limiting
 */
async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old requests from queue
  RATE_LIMIT.requestQueue = RATE_LIMIT.requestQueue.filter(
    (timestamp) => timestamp > oneMinuteAgo
  );

  // If at limit, wait
  if (RATE_LIMIT.requestQueue.length >= RATE_LIMIT.maxRequestsPerMinute) {
    const oldestRequest = RATE_LIMIT.requestQueue[0];
    const waitTime = oldestRequest + 60000 - now;
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // Add current request to queue
  RATE_LIMIT.requestQueue.push(now);
}

/**
 * Default model configuration
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
export const FAST_MODEL = 'claude-haiku-4-20250514';

/**
 * Create a message with Claude
 */
export async function createMessage(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
    apiKey?: string;
  } = {}
): Promise<string> {
  await checkRateLimit();

  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    systemPrompt,
    temperature = 0.7,
    apiKey,
  } = options;

  // Use provided API key or default client
  const client = apiKey ? createAnthropicClient(apiKey) : anthropic;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response');
  }

  return textContent.text;
}

/**
 * Create a streaming message with Claude
 */
export async function* createStreamingMessage(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  await checkRateLimit();

  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    systemPrompt,
    temperature = 0.7,
  } = options;

  const stream = await anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Parse JSON from Claude's response, handling markdown code blocks
 */
export function parseJsonResponse<T>(response: string): T {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

/**
 * Create a message and parse JSON response
 */
export async function createJsonMessage<T>(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
    apiKey?: string;
  } = {}
): Promise<T> {
  const response = await createMessage(prompt, options);
  return parseJsonResponse<T>(response);
}

// Export the client for direct use if needed
export { anthropic };
