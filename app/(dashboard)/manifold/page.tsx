'use client';

import { useState, useCallback } from 'react';
import { UMAPVisualization } from '@/components/manifold/UMAPVisualization';
import { VisualizationControls } from '@/components/manifold/VisualizationControls';
import { NodeDetails } from '@/components/manifold/NodeDetails';
import { DomainLegend } from '@/components/manifold/DomainLegend';
import { GraphSearch } from '@/components/ui/GraphSearch';
import { VisualizationFilters } from '@/components/manifold/VisualizationFilters';
import { CausalQueryPanel } from '@/components/graph/CausalQueryPanel';
import { GraphAnalyticsPanel } from '@/components/graph/GraphAnalyticsPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore, useComputationStatus } from '@/stores/embeddingStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useGeometricTransformer } from '@/hooks/useGeometricTransformer';
import {
  computeUMAPWithProgress,
  normalizeProjection,
  projectionsToMap,
  generateRandomEmbeddings,
} from '@/lib/embeddings/umap';
import type { CausalNode, CausalEdge, RelationType } from '@/types/graph';
import { generateEdgeId } from '@/lib/graph/CausalGraph';

type SidebarTab = 'info' | 'queries' | 'analytics';

export default function ManifoldPage() {
  const [hoveredNode, setHoveredNode] = useState<CausalNode | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('info');

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

  // Pipeline store
  const pipelineTriples = usePipelineStore((state) => state.triples);
  const pipelineTopics = usePipelineStore((state) => state.topics);
  const pipelineQuestions = usePipelineStore((state) => state.questions);
  const pipelineStatements = usePipelineStore((state) => state.statements);

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

  // Load graph from pipeline triples
  const handleLoadFromPipeline = useCallback(() => {
    if (pipelineTriples.length === 0) {
      alert('No triples in pipeline. Extract triples first.');
      return;
    }

    // Extract unique concepts from triples
    const conceptsMap = new Map<string, { name: string; relations: number }>();

    for (const triple of pipelineTriples) {
      // Normalize concept names for consistent IDs
      const sourceId = triple.source.toLowerCase().replace(/\s+/g, '_');
      const targetId = triple.target.toLowerCase().replace(/\s+/g, '_');

      if (!conceptsMap.has(sourceId)) {
        conceptsMap.set(sourceId, { name: triple.source, relations: 0 });
      }
      if (!conceptsMap.has(targetId)) {
        conceptsMap.set(targetId, { name: triple.target, relations: 0 });
      }

      // Count relations for each concept
      const sourceData = conceptsMap.get(sourceId)!;
      sourceData.relations++;
      const targetData = conceptsMap.get(targetId)!;
      targetData.relations++;
    }

    // Create nodes from concepts
    const nodes: CausalNode[] = Array.from(conceptsMap.entries()).map(([id, data]) => ({
      id,
      label: data.name,
      type: 'concept' as const,
      domain: inferDomain(data.name),
    }));

    // Create edges from triples
    const edges: CausalEdge[] = pipelineTriples.map((triple, index) => {
      const sourceId = triple.source.toLowerCase().replace(/\s+/g, '_');
      const targetId = triple.target.toLowerCase().replace(/\s+/g, '_');

      return {
        id: generateEdgeId(sourceId, targetId, triple.relation) + `-${index}`,
        source: sourceId,
        target: targetId,
        relationType: triple.relation,
        confidence: triple.confidence || 0.8,
      };
    });

    // Generate embeddings for concepts
    // Use simple random embeddings for now (could be replaced with LLM embeddings later)
    const embeddings = nodes.map((node) => ({
      conceptId: node.id,
      label: node.label,
      domain: node.domain || 'default',
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
    }));

    // Load into stores
    loadGraph({ nodes, edges });
    setEmbeddings(embeddings);

    // Compute UMAP
    setTimeout(() => {
      handleComputeUMAP();
    }, 100);
  }, [pipelineTriples, loadGraph, setEmbeddings, handleComputeUMAP]);

  // Generate demo data (fallback)
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
        id: generateEdgeId(nodes[sourceIdx].id, nodes[targetIdx].id, relationType as RelationType) + `-${i}`,
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        relationType: relationType as RelationType,
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
  const hasPipelineData = pipelineTriples.length > 0;

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
              <>
                {hasPipelineData && (
                  <button
                    onClick={handleLoadFromPipeline}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Load from Pipeline ({pipelineTriples.length} triples)
                  </button>
                )}
                <button
                  onClick={handleGenerateDemo}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Generate Demo Data
                </button>
              </>
            )}

            {nodeCount > 0 && (
              <>
                {hasPipelineData && (
                  <button
                    onClick={handleLoadFromPipeline}
                    disabled={isComputing || isTransformerProcessing}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
                    title="Reload graph from pipeline data"
                  >
                    Reload Pipeline
                  </button>
                )}
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

        {/* Pipeline Status */}
        {nodeCount === 0 && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Pipeline Status</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className={`text-2xl font-bold ${pipelineTopics.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {pipelineTopics.length}
                </div>
                <div className="text-xs text-gray-500">Topics</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${pipelineQuestions.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {pipelineQuestions.length}
                </div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${pipelineStatements.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {pipelineStatements.length}
                </div>
                <div className="text-xs text-gray-500">Statements</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${pipelineTriples.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {pipelineTriples.length}
                </div>
                <div className="text-xs text-gray-500">Triples</div>
              </div>
            </div>
            {!hasPipelineData && (
              <p className="text-sm text-gray-500 mt-3 text-center">
                Run the pipeline (Topics → Questions → Statements → Triples) to generate graph data
              </p>
            )}
          </div>
        )}

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
      <div className="w-80 flex flex-col gap-4 overflow-y-auto">
        {/* Sidebar Tabs */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Info
          </button>
          <button
            onClick={() => setActiveTab('queries')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              activeTab === 'queries'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Queries
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <>
            {/* Graph Search */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Search Graph</h4>
              <GraphSearch compact />
            </div>

            {/* Node Details */}
            <NodeDetails />

            {/* Filters */}
            <VisualizationFilters />

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

            {/* Pipeline Source */}
            {nodeCount > 0 && hasPipelineData && (
              <div className="bg-gray-900 rounded-lg p-4 border border-blue-800">
                <h4 className="text-sm font-medium text-blue-400 mb-3">Data Source</h4>
                <div className="text-sm text-gray-400">
                  <p>Loaded from pipeline:</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• {pipelineTriples.length} triples extracted</li>
                    <li>• {nodeCount} unique concepts</li>
                    <li>• {edgeCount} causal relations</li>
                  </ul>
                </div>
              </div>
            )}

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
          </>
        )}

        {activeTab === 'queries' && (
          <CausalQueryPanel />
        )}

        {activeTab === 'analytics' && (
          <GraphAnalyticsPanel />
        )}
      </div>
    </div>
  );
}

// Helper function to infer domain from concept name
function inferDomain(conceptName: string): string {
  const name = conceptName.toLowerCase();

  // Simple keyword-based domain inference
  if (name.includes('climate') || name.includes('temperature') || name.includes('weather') ||
      name.includes('carbon') || name.includes('emission') || name.includes('warming')) {
    return 'climate';
  }
  if (name.includes('health') || name.includes('disease') || name.includes('medical') ||
      name.includes('patient') || name.includes('treatment') || name.includes('symptom')) {
    return 'medicine';
  }
  if (name.includes('economy') || name.includes('market') || name.includes('price') ||
      name.includes('income') || name.includes('gdp') || name.includes('inflation')) {
    return 'economics';
  }
  if (name.includes('cell') || name.includes('gene') || name.includes('protein') ||
      name.includes('organism') || name.includes('species') || name.includes('evolution')) {
    return 'biology';
  }
  if (name.includes('stress') || name.includes('anxiety') || name.includes('depression') ||
      name.includes('behavior') || name.includes('cognitive') || name.includes('mental')) {
    return 'psychology';
  }
  if (name.includes('society') || name.includes('social') || name.includes('community') ||
      name.includes('population') || name.includes('culture') || name.includes('group')) {
    return 'sociology';
  }
  if (name.includes('energy') || name.includes('force') || name.includes('particle') ||
      name.includes('quantum') || name.includes('wave') || name.includes('matter')) {
    return 'physics';
  }

  return 'default';
}
