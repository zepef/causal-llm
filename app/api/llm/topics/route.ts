// DEMOCRITUS - Topic Expansion API Route
// Module 1: BFS expansion of topics via LLM

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createJsonMessage, DEFAULT_MODEL } from '@/lib/llm/anthropic';
import {
  topicExpansionPrompt,
  TOPIC_EXPANSION_SYSTEM,
  type TopicExpansionResponse,
} from '@/lib/llm/prompts/topic-expansion';

// Request validation schema
const requestSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  depth: z.number().int().min(0).max(10).default(0),
  maxDepth: z.number().int().min(1).max(10).default(5),
  context: z.string().optional(),
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, depth, maxDepth, context } = requestSchema.parse(body);

    // Don't expand if at max depth
    if (depth >= maxDepth) {
      return NextResponse.json({
        subtopics: [],
        message: 'Maximum depth reached',
      });
    }

    // Generate the prompt
    const prompt = topicExpansionPrompt(topic, depth, maxDepth, context);

    // Call Claude API
    const response = await createJsonMessage<TopicExpansionResponse>(prompt, {
      model: DEFAULT_MODEL,
      systemPrompt: TOPIC_EXPANSION_SYSTEM,
      temperature: 0.7,
    });

    // Add IDs and depth to subtopics
    const subtopicsWithMetadata = response.subtopics.map((subtopic, index) => ({
      id: `topic-${Date.now()}-${index}`,
      ...subtopic,
      depth: depth + 1,
      parentTopic: topic,
    }));

    return NextResponse.json({
      subtopics: subtopicsWithMetadata,
      parentTopic: topic,
      depth: depth,
    });
  } catch (error) {
    console.error('Topic expansion error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to expand topic', details: String(error) },
      { status: 500 }
    );
  }
}
