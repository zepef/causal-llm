// DEMOCRITUS - Causal Question Generation Prompt
// Module 2: Generate targeted causal queries

/**
 * System prompt for question generation
 */
export const QUESTION_GENERATION_SYSTEM = `You are an expert at formulating causal questions that probe the relationships between phenomena.
Your questions should:
1. Focus on cause-and-effect relationships
2. Be specific and answerable
3. Identify key variables
4. Cover different causal patterns (direct, enabling, preventive, etc.)`;

/**
 * Generate the question generation prompt
 */
export function questionGenerationPrompt(
  topic: string,
  context?: string,
  existingQuestions?: string[]
): string {
  const existingQuestionsSection = existingQuestions?.length
    ? `\nExisting questions (avoid duplicates):\n${existingQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  return `Generate 5-10 causal questions about "${topic}".
${context ? `\nContext: ${context}` : ''}
${existingQuestionsSection}

Questions should follow these patterns:
- "What causes X?" (identifying causes)
- "What are the effects of X on Y?" (identifying effects)
- "How does X influence Y?" (mechanism)
- "What conditions enable X?" (enabling conditions)
- "What prevents or inhibits X?" (inhibitory factors)
- "What is the relationship between X and Y?" (correlation vs causation)
- "Under what circumstances does X lead to Y?" (moderating factors)

Format as JSON:
{
  "questions": [
    {
      "text": "What causes...?",
      "type": "cause|effect|mechanism|condition",
      "variables": ["variable1", "variable2"]
    }
  ]
}

Ensure questions are:
- Specific and focused
- Non-redundant
- Covering different causal aspects`;
}

/**
 * Type for parsed question generation response
 */
export interface QuestionGenerationResponse {
  questions: Array<{
    text: string;
    type: 'cause' | 'effect' | 'mechanism' | 'condition';
    variables: string[];
  }>;
}
