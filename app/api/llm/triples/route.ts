// DEMOCRITUS - Triple Extraction API Route
// Module 4: Extract structured (source, relation, target) triples

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createJsonMessage, DEFAULT_MODEL } from '@/lib/llm/anthropic';
import {
  tripleExtractionPrompt,
  TRIPLE_EXTRACTION_SYSTEM,
  batchTripleExtractionPrompt,
  type TripleExtractionResponse,
  type BatchTripleExtractionResponse,
} from '@/lib/llm/prompts/triple-extraction';
import { normalizeConceptName, generateEdgeId } from '@/lib/graph/CausalGraph';

// Request validation schema for single statement
const singleRequestSchema = z.object({
  statement: z.string().min(1, 'Statement is required'),
  statementId: z.string().optional(),
  projectId: z.string().optional(),
});

// Request validation schema for batch extraction
const batchRequestSchema = z.object({
  statements: z.array(z.string().min(1)).min(1, 'At least one statement is required'),
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if batch or single request
    if (Array.isArray(body.statements)) {
      return handleBatchExtraction(body);
    } else {
      return handleSingleExtraction(body);
    }
  } catch (error) {
    console.error('Triple extraction error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to extract triples', details: String(error) },
      { status: 500 }
    );
  }
}

async function handleSingleExtraction(body: unknown) {
  const { statement, statementId } = singleRequestSchema.parse(body);

  // Generate the prompt
  const prompt = tripleExtractionPrompt(statement);

  // Call Claude API
  const response = await createJsonMessage<TripleExtractionResponse>(prompt, {
    model: DEFAULT_MODEL,
    systemPrompt: TRIPLE_EXTRACTION_SYSTEM,
    temperature: 0.3, // Lower temperature for more consistent extraction
  });

  // Process triples: normalize concept names and generate IDs
  const triplesWithMetadata = response.triples.map((triple) => {
    const normalizedSource = normalizeConceptName(triple.source);
    const normalizedTarget = normalizeConceptName(triple.target);

    return {
      id: generateEdgeId(normalizedSource, normalizedTarget, triple.relation),
      source: triple.source,
      sourceNormalized: normalizedSource,
      target: triple.target,
      targetNormalized: normalizedTarget,
      relation: triple.relation,
      confidence: triple.confidence,
      statementId,
      statement,
    };
  });

  // Extract unique concepts
  const concepts = new Map<string, { name: string; normalized: string }>();
  for (const triple of triplesWithMetadata) {
    if (!concepts.has(triple.sourceNormalized)) {
      concepts.set(triple.sourceNormalized, {
        name: triple.source,
        normalized: triple.sourceNormalized,
      });
    }
    if (!concepts.has(triple.targetNormalized)) {
      concepts.set(triple.targetNormalized, {
        name: triple.target,
        normalized: triple.targetNormalized,
      });
    }
  }

  return NextResponse.json({
    triples: triplesWithMetadata,
    concepts: Array.from(concepts.values()),
    statement,
    count: triplesWithMetadata.length,
  });
}

async function handleBatchExtraction(body: unknown) {
  const { statements } = batchRequestSchema.parse(body);

  // Generate the batch prompt
  const prompt = batchTripleExtractionPrompt(statements);

  // Call Claude API
  const response = await createJsonMessage<BatchTripleExtractionResponse>(prompt, {
    model: DEFAULT_MODEL,
    systemPrompt: TRIPLE_EXTRACTION_SYSTEM,
    temperature: 0.3,
    maxTokens: 8192, // Larger for batch
  });

  // Process all results
  const allTriples: Array<{
    id: string;
    source: string;
    sourceNormalized: string;
    target: string;
    targetNormalized: string;
    relation: string;
    confidence: number;
    statementIndex: number;
    statement: string;
  }> = [];

  const concepts = new Map<string, { name: string; normalized: string }>();

  for (const result of response.results) {
    const statement = statements[result.statementIndex];

    for (const triple of result.triples) {
      const normalizedSource = normalizeConceptName(triple.source);
      const normalizedTarget = normalizeConceptName(triple.target);

      allTriples.push({
        id: generateEdgeId(normalizedSource, normalizedTarget, triple.relation),
        source: triple.source,
        sourceNormalized: normalizedSource,
        target: triple.target,
        targetNormalized: normalizedTarget,
        relation: triple.relation,
        confidence: triple.confidence,
        statementIndex: result.statementIndex,
        statement,
      });

      if (!concepts.has(normalizedSource)) {
        concepts.set(normalizedSource, {
          name: triple.source,
          normalized: normalizedSource,
        });
      }
      if (!concepts.has(normalizedTarget)) {
        concepts.set(normalizedTarget, {
          name: triple.target,
          normalized: normalizedTarget,
        });
      }
    }
  }

  return NextResponse.json({
    triples: allTriples,
    concepts: Array.from(concepts.values()),
    statementCount: statements.length,
    tripleCount: allTriples.length,
  });
}
