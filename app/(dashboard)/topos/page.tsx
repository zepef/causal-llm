'use client';

import { useState, useMemo } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { CausalNode, CausalEdge } from '@/types/graph';

interface DomainSlice {
  id: string;
  domain: string;
  nodes: CausalNode[];
  internalEdges: CausalEdge[];
  externalEdges: CausalEdge[]; // Edges connecting to other domains
  color: string;
}

interface CrossDomainConnection {
  sourceDomain: string;
  targetDomain: string;
  edges: CausalEdge[];
  strength: number; // Number of connections
}

interface DomainAnalogy {
  domain1: string;
  domain2: string;
  similarPatterns: Array<{
    pattern: string;
    description: string;
    nodes1: string[];
    nodes2: string[];
  }>;
  similarity: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  climate: '#3b82f6',
  medicine: '#ef4444',
  economics: '#8b5cf6',
  biology: '#22c55e',
  psychology: '#ec4899',
  sociology: '#f97316',
  physics: '#06b6d4',
  archaeology: '#f59e0b',
  default: '#6b7280',
};

const DOMAIN_LABELS: Record<string, string> = {
  climate: 'Climate Science',
  medicine: 'Medicine & Health',
  economics: 'Economics',
  biology: 'Biology',
  psychology: 'Psychology',
  sociology: 'Sociology',
  physics: 'Physics',
  archaeology: 'Archaeology',
  default: 'General',
};

