// DEMOCRITUS - Simplicial Complex Builder
// Utilities for constructing and manipulating simplicial complexes from causal graphs

import type { CausalGraph } from '@/lib/graph/CausalGraph';
import type { SimplicialComplex, CausalNode, CausalEdge } from '@/types/graph';

/**
 * Edge with computed features for the Geometric Transformer
 */
export interface EnhancedEdge {
  edge: CausalEdge;
  sourceNode: CausalNode;
  targetNode: CausalNode;
  features: EdgeFeatures;
}

/**
 * Features computed for each edge
 */
export interface EdgeFeatures {
  sourceDegree: number;
  targetDegree: number;
  commonNeighbors: number;
  jaccardCoefficient: number;
  relationTypeEncoding: number[];
}

/**
 * Triangle with computed features
 */
export interface EnhancedTriangle {
  nodes: [CausalNode, CausalNode, CausalNode];
  edges: CausalEdge[];
  features: TriangleFeatures;
}

/**
 * Features computed for each triangle
 */
export interface TriangleFeatures {
  sumDegree: number;
  avgDegree: number;
  transitivityScore: number;
  domainHomogeneity: number;
  edgeTypes: string[];
}

/**
 * Relation type encoding (one-hot style)
 */
const RELATION_TYPE_ENCODING: Record<string, number[]> = {
  causes: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  enables: [0, 1, 0, 0, 0, 0, 0, 0, 0],
  prevents: [0, 0, 1, 0, 0, 0, 0, 0, 0],
  increases: [0, 0, 0, 1, 0, 0, 0, 0, 0],
  decreases: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  correlates_with: [0, 0, 0, 0, 0, 1, 0, 0, 0],
  requires: [0, 0, 0, 0, 0, 0, 1, 0, 0],
  produces: [0, 0, 0, 0, 0, 0, 0, 1, 0],
  inhibits: [0, 0, 0, 0, 0, 0, 0, 0, 1],
};

/**
 * Build an enhanced simplicial complex with computed features
 */
export class SimplicialComplexBuilder {
  private graph: CausalGraph;
  private nodeIndex: Map<string, number>;

  constructor(graph: CausalGraph) {
    this.graph = graph;
    this.nodeIndex = new Map();

    // Build node index for efficient lookup
    const nodes = graph.getAllNodes();
    nodes.forEach((node, idx) => {
      this.nodeIndex.set(node.id, idx);
    });
  }

  /**
   * Get the base simplicial complex
   */
  getComplex(): SimplicialComplex {
    return this.graph.toSimplicialComplex();
  }

  /**
   * Get enhanced edges with computed features
   */
  getEnhancedEdges(): EnhancedEdge[] {
    const edges = this.graph.getAllEdges();
    const enhancedEdges: EnhancedEdge[] = [];

    for (const edge of edges) {
      const sourceNode = this.graph.getNode(edge.source);
      const targetNode = this.graph.getNode(edge.target);

      if (!sourceNode || !targetNode) continue;

      const features = this.computeEdgeFeatures(edge);

      enhancedEdges.push({
        edge,
        sourceNode,
        targetNode,
        features,
      });
    }

    return enhancedEdges;
  }

  /**
   * Compute features for an edge
   */
  private computeEdgeFeatures(edge: CausalEdge): EdgeFeatures {
    const sourceDegree = this.graph.getDegree(edge.source);
    const targetDegree = this.graph.getDegree(edge.target);

    // Find common neighbors
    const sourceNeighbors = new Set(this.graph.getAllNeighbors(edge.source));
    const targetNeighbors = new Set(this.graph.getAllNeighbors(edge.target));

    const commonNeighbors = [...sourceNeighbors].filter((n) =>
      targetNeighbors.has(n)
    ).length;

    // Jaccard coefficient: |A ∩ B| / |A ∪ B|
    const unionSize = new Set([...sourceNeighbors, ...targetNeighbors]).size;
    const jaccardCoefficient = unionSize > 0 ? commonNeighbors / unionSize : 0;

    // Relation type encoding
    const relationTypeEncoding =
      RELATION_TYPE_ENCODING[edge.relationType] ||
      Array(9).fill(0);

    return {
      sourceDegree,
      targetDegree,
      commonNeighbors,
      jaccardCoefficient,
      relationTypeEncoding,
    };
  }

