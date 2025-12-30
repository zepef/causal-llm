'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore } from '@/stores/embeddingStore';
import type { CausalNode } from '@/types/graph';

// Simple deterministic hash for fallback positions
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function deterministicPosition(id: string, seed: number): number {
  const h = hashCode(id + seed.toString());
  return ((h % 1000) / 1000 - 0.5) * 100;
}

// Dynamically import ForceGraph3D to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-gray-500">Loading 3D visualization...</div>
    </div>
  ),
}) as React.ComponentType<Record<string, unknown>>;

// Domain color palette
const DOMAIN_COLORS: Record<string, string> = {
  archaeology: '#f59e0b', // amber
  biology: '#22c55e',     // green
  climate: '#3b82f6',     // blue
  economics: '#8b5cf6',   // purple
  medicine: '#ef4444',    // red
  physics: '#06b6d4',     // cyan
  psychology: '#ec4899',  // pink
  sociology: '#f97316',   // orange
  default: '#6b7280',     // gray
};

// Relation type colors for edges
const RELATION_COLORS: Record<string, string> = {
  causes: '#ef4444',
  enables: '#22c55e',
  prevents: '#f97316',
  increases: '#3b82f6',
  decreases: '#8b5cf6',
  correlates_with: '#6b7280',
  requires: '#14b8a6',
  produces: '#eab308',
  inhibits: '#ec4899',
  default: '#4b5563',
};

// Community color palette (distinct, vibrant colors)
const COMMUNITY_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#eab308', // yellow
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#84cc16', // lime
];

interface GraphNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  z?: number;
  color: string;
  domain?: string;
  size: number;
  __threeObj?: object;
}