export default function ToposPage() {
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  const [showCrossDomain, setShowCrossDomain] = useState(true);

  // Graph store
  const graph = useGraphStore((state) => state.graph);

  // Pipeline store for stats
  const pipelineTriples = usePipelineStore((state) => state.triples);

  // Compute domain slices from graph
  const domainSlices = useMemo((): DomainSlice[] => {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    if (nodes.length === 0) return [];

    // Group nodes by domain
    const domainMap = new Map<string, CausalNode[]>();
    for (const node of nodes) {
      const domain = node.domain || 'default';
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push(node);
    }

    // Create slices with internal and external edges
    const slices: DomainSlice[] = [];
    for (const [domain, domainNodes] of domainMap) {
      const nodeIds = new Set(domainNodes.map(n => n.id));

      const internalEdges = edges.filter(
        e => nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      const externalEdges = edges.filter(
        e => (nodeIds.has(e.source) && !nodeIds.has(e.target)) ||
             (!nodeIds.has(e.source) && nodeIds.has(e.target))
      );

      slices.push({
        id: domain,
        domain,
        nodes: domainNodes,
        internalEdges,
        externalEdges,
        color: DOMAIN_COLORS[domain] || DOMAIN_COLORS.default,
      });
    }

    // Sort by node count
    return slices.sort((a, b) => b.nodes.length - a.nodes.length);
  }, [graph]);

  // Compute cross-domain connections
  const crossDomainConnections = useMemo((): CrossDomainConnection[] => {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    if (nodes.length === 0) return [];

    // Create node -> domain map
    const nodeDomainMap = new Map<string, string>();
    for (const node of nodes) {
      nodeDomainMap.set(node.id, node.domain || 'default');
    }

    // Find cross-domain edges
    const connectionMap = new Map<string, CausalEdge[]>();
    for (const edge of edges) {
      const sourceDomain = nodeDomainMap.get(edge.source);
      const targetDomain = nodeDomainMap.get(edge.target);

      if (sourceDomain && targetDomain && sourceDomain !== targetDomain) {
        const key = [sourceDomain, targetDomain].sort().join('↔');
        if (!connectionMap.has(key)) {
          connectionMap.set(key, []);
        }
        connectionMap.get(key)!.push(edge);
      }
    }

    // Convert to array
    const connections: CrossDomainConnection[] = [];
    for (const [key, edges] of connectionMap) {
      const [domain1, domain2] = key.split('↔');
      connections.push({
        sourceDomain: domain1,
        targetDomain: domain2,
        edges,
        strength: edges.length,
      });
    }

    return connections.sort((a, b) => b.strength - a.strength);
  }, [graph]);

  // Detect structural analogies between domains
  const domainAnalogies = useMemo((): DomainAnalogy[] => {
    if (domainSlices.length < 2) return [];

    const analogies: DomainAnalogy[] = [];

    // Compare each pair of domains
    for (let i = 0; i < domainSlices.length; i++) {
      for (let j = i + 1; j < domainSlices.length; j++) {
        const slice1 = domainSlices[i];
        const slice2 = domainSlices[j];

        // Find similar relation type patterns
        const relTypes1 = countRelationTypes(slice1.internalEdges);
        const relTypes2 = countRelationTypes(slice2.internalEdges);

        const similarPatterns: DomainAnalogy['similarPatterns'] = [];

        // Check for shared causal patterns
        for (const [relType, count1] of Object.entries(relTypes1)) {
          const count2 = relTypes2[relType] || 0;
          if (count1 > 0 && count2 > 0) {
            similarPatterns.push({
              pattern: relType,
              description: `Both domains use "${relType}" relationships`,
              nodes1: slice1.internalEdges
                .filter(e => e.relationType === relType)
                .slice(0, 3)
                .map(e => e.source),
              nodes2: slice2.internalEdges
                .filter(e => e.relationType === relType)
                .slice(0, 3)
                .map(e => e.source),
            });
          }
        }

        if (similarPatterns.length > 0) {
          // Calculate similarity score based on structural overlap
          const similarity = calculateStructuralSimilarity(slice1, slice2);

          analogies.push({
            domain1: slice1.domain,
            domain2: slice2.domain,
            similarPatterns,
            similarity,
          });
        }
      }
    }

    return analogies.sort((a, b) => b.similarity - a.similarity);
  }, [domainSlices]);

  // Get selected slice details
  const selectedSliceData = useMemo(() => {
    if (!selectedSlice) return null;
    return domainSlices.find(s => s.id === selectedSlice) || null;
  }, [selectedSlice, domainSlices]);

  const nodeCount = graph.getNodeCount();
  const edgeCount = graph.getEdgeCount();

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Topos Analysis</h2>
        <p className="text-gray-400 text-sm">
          Organize concepts into domain slices and discover cross-domain analogies.
        </p>
      </div>

      {nodeCount === 0 ? (
        /* No Data State */
        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
          <div className="text-5xl mb-4">🔮</div>
          <h3 className="text-lg font-medium mb-2">No Graph Data</h3>
          <p className="text-gray-400 text-sm mb-4">
            Load data in the Manifold page first to analyze domain slices.
          </p>
          <div className="text-sm text-gray-500">
            Pipeline: {pipelineTriples.length} triples available
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Domain Slices */}
          <div className="lg:col-span-1 space-y-4">
            {/* Stats */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium mb-3">Graph Overview</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800 rounded p-2 text-center">
                  <div className="text-xl font-bold text-white">{nodeCount}</div>
                  <div className="text-xs text-gray-500">Concepts</div>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <div className="text-xl font-bold text-white">{edgeCount}</div>
                  <div className="text-xs text-gray-500">Relations</div>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <div className="text-xl font-bold text-white">{domainSlices.length}</div>
                  <div className="text-xs text-gray-500">Domains</div>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <div className="text-xl font-bold text-white">{crossDomainConnections.length}</div>
                  <div className="text-xs text-gray-500">Cross-Links</div>
                </div>
              </div>
            </div>

            {/* Domain Slices */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium mb-3">Domain Slices</h3>
              <div className="space-y-2">
                {domainSlices.map(slice => (
                  <div
                    key={slice.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedSlice === slice.id
                        ? 'bg-blue-900/30 border border-blue-700'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedSlice(selectedSlice === slice.id ? null : slice.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-medium text-white">
                        {DOMAIN_LABELS[slice.domain] || slice.domain}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>{slice.nodes.length} concepts</span>
                      <span>{slice.internalEdges.length} internal</span>
                      <span>{slice.externalEdges.length} external</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Toggle */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCrossDomain}
                  onChange={(e) => setShowCrossDomain(e.target.checked)}
                  className="rounded bg-gray-700 border-gray-600"
                />
                <span className="text-sm">Show Cross-Domain Connections</span>
              </label>
            </div>
          </div>

          {/* Right Column - Details & Analogies */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selected Slice Details */}
            {selectedSliceData ? (
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedSliceData.color }}
                  />
                  <h3 className="font-semibold text-lg">
                    {DOMAIN_LABELS[selectedSliceData.domain] || selectedSliceData.domain}
                  </h3>
                </div>

                {/* Concepts in this domain */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Concepts ({selectedSliceData.nodes.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSliceData.nodes.slice(0, 20).map(node => (
                      <span
                        key={node.id}
                        className="px-2 py-1 bg-gray-800 text-white rounded text-sm"
                      >
                        {node.label}
                      </span>
                    ))}
                    {selectedSliceData.nodes.length > 20 && (
                      <span className="px-2 py-1 text-gray-500 text-sm">
                        +{selectedSliceData.nodes.length - 20} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Internal relations */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Internal Relations ({selectedSliceData.internalEdges.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedSliceData.internalEdges.slice(0, 10).map(edge => (
                      <div key={edge.id} className="flex items-center gap-2 text-sm">
                        <span className="text-white truncate max-w-[120px]">{edge.source}</span>
                        <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                          {edge.relationType}
                        </span>
                        <span className="text-white truncate max-w-[120px]">{edge.target}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External connections */}
                {selectedSliceData.externalEdges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">
                      Cross-Domain Connections ({selectedSliceData.externalEdges.length})
                    </h4>
                    <div className="text-sm text-gray-400">
                      Connected to {
                        new Set(selectedSliceData.externalEdges.flatMap(e => {
                          const sourceNode = graph.getNode(e.source);
                          const targetNode = graph.getNode(e.target);
                          return [sourceNode?.domain, targetNode?.domain].filter(d => d && d !== selectedSliceData.domain);
                        })).size
                      } other domains
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
                <p className="text-gray-500">Select a domain slice to see details</p>
              </div>
            )}

            {/* Cross-Domain Connections */}
            {showCrossDomain && crossDomainConnections.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h3 className="font-medium mb-3">Cross-Domain Connections</h3>
                <div className="space-y-2">
                  {crossDomainConnections.map((conn, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: DOMAIN_COLORS[conn.sourceDomain] || DOMAIN_COLORS.default }}
                        />
                        <span className="text-white">
                          {DOMAIN_LABELS[conn.sourceDomain] || conn.sourceDomain}
                        </span>
                        <span className="text-gray-500">↔</span>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: DOMAIN_COLORS[conn.targetDomain] || DOMAIN_COLORS.default }}
                        />
                        <span className="text-white">
                          {DOMAIN_LABELS[conn.targetDomain] || conn.targetDomain}
                        </span>
                      </div>
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-sm">
                        {conn.strength} links
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Domain Analogies */}
            {domainAnalogies.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 border border-purple-800">
                <h3 className="font-medium mb-3 text-purple-400">Structural Analogies</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Domains with similar causal structures
                </p>
                <div className="space-y-3">
                  {domainAnalogies.slice(0, 5).map((analogy, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: DOMAIN_COLORS[analogy.domain1] || DOMAIN_COLORS.default }}
                          />
                          <span className="text-white text-sm">
                            {DOMAIN_LABELS[analogy.domain1] || analogy.domain1}
                          </span>
                          <span className="text-purple-400">≈</span>
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: DOMAIN_COLORS[analogy.domain2] || DOMAIN_COLORS.default }}
                          />
                          <span className="text-white text-sm">
                            {DOMAIN_LABELS[analogy.domain2] || analogy.domain2}
                          </span>
                        </div>
                        <span className="text-sm text-purple-400">
                          {(analogy.similarity * 100).toFixed(0)}% similar
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analogy.similarPatterns.slice(0, 3).map((pattern, j) => (
                          <span
                            key={j}
                            className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded text-xs"
                          >
                            {pattern.pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <h4 className="text-sm font-medium text-gray-300 mb-2">How it works</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Load graph data in the Manifold page (from pipeline or demo data)</li>
          <li>Concepts are automatically grouped into domain slices based on keywords</li>
          <li>Click a domain slice to see its concepts and internal relations</li>
          <li>Cross-domain connections show how different domains link together</li>
          <li>Structural analogies identify domains with similar causal patterns</li>
        </ol>
      </div>
    </div>
  );
}

// Helper: Count relation types in edges
function countRelationTypes(edges: CausalEdge[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const edge of edges) {
    counts[edge.relationType] = (counts[edge.relationType] || 0) + 1;
  }
  return counts;
}

// Helper: Calculate structural similarity between two slices
function calculateStructuralSimilarity(slice1: DomainSlice, slice2: DomainSlice): number {
  const relTypes1 = countRelationTypes(slice1.internalEdges);
  const relTypes2 = countRelationTypes(slice2.internalEdges);

  const allTypes = new Set([...Object.keys(relTypes1), ...Object.keys(relTypes2)]);
  if (allTypes.size === 0) return 0;

  let sharedCount = 0;
  for (const type of allTypes) {
    if (relTypes1[type] && relTypes2[type]) {
      sharedCount++;
    }
  }

  // Normalize by total unique relation types
  const similarity = sharedCount / allTypes.size;

  // Boost similarity if both have similar edge density
  const density1 = slice1.internalEdges.length / Math.max(slice1.nodes.length, 1);
  const density2 = slice2.internalEdges.length / Math.max(slice2.nodes.length, 1);
  const densityRatio = Math.min(density1, density2) / Math.max(density1, density2, 0.01);

  return (similarity + densityRatio) / 2;
}
