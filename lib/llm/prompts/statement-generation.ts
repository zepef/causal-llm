// DEMOCRITUS - Causal Statement Generation Prompt
// Module 3: Generate isolated causal claims

/**
 * System prompt for statement generation
 */
export const STATEMENT_GENERATION_SYSTEM = `You are an expert at articulating precise causal relationships.
Your statements should:
1. Express single, isolated causal relationships
2. Be specific and falsifiable
3. Clearly identify cause and effect
4. Describe the underlying mechanism when possible
5. Indicate confidence based on scientific consensus`;

/**
 * Generate the statement generation prompt
 */
export function statementGenerationPrompt(
  question: string,
  context?: string
): string {
  return `Answer this causal question with specific, isolated causal statements:

Question: "${question}"
${context ? `\nContext: ${context}` : ''}

Generate 3-5 causal statements. Each statement should:
1. Express a single causal relationship
2. Be specific and falsifiable
3. Identify cause and effect clearly
4. Describe the mechanism if known

Format as JSON:
{
  "statements": [
    {
      "text": "Reduced monsoon rainfall decreases Indus river discharge",
      "cause": "Reduced monsoon rainfall",
      "effect": "decreased Indus river discharge",
      "mechanism": "less precipitation leads to lower water volume in rivers",
      "confidence": 0.9
    }
  ]
}

Confidence scale:
- 0.9-1.0: Well-established scientific fact
- 0.7-0.9: Strong evidence, widely accepted
- 0.5-0.7: Moderate evidence, some debate
- 0.3-0.5: Limited evidence, speculative
- 0.0-0.3: Hypothetical, needs verification

Ensure statements are:
- Atomic (one relationship per statement)
- Precise in language
- Grounded in evidence where possible`;
}

/**
 * Type for parsed statement generation response
 */
export interface StatementGenerationResponse {
  statements: Array<{
    text: string;
    cause: string;
    effect: string;
    mechanism: string;
    confidence: number;
  }>;
}