interface GraphLink {
  source: string;
  target: string;
  relationType: string;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface UMAPVisualizationProps {
  width?: number;
  height?: number;
  backgroundColor?: string;
  onNodeClick?: (node: CausalNode) => void;
  onNodeHover?: (node: CausalNode | null) => void;
}

export function UMAPVisualization({
  width,
  height = 600,
  backgroundColor = '#111827',
  onNodeClick,
  onNodeHover,
}: UMAPVisualizationProps) {
  const graphRef = useRef<{ cameraPosition: (position: object, lookAt: object, duration: number) => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Get graph data
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const highlightedNodes = useGraphStore((state) => state.highlightedNodes);
  const selectNode = useGraphStore((state) => state.selectNode);
  const highlightNeighbors = useGraphStore((state) => state.highlightNeighbors);
  const analytics = useGraphStore((state) => state.analytics);
  const filteredNodeIds = useGraphStore((state) => state.filteredNodeIds);
  const filteredEdgeIds = useGraphStore((state) => state.filteredEdgeIds);

  // Get embedding data
  const umap3dProjections = useEmbeddingStore((state) => state.umap3dProjections);
  const showConnections = useEmbeddingStore((state) => state.showConnections);
  const connectionOpacity = useEmbeddingStore((state) => state.connectionOpacity);
  const hoverEmbedding = useEmbeddingStore((state) => state.hoverEmbedding);
  const sizeBy = useEmbeddingStore((state) => state.sizeBy);
  const colorBy = useEmbeddingStore((state) => state.colorBy);

  // Build community lookup map
  const communityMap = useMemo(() => {
    const map = new Map<string, number>();
    if (analytics?.communities) {
      analytics.communities.forEach((community, index) => {
        for (const nodeId of community.nodes) {
          map.set(nodeId, index);
        }
      });
    }
    return map;
  }, [analytics?.communities]);

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: width || containerRef.current.clientWidth,
          height: height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Compute node size based on sizeBy setting
  const getNodeSize = useCallback((nodeId: string, isSelected: boolean): number => {
    const baseSize = 4;
    const maxExtra = 8; // Max additional size for centrality

    if (isSelected) {
      return baseSize * 2;
    }

    switch (sizeBy) {
      case 'uniform':
        return baseSize;

      case 'degree': {
        const degree = graph.getDegree(nodeId);
        return baseSize + Math.min(degree * 0.5, 6);
      }

      case 'pagerank': {
        if (!analytics?.pageRank) {
          // Fallback to degree if analytics not computed
          const degree = graph.getDegree(nodeId);
          return baseSize + Math.min(degree * 0.5, 6);
        }
        const score = analytics.pageRank.get(nodeId) || 0;
        // PageRank is already normalized, scale to visual size
        return baseSize + score * maxExtra * 10;
      }

      case 'betweenness': {
        if (!analytics?.betweenness) {
          const degree = graph.getDegree(nodeId);
          return baseSize + Math.min(degree * 0.5, 6);
        }
        const score = analytics.betweenness.get(nodeId) || 0;
        // Betweenness is normalized 0-1, scale to visual size
        return baseSize + score * maxExtra;
      }

      case 'closeness': {
        if (!analytics?.closeness) {
          const degree = graph.getDegree(nodeId);
          return baseSize + Math.min(degree * 0.5, 6);
        }
        const score = analytics.closeness.get(nodeId) || 0;
        // Closeness is normalized 0-1, scale to visual size
        return baseSize + score * maxExtra;
      }

      default:
        return baseSize;
    }
  }, [sizeBy, analytics, graph]);

  // Transform store data to graph format
  const graphData: GraphData = useMemo(() => {
    const allNodes = graph.getAllNodes();
    const allEdges = graph.getAllEdges();

    // Apply node filters
    const nodes = filteredNodeIds
      ? allNodes.filter(node => filteredNodeIds.has(node.id))
      : allNodes;

    // Apply edge filters
    const edges = filteredEdgeIds
      ? allEdges.filter(edge => filteredEdgeIds.has(edge.id))
      : allEdges;

    const graphNodes: GraphNode[] = nodes.map((node) => {
      const projection = umap3dProjections.get(node.id);
      const isHighlighted = highlightedNodes.has(node.id);
      const isSelected = selectedNodeId === node.id;

      // Determine color based on colorBy setting
      let color: string;
      if (isSelected) {
        color = '#ffffff';
      } else if (isHighlighted) {
        color = '#fbbf24'; // amber highlight
      } else {
        switch (colorBy) {
          case 'community': {
            const communityIdx = communityMap.get(node.id);
            color = communityIdx !== undefined
              ? COMMUNITY_COLORS[communityIdx % COMMUNITY_COLORS.length]
              : DOMAIN_COLORS.default;
            break;
          }
          case 'centrality': {
            // Color by PageRank centrality (gradient from blue to red)
            const score = analytics?.pageRank?.get(node.id) || 0;
            const normalized = Math.min(score * 20, 1); // Scale up for visibility
            const r = Math.round(normalized * 255);
            const b = Math.round((1 - normalized) * 255);
            color = `rgb(${r}, 100, ${b})`;
            break;
          }
          case 'none':
            color = '#6b7280'; // gray
            break;
          case 'domain':
          default:
            color = DOMAIN_COLORS[node.domain || 'default'] || DOMAIN_COLORS.default;
        }
      }

      // Determine size based on sizeBy setting
      const size = getNodeSize(node.id, isSelected);

      return {
        id: node.id,
        label: node.label,
        x: projection?.[0] ?? deterministicPosition(node.id, 1),
        y: projection?.[1] ?? deterministicPosition(node.id, 2),
        z: projection?.[2] ?? deterministicPosition(node.id, 3),
        color,
        domain: node.domain,
        size,
      };
    });

    const graphLinks: GraphLink[] = showConnections
      ? edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          relationType: edge.relationType,
          color: RELATION_COLORS[edge.relationType] || RELATION_COLORS.default,
        }))
      : [];

    return { nodes: graphNodes, links: graphLinks };
  }, [graph, umap3dProjections, selectedNodeId, highlightedNodes, showConnections, getNodeSize, colorBy, communityMap, analytics, filteredNodeIds, filteredEdgeIds]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode | null) => {
      if (!node?.id) return;
      selectNode(node.id);
      highlightNeighbors(node.id);

      // Get the actual node data
      const causalNode = graph.getNode(node.id);
      if (causalNode && onNodeClick) {
        onNodeClick(causalNode);
      }

      // Focus camera on node
      if (graphRef.current && node.x !== undefined && node.y !== undefined) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z || 1);

        graphRef.current.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: (node.z || 0) * distRatio,
          },
          { x: node.x, y: node.y, z: node.z },
          1000
        );
      }
    },
    [selectNode, highlightNeighbors, graph, onNodeClick]
  );

  // Handle node hover
  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      hoverEmbedding(node?.id || null);

      if (node?.id) {
        const causalNode = graph.getNode(node.id);
        if (causalNode && onNodeHover) {
          onNodeHover(causalNode);
        }
      } else if (onNodeHover) {
        onNodeHover(null);
      }
    },
    [hoverEmbedding, graph, onNodeHover]
  );

  // Custom node label
  const nodeLabel = useCallback((node: GraphNode) => {
    return `<div style="background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px;">
      <strong>${node.label || node.id}</strong>
      ${node.domain ? `<br/><span style="color: ${DOMAIN_COLORS[node.domain] || '#888'}">${node.domain}</span>` : ''}
    </div>`;
  }, []);

  // Link label
  const linkLabel = useCallback((link: GraphLink) => {
    return `<div style="background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 4px; color: white; font-size: 10px;">
      ${link.relationType || 'related'}
    </div>`;
  }, []);

  if (graphData.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden flex items-center justify-center bg-gray-900"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <div className="text-5xl mb-4">🌐</div>
          <p>No data to visualize</p>
          <p className="text-sm mt-2">Extract triples first to see the causal graph</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden relative"
      style={{ height }}
    >
      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={nodeLabel}
        nodeColor="color"
        nodeVal="size"
        nodeOpacity={0.9}
        linkLabel={linkLabel}
        linkColor="color"
        linkOpacity={connectionOpacity}
        linkWidth={1}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.1}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        backgroundColor={backgroundColor}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        warmupTicks={50}
        cooldownTicks={100}
      />

      {/* Stats overlay */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-2 rounded-lg">
        <div>{graphData.nodes.length} nodes{filteredNodeIds && ` (filtered)`}</div>
        <div>{graphData.links.length} edges{filteredEdgeIds && ` (filtered)`}</div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-gray-400 text-xs px-3 py-2 rounded-lg">
        <div>Drag to rotate • Scroll to zoom</div>
        <div>Click node to focus</div>
      </div>
    </div>
  );
}
