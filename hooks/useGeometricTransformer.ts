// DEMOCRITUS - Hook for Geometric Transformer computation
// Provides state management and API calls for embedding refinement

import { useState, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore } from '@/stores/embeddingStore';

interface TransformerConfig {
  embeddingDim?: number;
  hiddenDim?: number;
  numHeads?: number;
  numLayers?: number;
  useLayerNorm?: boolean;
}

interface ComplexStats {
  numVertices: number;
  numEdges: number;
  numTriangles: number;
  avgDegree: number;
  avgClustering: number;
  density: number;
}

interface UseGeometricTransformerResult {
  isProcessing: boolean;
  progress: number;
  message: string;
  complexStats: ComplexStats | null;
  error: string | null;
  processEmbeddings: (config?: TransformerConfig) => Promise<void>;
  reset: () => void;
}

export function useGeometricTransformer(): UseGeometricTransformerResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [complexStats, setComplexStats] = useState<ComplexStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get graph and embedding data
  const graph = useGraphStore((state) => state.graph);
  const embeddings = useEmbeddingStore((state) => state.embeddings);
  const setEmbeddings = useEmbeddingStore((state) => state.setEmbeddings);

  const processEmbeddings = useCallback(
    async (config?: TransformerConfig) => {
      setIsProcessing(true);
      setProgress(0);
      setMessage('Preparing data...');
      setError(null);

      try {
        // Get nodes and edges from graph
        const nodes = graph.getAllNodes();
        const edges = graph.getAllEdges();

        if (nodes.length < 2) {
          throw new Error('Need at least 2 nodes for embedding refinement');
        }

        // Convert embeddings Map to object
        const embeddingsObj: Record<string, number[]> = {};
        for (const [conceptId, data] of embeddings) {
          embeddingsObj[conceptId] = data.vector;
        }

        // Check we have embeddings for nodes
        const missingEmbeddings = nodes.filter(
          (n) => !embeddingsObj[n.id]
        );

        if (missingEmbeddings.length > 0) {
          throw new Error(
            `Missing embeddings for ${missingEmbeddings.length} nodes. Generate embeddings first.`
          );
        }

        setProgress(10);
        setMessage('Sending to Geometric Transformer...');

        // Call API
        const response = await fetch('/api/embeddings/compute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodes,
            edges,
            embeddings: embeddingsObj,
            config,
          }),
        });

        setProgress(50);
        setMessage('Processing simplicial complex...');

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }

        setProgress(80);
        setMessage('Updating embeddings...');

        // Update embeddings with refined versions
        const refinedEmbeddings = result.refinedEmbeddings;
        const currentEmbeddings = Array.from(embeddings.values());

        const updatedEmbeddings = currentEmbeddings.map((emb) => ({
          ...emb,
          vector: refinedEmbeddings[emb.conceptId] || emb.vector,
        }));

        setEmbeddings(updatedEmbeddings);
        setComplexStats(result.complexStats);

        setProgress(100);
        setMessage('Complete!');
      } catch (err) {
        setError((err as Error).message);
        setMessage('Failed');
      } finally {
        setIsProcessing(false);
      }
    },
    [graph, embeddings, setEmbeddings]
  );

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
    setMessage('');
    setError(null);
    setComplexStats(null);
  }, []);

  return {
    isProcessing,
    progress,
    message,
    complexStats,
    error,
    processEmbeddings,
    reset,
  };
}