  /**
   * Get enhanced triangles with computed features
   */
  getEnhancedTriangles(): EnhancedTriangle[] {
    const triangles = this.graph.findTriangles();
    const enhancedTriangles: EnhancedTriangle[] = [];

    for (const [a, b, c] of triangles) {
      const nodeA = this.graph.getNode(a);
      const nodeB = this.graph.getNode(b);
      const nodeC = this.graph.getNode(c);

      if (!nodeA || !nodeB || !nodeC) continue;

      // Find edges in the triangle
      const edges = this.findTriangleEdges(a, b, c);
      const features = this.computeTriangleFeatures(nodeA, nodeB, nodeC, edges);

      enhancedTriangles.push({
        nodes: [nodeA, nodeB, nodeC],
        edges,
        features,
      });
    }

    return enhancedTriangles;
  }

  /**
   * Find edges that form a triangle
   */
  private findTriangleEdges(a: string, b: string, c: string): CausalEdge[] {
    const edges: CausalEdge[] = [];
    const pairs = [
      [a, b],
      [b, c],
      [a, c],
    ];

    for (const [source, target] of pairs) {
      const forwardEdges = this.graph.getEdgesBetween(source, target);
      const backwardEdges = this.graph.getEdgesBetween(target, source);
      edges.push(...forwardEdges, ...backwardEdges);
    }

    return edges;
  }

  /**
   * Compute features for a triangle
   */
  private computeTriangleFeatures(
    nodeA: CausalNode,
    nodeB: CausalNode,
    nodeC: CausalNode,
    edges: CausalEdge[]
  ): TriangleFeatures {
    const degreeA = this.graph.getDegree(nodeA.id);
    const degreeB = this.graph.getDegree(nodeB.id);
    const degreeC = this.graph.getDegree(nodeC.id);

    const sumDegree = degreeA + degreeB + degreeC;
    const avgDegree = sumDegree / 3;

    // Transitivity score: ratio of actual edges to possible edges (6 for directed)
    const transitivityScore = edges.length / 6;

    // Domain homogeneity: 1 if all same domain, 0 if all different
    const domains = [nodeA.domain, nodeB.domain, nodeC.domain].filter(Boolean);
    const uniqueDomains = new Set(domains);
    const domainHomogeneity =
      domains.length > 0 ? 1 - (uniqueDomains.size - 1) / domains.length : 0;

    // Edge types present
    const edgeTypes = [...new Set(edges.map((e) => e.relationType))];

    return {
      sumDegree,
      avgDegree,
      transitivityScore,
      domainHomogeneity,
      edgeTypes,
    };
  }

  /**
   * Build adjacency matrix for the graph
   */
  buildAdjacencyMatrix(): number[][] {
    const n = this.nodeIndex.size;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (const edge of this.graph.getAllEdges()) {
      const sourceIdx = this.nodeIndex.get(edge.source);
      const targetIdx = this.nodeIndex.get(edge.target);

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        matrix[sourceIdx][targetIdx] = 1;
      }
    }

