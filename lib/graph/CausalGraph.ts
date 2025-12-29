// DEMOCRITUS - Core CausalGraph class
// Implements the graph data structure with adjacency lists and simplicial complex support

import type {
  CausalNode,
  CausalEdge,
  RelationType,
  SimplicialComplex,
  GraphStats,
  GraphAnalytics,
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

  // ============ Causal Queries ============

  /**
   * Find direct causes of a node (nodes with edges pointing TO this node)
   */
  findCauses(nodeId: string): CausalNode[] {
    const causeIds = this.getInNeighbors(nodeId);
    return causeIds.map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find direct effects of a node (nodes this node points TO)
   */
  findEffects(nodeId: string): CausalNode[] {
    const effectIds = this.getOutNeighbors(nodeId);
    return effectIds.map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find all ancestors (all upstream nodes via BFS)
   */
  findAllAncestors(nodeId: string): CausalNode[] {
    const visited = new Set<string>();
    const queue = [...this.getInNeighbors(nodeId)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const ancestor of this.getInNeighbors(current)) {
        if (!visited.has(ancestor)) {
          queue.push(ancestor);
        }
      }
    }

    return Array.from(visited).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find all descendants (all downstream nodes via BFS)
   */
  findAllDescendants(nodeId: string): CausalNode[] {
    const visited = new Set<string>();
    const queue = [...this.getOutNeighbors(nodeId)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const descendant of this.getOutNeighbors(current)) {
        if (!visited.has(descendant)) {
          queue.push(descendant);
        }
      }
    }

    return Array.from(visited).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find shortest path between two nodes (BFS)
   */
  findShortestPath(fromId: string, toId: string): string[] | null {
    if (fromId === toId) return [fromId];
    if (!this.hasNode(fromId) || !this.hasNode(toId)) return null;

    const visited = new Set<string>([fromId]);
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      for (const neighbor of this.getOutNeighbors(nodeId)) {
        if (neighbor === toId) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ nodeId: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find all causal paths between two nodes (DFS with max depth)
   */
  findCausalPaths(fromId: string, toId: string, maxDepth: number = 10): string[][] {
    if (!this.hasNode(fromId) || !this.hasNode(toId)) return [];
    if (fromId === toId) return [[fromId]];

    const paths: string[][] = [];

    const dfs = (current: string, path: string[], visited: Set<string>) => {
      if (path.length > maxDepth) return;

      if (current === toId) {
        paths.push([...path]);
        return;
      }

      for (const neighbor of this.getOutNeighbors(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          path.push(neighbor);
          dfs(neighbor, path, visited);
          path.pop();
          visited.delete(neighbor);
        }
      }
    };

    const visited = new Set<string>([fromId]);
    dfs(fromId, [fromId], visited);

    return paths;
  }

  /**
   * Find root causes - ancestors with no incoming edges
   */
  findRootCauses(nodeId: string): CausalNode[] {
    const ancestors = this.findAllAncestors(nodeId);
    return ancestors.filter(node => this.getInDegree(node.id) === 0);
  }

  /**
   * Find ultimate effects - descendants with no outgoing edges
   */
  findUltimateEffects(nodeId: string): CausalNode[] {
    const descendants = this.findAllDescendants(nodeId);
    return descendants.filter(node => this.getOutDegree(node.id) === 0);
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

  // ============ Graph Analytics ============

  /**
   * Calculate PageRank scores for all nodes
   * @param damping - Damping factor (default 0.85)
   * @param iterations - Number of iterations (default 20)
   */
  calculatePageRank(damping: number = 0.85, iterations: number = 20): Map<string, number> {
    const nodes = this.getAllNodes();
    const n = nodes.length;
    if (n === 0) return new Map();

    // Initialize PageRank scores
    const pr = new Map<string, number>();
    const initialScore = 1 / n;
    for (const node of nodes) {
      pr.set(node.id, initialScore);
    }

    // Iteratively update scores
    for (let i = 0; i < iterations; i++) {
      const newPr = new Map<string, number>();

      for (const node of nodes) {
        let incomingScore = 0;

        // Sum contributions from incoming edges
        for (const sourceId of this.getInNeighbors(node.id)) {
          const sourceOutDegree = this.getOutDegree(sourceId);
          if (sourceOutDegree > 0) {
            incomingScore += (pr.get(sourceId) || 0) / sourceOutDegree;
          }
        }

        // Apply damping factor
        newPr.set(node.id, (1 - damping) / n + damping * incomingScore);
      }

      // Update scores
      for (const [id, score] of newPr) {
        pr.set(id, score);
      }
    }

    return pr;
  }

  /**
   * Calculate betweenness centrality for all nodes
   * Measures how often a node appears on shortest paths between other nodes
   */
  calculateBetweennessCentrality(): Map<string, number> {
    const nodes = this.getAllNodes();
    const centrality = new Map<string, number>();

    // Initialize to 0
    for (const node of nodes) {
      centrality.set(node.id, 0);
    }

    // For each pair of nodes, find shortest paths and count intermediaries
    for (const source of nodes) {
      // BFS to find all shortest paths from source
      const dist = new Map<string, number>();
      const paths = new Map<string, number>(); // Number of shortest paths to each node
      const pred = new Map<string, string[]>(); // Predecessors on shortest paths

      dist.set(source.id, 0);
      paths.set(source.id, 1);

      const queue: string[] = [source.id];
      const stack: string[] = [];

      while (queue.length > 0) {
        const v = queue.shift()!;
        stack.push(v);

        for (const w of this.getOutNeighbors(v)) {
          // First time seeing w
          if (!dist.has(w)) {
            dist.set(w, dist.get(v)! + 1);
            queue.push(w);
          }

          // Shortest path to w via v
          if (dist.get(w) === dist.get(v)! + 1) {
            paths.set(w, (paths.get(w) || 0) + (paths.get(v) || 0));
            if (!pred.has(w)) pred.set(w, []);
            pred.get(w)!.push(v);
          }
        }
      }

      // Accumulate dependencies
      const delta = new Map<string, number>();
      for (const node of nodes) {
        delta.set(node.id, 0);
      }

      while (stack.length > 0) {
        const w = stack.pop()!;
        for (const v of pred.get(w) || []) {
          const contribution = (paths.get(v) || 0) / (paths.get(w) || 1) * (1 + (delta.get(w) || 0));
          delta.set(v, (delta.get(v) || 0) + contribution);
        }
        if (w !== source.id) {
          centrality.set(w, (centrality.get(w) || 0) + (delta.get(w) || 0));
        }
      }
    }

    // Normalize (for directed graph)
    const n = nodes.length;
    if (n > 2) {
      const factor = 1 / ((n - 1) * (n - 2));
      for (const [id, value] of centrality) {
        centrality.set(id, value * factor);
      }
    }

    return centrality;
  }

  /**
   * Calculate closeness centrality for all nodes
   * Measures how close a node is to all other reachable nodes
   */
  calculateClosenessCentrality(): Map<string, number> {
    const nodes = this.getAllNodes();
    const centrality = new Map<string, number>();

    for (const source of nodes) {
      // BFS to find distances to all reachable nodes
      const dist = new Map<string, number>();
      dist.set(source.id, 0);

      const queue: string[] = [source.id];

      while (queue.length > 0) {
        const v = queue.shift()!;
        for (const w of this.getOutNeighbors(v)) {
          if (!dist.has(w)) {
            dist.set(w, dist.get(v)! + 1);
            queue.push(w);
          }
        }
      }

      // Calculate closeness (sum of distances to reachable nodes)
      const reachable = dist.size - 1; // Exclude self
      if (reachable > 0) {
        let totalDist = 0;
        for (const [id, d] of dist) {
          if (id !== source.id) {
            totalDist += d;
          }
        }
        // Normalized closeness: (reachable / (n-1)) * (reachable / totalDist)
        const n = nodes.length;
        centrality.set(source.id, reachable > 0 ? (reachable / (n - 1)) * (reachable / totalDist) : 0);
      } else {
        centrality.set(source.id, 0);
      }
    }

    return centrality;
  }

  /**
   * Find connected components (treating graph as undirected)
   */
  findConnectedComponents(): CausalNode[][] {
    const visited = new Set<string>();
    const components: CausalNode[][] = [];

    for (const node of this.getAllNodes()) {
      if (visited.has(node.id)) continue;

      const component: CausalNode[] = [];
      const queue = [node.id];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const currentNode = this.nodes.get(current);
        if (currentNode) component.push(currentNode);

        // Add all neighbors (both directions)
        for (const neighbor of this.getAllNeighbors(current)) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  findStronglyConnectedComponents(): CausalNode[][] {
    const nodes = this.getAllNodes();
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: CausalNode[][] = [];
    let currentIndex = 0;

    const strongconnect = (nodeId: string) => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      onStack.add(nodeId);

      for (const neighbor of this.getOutNeighbors(nodeId)) {
        if (!index.has(neighbor)) {
          strongconnect(neighbor);
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, lowlink.get(neighbor)!));
        } else if (onStack.has(neighbor)) {
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, index.get(neighbor)!));
        }
      }

      // If nodeId is a root node, pop the stack and generate an SCC
      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const scc: CausalNode[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          const node = this.nodes.get(w);
          if (node) scc.push(node);
        } while (w !== nodeId);
        sccs.push(scc);
      }
    };

    for (const node of nodes) {
      if (!index.has(node.id)) {
        strongconnect(node.id);
      }
    }

    return sccs;
  }

  /**
   * Get comprehensive analytics for the graph
   */
  getAnalytics(): GraphAnalytics {
    return {
      pageRank: this.calculatePageRank(),
      betweenness: this.calculateBetweennessCentrality(),
      closeness: this.calculateClosenessCentrality(),
      connectedComponents: this.findConnectedComponents().map(c => c.map(n => n.id)),
      stronglyConnectedComponents: this.findStronglyConnectedComponents().map(c => c.map(n => n.id)),
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
