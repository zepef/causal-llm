// DEMOCRITUS - Statement Generation API Route
// Module 3: Generate isolated causal claims

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createJsonMessage, DEFAULT_MODEL } from '@/lib/llm/anthropic';
import {
  statementGenerationPrompt,
  STATEMENT_GENERATION_SYSTEM,
  type StatementGenerationResponse,
} from '@/lib/llm/prompts/statement-generation';

// Request validation schema
const requestSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  context: z.string().optional(),
  questionId: z.string().optional(),
  projectId: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, questionId, apiKey } = requestSchema.parse(body);

    // Generate the prompt
    const prompt = statementGenerationPrompt(question, context);

    // Call Claude API with optional API key
    const response = await createJsonMessage<StatementGenerationResponse>(prompt, {
      model: DEFAULT_MODEL,
      systemPrompt: STATEMENT_GENERATION_SYSTEM,
      temperature: 0.7,
      apiKey,
    });

    // Add IDs to statements
    const statementsWithMetadata = response.statements.map((statement, index) => ({
      id: `statement-${Date.now()}-${index}`,
      ...statement,
      questionId,
      question,
    }));

    return NextResponse.json({
      statements: statementsWithMetadata,
      question,
      count: statementsWithMetadata.length,
    });
  } catch (error) {
    console.error('Statement generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate statements', details: String(error) },
      { status: 500 }
    );
  }
}
