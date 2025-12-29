// DEMOCRITUS - Graph state management with Zustand
// Central store for causal graph state

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CausalNode, CausalEdge, RelationType, GraphStats } from '@/types/graph';
import { CausalGraph } from '@/lib/graph/CausalGraph';

// Enable Immer MapSet plugin
enableMapSet();

interface GraphState {
  // Core graph instance
  graph: CausalGraph;

  // Selection state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;

  // Filtering
  filterByDomain: string | null;
  filterByRelationType: RelationType | null;
  searchQuery: string;

  // View state
  showLabels: boolean;
  showEdgeLabels: boolean;
  is3DMode: boolean;

  // Computed (cached)
  stats: GraphStats | null;

  // Actions
  addNode: (node: CausalNode) => void;
  addEdge: (edge: CausalEdge) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<CausalNode>) => void;
  updateEdge: (edgeId: string, updates: Partial<CausalEdge>) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  highlightNeighbors: (nodeId: string) => void;
  clearHighlights: () => void;

  // Filtering
  setDomainFilter: (domain: string | null) => void;
  setRelationFilter: (relationType: RelationType | null) => void;
  setSearchQuery: (query: string) => void;

  // View
  toggleLabels: () => void;
  toggleEdgeLabels: () => void;
  toggle3DMode: () => void;

  // Graph operations
  loadGraph: (data: { nodes: CausalNode[]; edges: CausalEdge[] }) => void;
  clearGraph: () => void;
  mergeGraph: (data: { nodes: CausalNode[]; edges: CausalEdge[] }) => void;

  // Utility
  getFilteredNodes: () => CausalNode[];
  getFilteredEdges: () => CausalEdge[];
  refreshStats: () => void;
}

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    // Initial state
    graph: new CausalGraph(),
    selectedNodeId: null,
    selectedEdgeId: null,
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
    filterByDomain: null,
    filterByRelationType: null,
    searchQuery: '',
    showLabels: true,
    showEdgeLabels: false,
    is3DMode: true,
    stats: null,

    // Node operations
    addNode: (node) =>
      set((state) => {
        state.graph.addNode(node);
        state.stats = null; // Invalidate cache
      }),

    addEdge: (edge) =>
      set((state) => {
        state.graph.addEdge(edge);
        state.stats = null;
      }),

    removeNode: (nodeId) =>
      set((state) => {
        state.graph.removeNode(nodeId);
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
        state.highlightedNodes.delete(nodeId);
        state.stats = null;
      }),

    removeEdge: (edgeId) =>
      set((state) => {
        state.graph.removeEdge(edgeId);
        if (state.selectedEdgeId === edgeId) {
          state.selectedEdgeId = null;
        }
        state.highlightedEdges.delete(edgeId);
        state.stats = null;
      }),

    updateNode: (nodeId, updates) =>
      set((state) => {
        state.graph.updateNode(nodeId, updates);
      }),

    updateEdge: (edgeId, updates) =>
      set((state) => {
        state.graph.updateEdge(edgeId, updates);
      }),

    // Selection
    selectNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
        state.selectedEdgeId = null;
      }),

    selectEdge: (edgeId) =>
      set((state) => {
        state.selectedEdgeId = edgeId;
        state.selectedNodeId = null;
      }),

    highlightNeighbors: (nodeId) =>
      set((state) => {
        state.highlightedNodes.clear();
        state.highlightedEdges.clear();

        state.highlightedNodes.add(nodeId);

        // Add all neighbors
        const neighbors = state.graph.getAllNeighbors(nodeId);
        for (const neighbor of neighbors) {
          state.highlightedNodes.add(neighbor);
        }

        // Add connected edges
        const edges = state.graph.getConnectedEdges(nodeId);
        for (const edge of edges) {
          state.highlightedEdges.add(edge.id);
        }
      }),

    clearHighlights: () =>
      set((state) => {
        state.highlightedNodes.clear();
        state.highlightedEdges.clear();
      }),

    // Filtering
    setDomainFilter: (domain) =>
      set((state) => {
        state.filterByDomain = domain;
      }),

    setRelationFilter: (relationType) =>
      set((state) => {
        state.filterByRelationType = relationType;
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
      }),

    // View
    toggleLabels: () =>
      set((state) => {
        state.showLabels = !state.showLabels;
      }),

    toggleEdgeLabels: () =>
      set((state) => {
        state.showEdgeLabels = !state.showEdgeLabels;
      }),

    toggle3DMode: () =>
      set((state) => {
        state.is3DMode = !state.is3DMode;
      }),

    // Graph operations
    loadGraph: (data) =>
      set((state) => {
        state.graph.clear();
        for (const node of data.nodes) {
          state.graph.addNode(node);
        }
        for (const edge of data.edges) {
          state.graph.addEdge(edge);
        }
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.highlightedNodes.clear();
        state.highlightedEdges.clear();
        state.stats = null;
      }),

    clearGraph: () =>
      set((state) => {
        state.graph.clear();
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.highlightedNodes.clear();
        state.highlightedEdges.clear();
        state.stats = null;
      }),

    mergeGraph: (data) =>
      set((state) => {
        for (const node of data.nodes) {
          if (!state.graph.hasNode(node.id)) {
            state.graph.addNode(node);
          }
        }
        for (const edge of data.edges) {
          if (!state.graph.hasEdge(edge.id)) {
            try {
              state.graph.addEdge(edge);
            } catch {
              // Skip edges with missing nodes
            }
          }
        }
        state.stats = null;
      }),

    // Utility functions
    getFilteredNodes: () => {
      const state = get();
      let nodes = state.graph.getAllNodes();

      if (state.filterByDomain) {
        nodes = nodes.filter((n) => n.domain === state.filterByDomain);
      }

      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        nodes = nodes.filter(
          (n) =>
            n.label.toLowerCase().includes(query) ||
            n.description?.toLowerCase().includes(query)
        );
      }

      return nodes;
    },

    getFilteredEdges: () => {
      const state = get();
      let edges = state.graph.getAllEdges();

      if (state.filterByRelationType) {
        edges = edges.filter((e) => e.relationType === state.filterByRelationType);
      }

      // Filter by visible nodes
      const visibleNodeIds = new Set(state.getFilteredNodes().map((n) => n.id));
      edges = edges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      );

      return edges;
    },

    refreshStats: () =>
      set((state) => {
        state.stats = state.graph.getStats();
      }),
  }))
);

// Selector hooks for common patterns
export const useSelectedNode = () =>
  useGraphStore((state) => {
    if (!state.selectedNodeId) return null;
    return state.graph.getNode(state.selectedNodeId);
  });

export const useSelectedEdge = () =>
  useGraphStore((state) => {
    if (!state.selectedEdgeId) return null;
    return state.graph.getEdge(state.selectedEdgeId);
  });

export const useGraphStats = () =>
  useGraphStore((state) => {
    // Compute stats directly from graph to avoid mutation during render
    // Use cached stats if available, otherwise compute on-demand
    return state.stats ?? state.graph.getStats();
  });
