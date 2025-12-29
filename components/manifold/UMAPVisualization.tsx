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

  // Get embedding data
  const umap3dProjections = useEmbeddingStore((state) => state.umap3dProjections);
  const showConnections = useEmbeddingStore((state) => state.showConnections);
  const connectionOpacity = useEmbeddingStore((state) => state.connectionOpacity);
  const hoverEmbedding = useEmbeddingStore((state) => state.hoverEmbedding);

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

  // Transform store data to graph format
  const graphData: GraphData = useMemo(() => {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    const graphNodes: GraphNode[] = nodes.map((node) => {
      const projection = umap3dProjections.get(node.id);
      const isHighlighted = highlightedNodes.has(node.id);
      const isSelected = selectedNodeId === node.id;

      // Determine color based on colorBy setting
      let color = DOMAIN_COLORS[node.domain || 'default'] || DOMAIN_COLORS.default;
      if (isSelected) {
        color = '#ffffff';
      } else if (isHighlighted) {
        color = '#fbbf24'; // amber highlight
      }

      // Determine size based on degree
      const degree = graph.getDegree(node.id);
      const baseSize = 4;
      const size = isSelected ? baseSize * 2 : baseSize + Math.min(degree * 0.5, 6);

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
  }, [graph, umap3dProjections, selectedNodeId, highlightedNodes, showConnections]);

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
        <div>{graphData.nodes.length} nodes</div>
        <div>{graphData.links.length} edges</div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-gray-400 text-xs px-3 py-2 rounded-lg">
        <div>Drag to rotate • Scroll to zoom</div>
        <div>Click node to focus</div>
      </div>
    </div>
  );
}
