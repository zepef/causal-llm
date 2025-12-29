// DEMOCRITUS - Core CausalGraph class
// Implements the graph data structure with adjacency lists and simplicial complex support

import type {
  CausalNode,
  CausalEdge,
  RelationType,
  SimplicialComplex,
  GraphStats,
  SerializedGraph,
  CausalGraphData,
} from '@/types/graph';

/**
 * CausalGraph - Main graph data structure for DEMOCRITUS
 *
 * Supports:
 * - Node and edge CRUD operations
 * - Adjacency list for efficient traversal
 * - Triangle detection for simplicial complex
 * - Graph metrics and statistics
 * - Serialization/deserialization
 */
export class CausalGraph {
  private nodes: Map<string, CausalNode>;
  private edges: Map<string, CausalEdge>;
  private adjacencyList: Map<string, Set<string>>;      // outgoing edges: nodeId -> Set<targetNodeIds>
  private reverseAdjacencyList: Map<string, Set<string>>; // incoming edges: nodeId -> Set<sourceNodeIds>
  private edgeIndex: Map<string, Set<string>>;          // nodeId -> Set<edgeIds> (all connected edges)

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.edgeIndex = new Map();
  }

  // ============ Node Operations ============

  addNode(node: CausalNode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodes.set(node.id, { ...node });
    this.adjacencyList.set(node.id, new Set());
    this.reverseAdjacencyList.set(node.id, new Set());
    this.edgeIndex.set(node.id, new Set());
  }

  getNode(id: string): CausalNode | undefined {
    return this.nodes.get(id);
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  updateNode(id: string, updates: Partial<CausalNode>): void {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node with id ${id} not found`);
    }
    this.nodes.set(id, { ...node, ...updates, id }); // Preserve ID
  }

  removeNode(id: string): void {
    if (!this.nodes.has(id)) return;

    // Remove all connected edges
    const connectedEdges = this.edgeIndex.get(id);
    if (connectedEdges) {
      for (const edgeId of connectedEdges) {
        this.removeEdge(edgeId);
      }
    }

    // Clean up adjacency lists
    this.adjacencyList.delete(id);
    this.reverseAdjacencyList.delete(id);
    this.edgeIndex.delete(id);
    this.nodes.delete(id);
  }

  getAllNodes(): CausalNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  // ============ Edge Operations ============

  addEdge(edge: CausalEdge): void {
    if (this.edges.has(edge.id)) {
      throw new Error(`Edge with id ${edge.id} already exists`);
    }
    if (!this.nodes.has(edge.source)) {
      throw new Error(`Source node ${edge.source} not found`);
    }
    if (!this.nodes.has(edge.target)) {
      throw new Error(`Target node ${edge.target} not found`);
    }

    this.edges.set(edge.id, { ...edge });

    // Update adjacency lists
    this.adjacencyList.get(edge.source)?.add(edge.target);
    this.reverseAdjacencyList.get(edge.target)?.add(edge.source);

    // Update edge index
    this.edgeIndex.get(edge.source)?.add(edge.id);
    this.edgeIndex.get(edge.target)?.add(edge.id);
  }

  getEdge(id: string): CausalEdge | undefined {
    return this.edges.get(id);
  }

  hasEdge(id: string): boolean {
    return this.edges.has(id);
  }

  updateEdge(id: string, updates: Partial<CausalEdge>): void {
    const edge = this.edges.get(id);
    if (!edge) {
      throw new Error(`Edge with id ${id} not found`);
    }
    // Don't allow changing source/target
    this.edges.set(id, {
      ...edge,
      ...updates,
      id,
      source: edge.source,
      target: edge.target
    });
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) return;

    // Update adjacency lists
    this.adjacencyList.get(edge.source)?.delete(edge.target);
    this.reverseAdjacencyList.get(edge.target)?.delete(edge.source);

    // Update edge index
    this.edgeIndex.get(edge.source)?.delete(id);
    this.edgeIndex.get(edge.target)?.delete(id);

    this.edges.delete(id);
  }

  getAllEdges(): CausalEdge[] {
    return Array.from(this.edges.values());
  }

  getEdgeCount(): number {
    return this.edges.size;
  }

  // ============ Graph Traversal ============

  /**
   * Get outgoing neighbors of a node
   */
  getOutNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) || []);
  }

  /**
   * Get incoming neighbors of a node
   */
  getInNeighbors(nodeId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) || []);
  }

  /**
   * Get all neighbors (both in and out)
   */
  getAllNeighbors(nodeId: string): string[] {
    const outNeighbors = this.adjacencyList.get(nodeId) || new Set();
    const inNeighbors = this.reverseAdjacencyList.get(nodeId) || new Set();
    return Array.from(new Set([...outNeighbors, ...inNeighbors]));
  }

  /**
   * Get edges between two nodes
   */
  getEdgesBetween(sourceId: string, targetId: string): CausalEdge[] {
    return this.getAllEdges().filter(
      edge => edge.source === sourceId && edge.target === targetId
    );
  }

  /**
   * Get all edges connected to a node
   */
  getConnectedEdges(nodeId: string): CausalEdge[] {
    const edgeIds = this.edgeIndex.get(nodeId) || new Set();
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /**
   * Get out-degree of a node
   */
  getOutDegree(nodeId: string): number {
    return this.adjacencyList.get(nodeId)?.size || 0;
  }

  /**
   * Get in-degree of a node
   */
  getInDegree(nodeId: string): number {
    return this.reverseAdjacencyList.get(nodeId)?.size || 0;
  }

  /**
   * Get total degree of a node
   */
  getDegree(nodeId: string): number {
    return this.getOutDegree(nodeId) + this.getInDegree(nodeId);
  }

  // ============ Triangle Detection (for Geometric Transformer) ============

  /**
   * Find all triangles in the graph
   * A triangle is three nodes A, B, C where edges exist: A->B, B->C, A->C (or any cycle)
   */
  findTriangles(): [string, string, string][] {
    const triangles: [string, string, string][] = [];
    const nodeIds = Array.from(this.nodes.keys());

    // For each node A
    for (const a of nodeIds) {
      const neighborsA = this.getAllNeighbors(a);

      // For each neighbor B of A
      for (const b of neighborsA) {
        if (b <= a) continue; // Avoid duplicates

        const neighborsB = this.getAllNeighbors(b);

        // Find common neighbors (forming triangle)
        for (const c of neighborsB) {
          if (c <= b) continue; // Avoid duplicates

          // Check if A and C are connected
          if (this.areConnected(a, c)) {
            triangles.push([a, b, c]);
          }
        }
      }
    }

    return triangles;
  }

  /**
   * Check if two nodes are connected (in either direction)
   */
  areConnected(nodeA: string, nodeB: string): boolean {
    const outA = this.adjacencyList.get(nodeA);
    const outB = this.adjacencyList.get(nodeB);
    return (outA?.has(nodeB) || outB?.has(nodeA)) ?? false;
  }

  /**
   * Build simplicial complex for Geometric Transformer
   */
  toSimplicialComplex(): SimplicialComplex {
    return {
      vertices: this.getAllNodes(),
      edges: this.getAllEdges(),
      triangles: this.findTriangles(),
    };
  }

  // ============ Graph Metrics ============

  /**
   * Compute graph statistics
   */
  getStats(): GraphStats {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    const triangles = this.findTriangles();

    // Count relation types
    const relationTypeCounts = {} as Record<RelationType, number>;
    for (const edge of edges) {
      relationTypeCounts[edge.relationType] =
        (relationTypeCounts[edge.relationType] || 0) + 1;
    }

    // Get unique domains
    const domains = [...new Set(nodes.map(n => n.domain).filter(Boolean))] as string[];

    // Calculate average degree
    const totalDegree = nodes.reduce((sum, n) => sum + this.getDegree(n.id), 0);
    const avgDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;

    // Calculate density: E / (V * (V-1)) for directed graph
    const maxEdges = nodes.length * (nodes.length - 1);
    const density = maxEdges > 0 ? edges.length / maxEdges : 0;

    // Find hub nodes (top 10 by degree)
    const hubNodes = nodes
      .map(n => ({ id: n.id, label: n.label, degree: this.getDegree(n.id) }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      triangleCount: triangles.length,
      domains,
      relationTypeCounts,
      avgDegree,
      density,
      hubNodes,
    };
  }

  // ============ Domain Operations ============

  /**
   * Get all nodes in a specific domain
   */
  getNodesByDomain(domain: string): CausalNode[] {
    return this.getAllNodes().filter(n => n.domain === domain);
  }

  /**
   * Get subgraph for a specific domain
   */
  getSubgraphByDomain(domain: string): CausalGraph {
    const subgraph = new CausalGraph();
    const domainNodeIds = new Set<string>();

    // Add domain nodes
    for (const node of this.getNodesByDomain(domain)) {
      subgraph.addNode(node);
      domainNodeIds.add(node.id);
    }

    // Add edges within domain
    for (const edge of this.getAllEdges()) {
      if (domainNodeIds.has(edge.source) && domainNodeIds.has(edge.target)) {
        subgraph.addEdge(edge);
      }
    }

    return subgraph;
  }

  // ============ Serialization ============

  /**
   * Serialize graph to JSON-compatible object
   */
  serialize(): SerializedGraph {
    const stats = this.getStats();
    return {
      version: '1.0.0',
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      metadata: {
        createdAt: new Date().toISOString(),
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        domains: stats.domains,
      },
    };
  }

  /**
   * Deserialize from JSON object
   */
  static deserialize(data: SerializedGraph): CausalGraph {
    const graph = new CausalGraph();

    // Add nodes first
    for (const node of data.nodes) {
      graph.addNode(node);
    }

    // Then add edges
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }

    return graph;
  }

  /**
   * Export to simple data format
   */
  toData(): CausalGraphData {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  /**
   * Import from simple data format
   */
  static fromData(data: CausalGraphData): CausalGraph {
    const graph = new CausalGraph();
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }
    return graph;
  }

  // ============ Utility Methods ============

  /**
   * Clear the entire graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.edgeIndex.clear();
  }

  /**
   * Clone the graph
   */
  clone(): CausalGraph {
    return CausalGraph.deserialize(this.serialize());
  }

  /**
   * Merge another graph into this one
   */
  merge(other: CausalGraph): void {
    for (const node of other.getAllNodes()) {
      if (!this.hasNode(node.id)) {
        this.addNode(node);
      }
    }
    for (const edge of other.getAllEdges()) {
      if (!this.hasEdge(edge.id)) {
        try {
          this.addEdge(edge);
        } catch {
          // Skip edges with missing nodes
        }
      }
    }
  }

  /**
   * Get nodes filtered by predicate
   */
  filterNodes(predicate: (node: CausalNode) => boolean): CausalNode[] {
    return this.getAllNodes().filter(predicate);
  }

  /**
   * Get edges filtered by predicate
   */
  filterEdges(predicate: (edge: CausalEdge) => boolean): CausalEdge[] {
    return this.getAllEdges().filter(predicate);
  }

  /**
   * Get edges by relation type
   */
  getEdgesByRelationType(relationType: RelationType): CausalEdge[] {
    return this.filterEdges(e => e.relationType === relationType);
  }
}

/**
 * Create a new CausalGraph instance
 */
export function createCausalGraph(): CausalGraph {
  return new CausalGraph();
}

/**
 * Generate a unique edge ID from source, target, and relation
 */
export function generateEdgeId(
  source: string,
  target: string,
  relationType: RelationType
): string {
  return `${source}--${relationType}-->${target}`;
}

/**
 * Normalize concept name for matching
 */
export function normalizeConceptName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
