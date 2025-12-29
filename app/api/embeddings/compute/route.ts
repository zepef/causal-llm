// DEMOCRITUS - Embedding Computation API
// Computes refined embeddings using the Geometric Transformer

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CausalGraph } from '@/lib/graph/CausalGraph';
import { createGeometricTransformer, DEFAULT_GT_CONFIG } from '@/lib/embeddings/transformer';
import { createComplexBuilder } from '@/lib/embeddings/simplicial';
import type { CausalNode, CausalEdge, SimplicialComplex } from '@/types/graph';

/**
 * Request schema for embedding computation
 */
const ComputeRequestSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['concept', 'event', 'entity', 'variable']).optional(),
      domain: z.string().optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      relationType: z.string(),
      confidence: z.number().optional(),
    })
  ),
  embeddings: z.record(z.string(), z.array(z.number())),
  config: z
    .object({
      embeddingDim: z.number().optional(),
      hiddenDim: z.number().optional(),
      numHeads: z.number().optional(),
      numLayers: z.number().optional(),
      useLayerNorm: z.boolean().optional(),
    })
    .optional(),
});

type _ComputeRequest = z.infer<typeof ComputeRequestSchema>;

/**
 * Response type for embedding computation
 */
interface ComputeResponse {
  success: boolean;
  refinedEmbeddings?: Record<string, number[]>;
  complexStats?: {
    numVertices: number;
    numEdges: number;
    numTriangles: number;
    avgDegree: number;
    avgClustering: number;
    density: number;
  };
  error?: string;
}

/**
 * POST /api/embeddings/compute
 *
 * Computes refined embeddings using the Geometric Transformer.
 * Takes a graph (nodes + edges) and initial node embeddings,
 * processes through the transformer, and returns refined embeddings.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ComputeResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = ComputeRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const { nodes, edges, embeddings, config } = parseResult.data;

    // Validate that we have embeddings for all nodes
    for (const node of nodes) {
      if (!embeddings[node.id]) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing embedding for node: ${node.id}`,
          },
          { status: 400 }
        );
      }
    }

    // Build the causal graph
    const graph = new CausalGraph();

    for (const node of nodes) {
      graph.addNode(node as CausalNode);
    }

    for (const edge of edges) {
      try {
        graph.addEdge(edge as CausalEdge);
      } catch (e) {
        // Skip edges with missing nodes
        console.warn(`Skipping edge ${edge.id}: ${(e as Error).message}`);
      }
    }

    // Check minimum requirements
    if (graph.getNodeCount() < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Need at least 2 nodes for embedding computation',
        },
        { status: 400 }
      );
    }

    // Get simplicial complex stats
    const complexBuilder = createComplexBuilder(graph);
    const complexStats = complexBuilder.getComplexStats();

    // Convert embeddings to Map
    const embeddingMap = new Map<string, number[]>();
    for (const [nodeId, vector] of Object.entries(embeddings)) {
      embeddingMap.set(nodeId, vector);
    }

    // Check embedding dimension consistency
    const embDims = new Set(Array.from(embeddingMap.values()).map((v) => v.length));
    if (embDims.size > 1) {
      return NextResponse.json(
        {
          success: false,
          error: `Inconsistent embedding dimensions: ${[...embDims].join(', ')}`,
        },
        { status: 400 }
      );
    }

    const actualEmbDim = embeddingMap.values().next().value?.length || DEFAULT_GT_CONFIG.embeddingDim;

    // Create and run the Geometric Transformer
    const transformerConfig = {
      ...DEFAULT_GT_CONFIG,
      embeddingDim: actualEmbDim,
      ...config,
    };

    const transformer = createGeometricTransformer(transformerConfig);

    try {
      // Get simplicial complex
      const complex: SimplicialComplex = graph.toSimplicialComplex();

      // Process through transformer
      const refinedEmbeddings = await transformer.processComplex(complex, embeddingMap);

      // Convert back to object
      const resultEmbeddings: Record<string, number[]> = {};
      for (const [nodeId, vector] of refinedEmbeddings) {
        resultEmbeddings[nodeId] = vector;
      }

      return NextResponse.json({
        success: true,
        refinedEmbeddings: resultEmbeddings,
        complexStats,
      });
    } finally {
      // Always dispose transformer to free memory
      transformer.dispose();
    }
  } catch (error) {
    console.error('Embedding computation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: `Computation error: ${(error as Error).message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/embeddings/compute
 *
 * Returns the default configuration for the Geometric Transformer
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    config: DEFAULT_GT_CONFIG,
    description: 'Geometric Transformer for simplicial complex processing',
    endpoints: {
      POST: {
        description: 'Compute refined embeddings',
        body: {
          nodes: 'Array of CausalNode objects',
          edges: 'Array of CausalEdge objects',
          embeddings: 'Record<nodeId, number[]> - initial embeddings',
          config: 'Optional transformer configuration',
        },
        response: {
          refinedEmbeddings: 'Record<nodeId, number[]> - processed embeddings',
          complexStats: 'Simplicial complex statistics',
        },
      },
    },
  });
}
