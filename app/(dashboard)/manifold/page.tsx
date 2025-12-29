'use client';

import { useState, useCallback } from 'react';
import { UMAPVisualization } from '@/components/manifold/UMAPVisualization';
import { VisualizationControls } from '@/components/manifold/VisualizationControls';
import { NodeDetails } from '@/components/manifold/NodeDetails';
import { DomainLegend } from '@/components/manifold/DomainLegend';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore, useComputationStatus } from '@/stores/embeddingStore';
import { useGeometricTransformer } from '@/hooks/useGeometricTransformer';
import {
  computeUMAPWithProgress,
  normalizeProjection,
  projectionsToMap,
  generateRandomEmbeddings,
} from '@/lib/embeddings/umap';
import type { CausalNode } from '@/types/graph';
import { generateEdgeId } from '@/lib/graph/CausalGraph';

export default function ManifoldPage() {
  const [hoveredNode, setHoveredNode] = useState<CausalNode | null>(null);

  // Graph store
  const graph = useGraphStore((state) => state.graph);
  const loadGraph = useGraphStore((state) => state.loadGraph);

  // Embedding store
  const config = useEmbeddingStore((state) => state.config);
  const setEmbeddings = useEmbeddingStore((state) => state.setEmbeddings);
  const setUMAP3D = useEmbeddingStore((state) => state.setUMAP3D);
  const setComputing = useEmbeddingStore((state) => state.setComputing);
  const setProgress = useEmbeddingStore((state) => state.setProgress);
  const { isComputing, progress, message } = useComputationStatus();

  // Geometric Transformer
  const {
    isProcessing: isTransformerProcessing,
    progress: transformerProgress,
    message: transformerMessage,
    complexStats,
    error: transformerError,
    processEmbeddings,
  } = useGeometricTransformer();

  // Compute UMAP projections
  const handleComputeUMAP = useCallback(async () => {
    const embeddings = Array.from(useEmbeddingStore.getState().embeddings.values());

    if (embeddings.length < 2) {
      alert('Need at least 2 embeddings to compute UMAP');
      return;
    }

    setComputing(true, 'Starting UMAP computation...');

    try {
      const vectors = embeddings.map((e) => e.vector);
      const ids = embeddings.map((e) => e.conceptId);

      const projection = await computeUMAPWithProgress(
        vectors,
        { ...config, nComponents: 3 },
        (prog, msg) => {
          setProgress(prog);
          setComputing(true, msg);
        }
      );

      const normalized = normalizeProjection(projection, { min: -50, max: 50 });
      const projectionMap = projectionsToMap<[number, number, number]>(ids, normalized);

      setUMAP3D(projectionMap);
      setComputing(false);
    } catch (error) {
      console.error('UMAP computation failed:', error);
      setComputing(false);
      alert('Failed to compute UMAP: ' + (error as Error).message);
    }
  }, [config, setComputing, setProgress, setUMAP3D]);

  // Run Geometric Transformer then UMAP
  const handleRefineAndProject = useCallback(async () => {
    await processEmbeddings();
    // After transformer completes, recompute UMAP
    setTimeout(() => {
      handleComputeUMAP();
    }, 100);
  }, [processEmbeddings, handleComputeUMAP]);

  // Generate demo data
  const handleGenerateDemo = useCallback(() => {
    // Generate random embeddings
    const embeddings = generateRandomEmbeddings(50, 128, 5);

    // Create nodes and edges
    const nodes: CausalNode[] = embeddings.map((emb) => ({
      id: emb.conceptId,
      label: emb.label,
      type: 'concept' as const,
      domain: emb.domain,
    }));

    // Create some random edges
    const edges = [];
    const relationTypes = ['causes', 'enables', 'increases', 'decreases', 'correlates_with'];

    for (let i = 0; i < 80; i++) {
      const sourceIdx = Math.floor(Math.random() * nodes.length);
      let targetIdx = Math.floor(Math.random() * nodes.length);

      // Avoid self-loops
      while (targetIdx === sourceIdx) {
        targetIdx = Math.floor(Math.random() * nodes.length);
      }

      const relationType = relationTypes[Math.floor(Math.random() * relationTypes.length)];

      edges.push({
        id: generateEdgeId(nodes[sourceIdx].id, nodes[targetIdx].id, relationType as 'causes'),
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        relationType: relationType as 'causes',
        confidence: Math.random() * 0.5 + 0.5,
      });
    }

    // Load into stores
    loadGraph({ nodes, edges });
    setEmbeddings(embeddings);

    // Compute UMAP
    setTimeout(() => {
      handleComputeUMAP();
    }, 100);
  }, [loadGraph, setEmbeddings, handleComputeUMAP]);

  const nodeCount = graph.getNodeCount();
  const edgeCount = graph.getEdgeCount();

  return (
    <div className="h-full flex gap-4">
      {/* Main Visualization Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Relational Manifold</h2>
            <p className="text-sm text-gray-400">
              3D UMAP visualization of causal concept embeddings
            </p>
          </div>

          <div className="flex items-center gap-3">
            {nodeCount === 0 && (
              <button
                onClick={handleGenerateDemo}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                Generate Demo Data
              </button>
            )}

            {nodeCount > 0 && (
              <>
                <button
                  onClick={handleRefineAndProject}
                  disabled={isComputing || isTransformerProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                  title="Refine embeddings using Geometric Transformer, then project with UMAP"
                >
                  {isTransformerProcessing ? 'Refining...' : 'Refine Embeddings'}
                </button>
                <button
                  onClick={handleComputeUMAP}
                  disabled={isComputing || isTransformerProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {isComputing ? 'Computing...' : 'Recompute UMAP'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bars */}
        {isTransformerProcessing && (
          <div className="bg-gray-800 rounded-lg p-3 border border-green-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-400">Geometric Transformer: {transformerMessage}</span>
              <span className="text-sm text-green-400">{transformerProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${transformerProgress}%` }}
              />
            </div>
          </div>
        )}

        {isComputing && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{message}</span>
              <span className="text-sm text-gray-400">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {transformerError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <span className="text-sm text-red-400">{transformerError}</span>
          </div>
        )}

        {/* 3D Visualization */}
        <div className="flex-1 min-h-[500px]">
          <UMAPVisualization
            height={600}
            onNodeHover={setHoveredNode}
          />
        </div>

        {/* Hover Info */}
        {hoveredNode && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded-lg text-sm">
            <strong>{hoveredNode.label}</strong>
            {hoveredNode.domain && (
              <span className="ml-2 text-gray-400">({hoveredNode.domain})</span>
            )}
          </div>
        )}

        {/* Legend */}
        <DomainLegend />
      </div>

      {/* Right Sidebar */}
      <div className="w-72 flex flex-col gap-4 overflow-y-auto">
        {/* Node Details */}
        <NodeDetails />

        {/* Controls */}
        <VisualizationControls
          onRecomputeUMAP={handleComputeUMAP}
          isComputing={isComputing}
        />

        {/* Stats */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Graph Statistics</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-2xl font-bold text-white">{nodeCount}</div>
              <div className="text-xs text-gray-500">Concepts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{edgeCount}</div>
              <div className="text-xs text-gray-500">Relations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graph.getStats().triangleCount}
              </div>
              <div className="text-xs text-gray-500">Triangles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {graph.getStats().avgDegree.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">Avg Degree</div>
            </div>
          </div>
        </div>

        {/* Complex Stats (after transformer) */}
        {complexStats && (
          <div className="bg-gray-900 rounded-lg p-4 border border-green-800">
            <h4 className="text-sm font-medium text-green-400 mb-3">
              Simplicial Complex
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-lg font-bold text-white">
                  {(complexStats.avgClustering * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Clustering</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {(complexStats.density * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">Density</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
