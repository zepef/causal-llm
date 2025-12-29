// DEMOCRITUS - Question Generation API Route
// Module 2: Generate targeted causal queries

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createJsonMessage, DEFAULT_MODEL } from '@/lib/llm/anthropic';
import {
  questionGenerationPrompt,
  QUESTION_GENERATION_SYSTEM,
  type QuestionGenerationResponse,
} from '@/lib/llm/prompts/question-generation';

// Request validation schema
const requestSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  context: z.string().optional(),
  existingQuestions: z.array(z.string()).optional(),
  topicId: z.string().optional(),
  projectId: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, context, existingQuestions, topicId, apiKey } = requestSchema.parse(body);

    // Generate the prompt
    const prompt = questionGenerationPrompt(topic, context, existingQuestions);

    // Call Claude API with optional API key
    const response = await createJsonMessage<QuestionGenerationResponse>(prompt, {
      model: DEFAULT_MODEL,
      systemPrompt: QUESTION_GENERATION_SYSTEM,
      temperature: 0.7,
      apiKey,
    });

    // Add IDs to questions
    const questionsWithMetadata = response.questions.map((question, index) => ({
      id: `question-${Date.now()}-${index}`,
      ...question,
      topicId,
      topic,
    }));

    return NextResponse.json({
      questions: questionsWithMetadata,
      topic,
      count: questionsWithMetadata.length,
    });
  } catch (error) {
    console.error('Question generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate questions', details: String(error) },
      { status: 500 }
    );
  }
}
