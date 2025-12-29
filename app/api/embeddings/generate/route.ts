// DEMOCRITUS - LLM-based Embedding Generation API
// Generate semantic embeddings for concepts using Claude

import { NextRequest, NextResponse } from 'next/server';
import { createJsonMessage, FAST_MODEL } from '@/lib/llm/anthropic';

interface ConceptInput {
  id: string;
  label: string;
  domain?: string;
  relations?: Array<{
    type: string;
    target: string;
  }>;
}

interface EmbeddingOutput {
  conceptId: string;
  label: string;
  domain: string;
  vector: number[];
  semanticFeatures: string[];
}

interface GenerateRequest {
  concepts: ConceptInput[];
  embeddingDim?: number;
}

interface GenerateResponse {
  embeddings: EmbeddingOutput[];
}

// System prompt for embedding generation
const SYSTEM_PROMPT = `You are a semantic embedding generator for causal concept graphs.

For each concept, analyze its semantic meaning, causal role, and domain context to generate:
1. A numerical feature vector (normalized values between -1 and 1)
2. Key semantic features that capture the concept's essence

The embedding dimensions capture:
- Temporal aspects (past/present/future orientation)
- Causal role (cause, effect, mediator, moderator)
- Abstraction level (concrete to abstract)
- Domain specificity (general to domain-specific)
- Valence (positive/negative impact)
- Scope (local to global effect)
- Certainty (well-established to speculative)
- Complexity (simple to complex)

Always respond with valid JSON.`;

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { concepts, embeddingDim = 128 } = body;

    if (!concepts || concepts.length === 0) {
      return NextResponse.json(
        { error: 'No concepts provided' },
        { status: 400 }
      );
    }

    // Get API key from header or environment
    const apiKey = request.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Process concepts in batches to avoid token limits
    const BATCH_SIZE = 10;
    const embeddings: EmbeddingOutput[] = [];

    for (let i = 0; i < concepts.length; i += BATCH_SIZE) {
      const batch = concepts.slice(i, i + BATCH_SIZE);

      const prompt = generatePrompt(batch, embeddingDim);

      try {
        const result = await createJsonMessage<{
          embeddings: Array<{
            conceptId: string;
            label: string;
            domain: string;
            vector: number[];
            semanticFeatures: string[];
          }>;
        }>(prompt, {
          model: FAST_MODEL,
          maxTokens: 4096,
          systemPrompt: SYSTEM_PROMPT,
          temperature: 0.3,
          apiKey,
        });

        // Normalize and pad vectors to match expected dimension
        for (const emb of result.embeddings) {
          const normalizedVector = normalizeVector(emb.vector, embeddingDim);
          embeddings.push({
            ...emb,
            vector: normalizedVector,
          });
        }
      } catch (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
        // Generate fallback embeddings for failed batch
        for (const concept of batch) {
          embeddings.push(generateFallbackEmbedding(concept, embeddingDim));
        }
      }
    }

    return NextResponse.json({ embeddings } satisfies GenerateResponse);
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}

function generatePrompt(concepts: ConceptInput[], embeddingDim: number): string {
  const conceptDescriptions = concepts.map((c) => {
    let desc = `- "${c.label}" (ID: ${c.id})`;
    if (c.domain) desc += ` [Domain: ${c.domain}]`;
    if (c.relations && c.relations.length > 0) {
      desc += `\n  Relations: ${c.relations.map((r) => `${r.type} → ${r.target}`).join(', ')}`;
    }
    return desc;
  }).join('\n');

  return `Generate semantic embeddings for these causal concepts:

${conceptDescriptions}

For each concept, provide:
1. A ${Math.min(embeddingDim, 32)}-dimensional vector (values between -1 and 1)
2. 3-5 semantic features that characterize the concept

The vector dimensions should capture semantic and causal properties.

Respond with JSON:
\`\`\`json
{
  "embeddings": [
    {
      "conceptId": "id",
      "label": "concept label",
      "domain": "inferred or provided domain",
      "vector": [0.1, -0.2, 0.5, ...],
      "semanticFeatures": ["feature1", "feature2", ...]
    }
  ]
}
\`\`\``;
}

function normalizeVector(vector: number[], targetDim: number): number[] {
  // Pad or truncate to target dimension
  const result = new Array(targetDim).fill(0);

  // Copy existing values
  for (let i = 0; i < Math.min(vector.length, targetDim); i++) {
    result[i] = vector[i];
  }

  // If we need more dimensions, extrapolate using a deterministic hash-like function
  if (vector.length < targetDim) {
    for (let i = vector.length; i < targetDim; i++) {
      // Combine existing values to generate new dimensions
      const idx1 = i % vector.length;
      const idx2 = (i + 1) % vector.length;
      const combined = Math.sin(vector[idx1] * 3.14159 + i) * Math.cos(vector[idx2] * 2.71828 + i);
      result[i] = Math.max(-1, Math.min(1, combined));
    }
  }

  // Normalize to unit length
  const magnitude = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= magnitude;
    }
  }

  return result;
}

function generateFallbackEmbedding(concept: ConceptInput, embeddingDim: number): EmbeddingOutput {
  // Generate a deterministic embedding based on the concept label
  const hash = simpleHash(concept.label + (concept.domain || ''));
  const vector: number[] = [];

  for (let i = 0; i < embeddingDim; i++) {
    // Use hash to seed a pseudo-random but deterministic value
    const seed = hash + i * 17;
    const value = Math.sin(seed * 0.1) * Math.cos(seed * 0.07);
    vector.push(value);
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= magnitude;
  }

  return {
    conceptId: concept.id,
    label: concept.label,
    domain: concept.domain || 'default',
    vector,
    semanticFeatures: ['auto-generated'],
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
