// DEMOCRITUS - Graph state management with Zustand
// Central store for causal graph state

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CausalNode, CausalEdge, RelationType, GraphStats, CausalQueryResult, GraphAnalytics } from '@/types/graph';
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
  filteredNodeIds: Set<string> | null;
  filteredEdgeIds: Set<string> | null;

  // View state
  showLabels: boolean;
  showEdgeLabels: boolean;
  is3DMode: boolean;

  // Computed (cached)
  stats: GraphStats | null;

  // Query results
  queryResult: CausalQueryResult | null;

  // Analytics results (cached)
  analytics: GraphAnalytics | null;
  analyticsComputed: boolean;

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
  setFilteredNodeIds: (ids: Set<string> | null) => void;
  setFilteredEdgeIds: (ids: Set<string> | null) => void;

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

  // Causal Queries
  queryCauses: (nodeId: string) => void;
  queryEffects: (nodeId: string) => void;
  queryAncestors: (nodeId: string) => void;
  queryDescendants: (nodeId: string) => void;
  queryRootCauses: (nodeId: string) => void;
  queryUltimateEffects: (nodeId: string) => void;
  queryPath: (fromId: string, toId: string) => void;
  clearQueryResult: () => void;
  highlightQueryResults: () => void;

  // Analytics
  computeAnalytics: () => void;
  clearAnalytics: () => void;
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
    filteredNodeIds: null,
    filteredEdgeIds: null,
    showLabels: true,
    showEdgeLabels: false,
    is3DMode: true,
    stats: null,
    queryResult: null,
    analytics: null,
    analyticsComputed: false,

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

    setFilteredNodeIds: (ids) =>
      set((state) => {
        state.filteredNodeIds = ids;
      }),

    setFilteredEdgeIds: (ids) =>
      set((state) => {
        state.filteredEdgeIds = ids;
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

    // Causal Query Actions
    queryCauses: (nodeId) =>
      set((state) => {
        const results = state.graph.findCauses(nodeId);
        state.queryResult = {
          query: 'causes',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryEffects: (nodeId) =>
      set((state) => {
        const results = state.graph.findEffects(nodeId);
        state.queryResult = {
          query: 'effects',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryAncestors: (nodeId) =>
      set((state) => {
        const results = state.graph.findAllAncestors(nodeId);
        state.queryResult = {
          query: 'ancestors',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryDescendants: (nodeId) =>
      set((state) => {
        const results = state.graph.findAllDescendants(nodeId);
        state.queryResult = {
          query: 'descendants',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryRootCauses: (nodeId) =>
      set((state) => {
        const results = state.graph.findRootCauses(nodeId);
        state.queryResult = {
          query: 'rootCauses',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryUltimateEffects: (nodeId) =>
      set((state) => {
        const results = state.graph.findUltimateEffects(nodeId);
        state.queryResult = {
          query: 'ultimateEffects',
          sourceNodeId: nodeId,
          results,
        };
      }),

    queryPath: (fromId, toId) =>
      set((state) => {
        const paths = state.graph.findCausalPaths(fromId, toId, 10);
        const shortestPath = state.graph.findShortestPath(fromId, toId);

        // Collect all nodes on the paths
        const nodeIds = new Set<string>();
        for (const path of paths) {
          for (const id of path) {
            nodeIds.add(id);
          }
        }

        const results = Array.from(nodeIds)
          .map((id) => state.graph.getNode(id))
          .filter((n): n is CausalNode => n !== undefined);

        state.queryResult = {
          query: 'path',
          sourceNodeId: fromId,
          targetNodeId: toId,
          results,
          paths: shortestPath ? [shortestPath, ...paths.filter(p => p.length > shortestPath.length)] : paths,
        };
      }),

    clearQueryResult: () =>
      set((state) => {
        state.queryResult = null;
      }),

    highlightQueryResults: () =>
      set((state) => {
        if (!state.queryResult) return;

        state.highlightedNodes.clear();
        state.highlightedEdges.clear();

        // Add the source node
        state.highlightedNodes.add(state.queryResult.sourceNodeId);

        // Add target node if it's a path query
        if (state.queryResult.targetNodeId) {
          state.highlightedNodes.add(state.queryResult.targetNodeId);
        }

        // Add all result nodes
        for (const node of state.queryResult.results) {
          state.highlightedNodes.add(node.id);
        }

        // Find and highlight edges between highlighted nodes
        for (const edge of state.graph.getAllEdges()) {
          if (state.highlightedNodes.has(edge.source) && state.highlightedNodes.has(edge.target)) {
            state.highlightedEdges.add(edge.id);
          }
        }
      }),

    // Analytics Actions
    computeAnalytics: () =>
      set((state) => {
        state.analytics = state.graph.getAnalytics();
        state.analyticsComputed = true;
      }),

    clearAnalytics: () =>
      set((state) => {
        state.analytics = null;
        state.analyticsComputed = false;
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

export const useQueryResult = () =>
  useGraphStore((state) => state.queryResult);

export const useGraphAnalytics = () =>
  useGraphStore((state) => state.analytics);