    return matrix;
  }

  /**
   * Build degree matrix (diagonal)
   */
  buildDegreeMatrix(): number[][] {
    const n = this.nodeIndex.size;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (const [nodeId, idx] of this.nodeIndex) {
      matrix[idx][idx] = this.graph.getDegree(nodeId);
    }

    return matrix;
  }

  /**
   * Build normalized Laplacian: I - D^(-1/2) * A * D^(-1/2)
   */
  buildNormalizedLaplacian(): number[][] {
    const n = this.nodeIndex.size;
    const adj = this.buildAdjacencyMatrix();
    const laplacian: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    // Compute D^(-1/2)
    const dInvSqrt: number[] = [];
    for (const [nodeId] of this.nodeIndex) {
      const degree = this.graph.getDegree(nodeId);
      dInvSqrt.push(degree > 0 ? 1 / Math.sqrt(degree) : 0);
    }

    // Compute normalized Laplacian
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          laplacian[i][j] = 1; // Identity diagonal
        } else if (adj[i][j] > 0) {
          laplacian[i][j] = -dInvSqrt[i] * adj[i][j] * dInvSqrt[j];
        }
      }
    }

    return laplacian;
  }

  /**
   * Build edge-node incidence matrix
   * Rows = edges, Columns = nodes
   * Entry (e, v) = 1 if edge e starts at v, -1 if ends at v
   */
  buildIncidenceMatrix(): { matrix: number[][]; edgeIds: string[] } {
    const edges = this.graph.getAllEdges();
    const n = this.nodeIndex.size;
    const m = edges.length;

    const matrix: number[][] = Array(m)
      .fill(null)
      .map(() => Array(n).fill(0));
    const edgeIds: string[] = [];

    edges.forEach((edge, edgeIdx) => {
      const sourceIdx = this.nodeIndex.get(edge.source);
      const targetIdx = this.nodeIndex.get(edge.target);

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        matrix[edgeIdx][sourceIdx] = 1;
        matrix[edgeIdx][targetIdx] = -1;
        edgeIds.push(edge.id);
      }
    });

    return { matrix, edgeIds };
  }

  /**
   * Get node index mapping
   */
  getNodeIndex(): Map<string, number> {
    return new Map(this.nodeIndex);
  }

  /**
   * Get reverse mapping (index -> nodeId)
   */
  getIndexToNode(): Map<number, string> {
    const reverse = new Map<number, string>();
    for (const [nodeId, idx] of this.nodeIndex) {
      reverse.set(idx, nodeId);
    }
    return reverse;
  }

  /**
   * Compute local clustering coefficient for a node
   */
  computeClusteringCoefficient(nodeId: string): number {
    const neighbors = this.graph.getAllNeighbors(nodeId);
    const k = neighbors.length;

    if (k < 2) return 0;

    // Count edges between neighbors
    let triangleEdges = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (this.graph.areConnected(neighbors[i], neighbors[j])) {
          triangleEdges++;
        }
      }
    }

    // Maximum possible edges between k neighbors
    const maxEdges = (k * (k - 1)) / 2;
    return maxEdges > 0 ? triangleEdges / maxEdges : 0;
  }

  /**
   * Compute global clustering coefficient
   */
  computeGlobalClustering(): number {
    const nodes = this.graph.getAllNodes();
    if (nodes.length === 0) return 0;

    const totalCoeff = nodes.reduce(
      (sum, node) => sum + this.computeClusteringCoefficient(node.id),
      0
    );

    return totalCoeff / nodes.length;
  }

  /**
   * Get statistics about the simplicial complex
   */
  getComplexStats(): {
    numVertices: number;
    numEdges: number;
    numTriangles: number;
    avgDegree: number;
    avgClustering: number;
    density: number;
  } {
    const stats = this.graph.getStats();

    return {
      numVertices: stats.nodeCount,
      numEdges: stats.edgeCount,
      numTriangles: stats.triangleCount,
      avgDegree: stats.avgDegree,
      avgClustering: this.computeGlobalClustering(),
      density: stats.density,
    };
  }
}

/**
 * Create a new SimplicialComplexBuilder
 */
export function createComplexBuilder(graph: CausalGraph): SimplicialComplexBuilder {
  return new SimplicialComplexBuilder(graph);
}

/**
 * Prepare embeddings for the Geometric Transformer
 * Combines node embeddings with structural features
 */
export function prepareEmbeddingsForTransformer(
  nodeEmbeddings: Map<string, number[]>,
  builder: SimplicialComplexBuilder
): Map<string, number[]> {
  const enhanced = new Map<string, number[]>();
  const nodeIndex = builder.getNodeIndex();

  for (const [nodeId, embedding] of nodeEmbeddings) {
    // Get structural features
    const _clustering = builder.computeClusteringCoefficient(nodeId);
    const idx = nodeIndex.get(nodeId) ?? 0;

    // Positional encoding based on node index
    const posEncoding = computePositionalEncoding(idx, embedding.length);

    // Combine: original embedding + positional encoding (scaled)
    const combined = embedding.map((v, i) => v + 0.1 * posEncoding[i]);

    enhanced.set(nodeId, combined);
  }

  return enhanced;
}

/**
 * Sinusoidal positional encoding
 */
function computePositionalEncoding(position: number, dim: number): number[] {
  const encoding: number[] = [];

  for (let i = 0; i < dim; i++) {
    const angle = position / Math.pow(10000, (2 * Math.floor(i / 2)) / dim);
    if (i % 2 === 0) {
      encoding.push(Math.sin(angle));
    } else {
      encoding.push(Math.cos(angle));
    }
  }

  return encoding;
}
