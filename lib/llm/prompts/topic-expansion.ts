// DEMOCRITUS - Topic Expansion Prompt
// Module 1: BFS expansion of topics via LLM

/**
 * System prompt for topic expansion
 */
export const TOPIC_EXPANSION_SYSTEM = `You are an expert at identifying causally relevant subtopics within complex domains.
Your goal is to decompose topics into specific subtopics that represent distinct causal mechanisms, processes, or factors.
Focus on:
1. Causal mechanisms and processes
2. Key variables and factors
3. Relationships and interactions
4. Temporal and spatial dimensions
5. Multi-scale phenomena`;

/**
 * Generate the topic expansion prompt
 */
export function topicExpansionPrompt(
  topic: string,
  depth: number,
  maxDepth: number = 5,
  context?: string
): string {
  return `Given the topic: "${topic}"
${context ? `\nContext: ${context}` : ''}

List 5-8 specific subtopics that:
1. Are causally relevant to understanding "${topic}"
2. Represent distinct causal mechanisms or processes
3. Can be further decomposed into causal factors
4. Cover different aspects (mechanisms, conditions, effects)

Current depth: ${depth}/${maxDepth}
${depth >= maxDepth - 1 ? 'Note: This is near maximum depth, focus on specific, terminal concepts.' : ''}

Format your response as JSON:
{
  "subtopics": [
    {
      "name": "subtopic name (concise, 2-5 words)",
      "description": "brief description of this subtopic",
      "causalRelevance": "how this relates causally to the parent topic"
    }
  ]
}

Ensure each subtopic is distinct and non-overlapping.`;
}

/**
 * Type for parsed topic expansion response
 */
export interface TopicExpansionResponse {
  subtopics: Array<{
    name: string;
    description: string;
    causalRelevance: string;
  }>;
}

/**
 * Example topics for testing
 */
export const EXAMPLE_TOPICS = [
  'Indus Valley Civilization decline',
  'Climate change impacts',
  'Stress and health outcomes',
  'Inflation dynamics',
  'Pandemic spread',
  'Urban development patterns',
  'Ecosystem collapse',
  'Economic recession causes',
];
