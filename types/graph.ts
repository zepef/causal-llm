// DEMOCRITUS - Type definitions for causal graph structures

/**
 * Relation types for causal edges
 * Based on DEMOCRITUS paper's typed relation categories
 */
export type RelationType =
  | 'causes'          // Direct causation
  | 'enables'         // Necessary condition
  | 'prevents'        // Inhibitory effect
  | 'increases'       // Positive quantitative effect
  | 'decreases'       // Negative quantitative effect
  | 'correlates_with' // Statistical association (non-causal)
  | 'requires'        // Prerequisite
  | 'produces'        // Generates as output
  | 'inhibits'        // Suppresses
  | 'modulates'       // Adjusts intensity
  | 'triggers'        // Initiates
  | 'amplifies'       // Strengthens effect
  | 'mediates';       // Intermediate mechanism

/**
 * Node types in the causal graph
 */
export type NodeType = 'concept' | 'topic' | 'question' | 'statement';

/**
 * A node in the causal graph
 */
export interface CausalNode {
  id: string;
  label: string;
  type: NodeType;
  domain?: string;
  description?: string;

  // Embedding data
  embedding?: number[];
  umap2d?: [number, number];
  umap3d?: [number, number, number];

  // Graph metrics (computed)
  inDegree?: number;
  outDegree?: number;
  centrality?: number;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * An edge in the causal graph (relational triple)
 */
export interface CausalEdge {
  id: string;
  source: string;      // Source node ID
  target: string;      // Target node ID
  relationType: RelationType;
  weight?: number;
  confidence?: number;

  // Source statement
  statementId?: string;
  statementText?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * A causal triple: (source, relation, target)
 */
export interface CausalTriple {
  source: string;      // Source concept name
  relation: RelationType;
  target: string;      // Target concept name
  confidence?: number;
}

/**
 * The full causal graph structure
 */
export interface CausalGraphData {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

/**
 * Serializable graph format for storage/transfer
 */
export interface SerializedGraph {
  version: string;
  projectId?: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  metadata?: {
    createdAt: string;
    nodeCount: number;
    edgeCount: number;
    domains: string[];
  };
}

/**
 * Simplicial complex for Geometric Transformer
 */
export interface SimplicialComplex {
  vertices: CausalNode[];                    // 0-simplices
  edges: CausalEdge[];                       // 1-simplices
  triangles: [string, string, string][];     // 2-simplices (node ID triplets)
}

/**
 * Graph statistics
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  triangleCount: number;
  domains: string[];
  relationTypeCounts: Record<RelationType, number>;
  avgDegree: number;
  density: number;
  hubNodes: Array<{ id: string; label: string; degree: number }>;
}

/**
 * Topic in the BFS expansion tree
 */
export interface TopicNode {
  id: string;
  name: string;
  description?: string;
  causalRelevance?: string;
  depth: number;
  parentId?: string;
  children: TopicNode[];
  expanded: boolean;
  questionCount?: number;
}

/**
 * Causal question generated from a topic
 */
export interface CausalQuestion {
  id: string;
  text: string;
  type: 'cause' | 'effect' | 'mechanism' | 'condition';
  variables: string[];
  topicId: string;
}

/**
 * Causal statement (natural language claim)
 */
export interface CausalStatement {
  id: string;
  text: string;
  cause?: string;
  effect?: string;
  mechanism?: string;
  confidence: number;
  questionId?: string;
  triples: CausalTriple[];
}

/**
 * Embedding computation result
 */
export interface EmbeddingResult {
  conceptId: string;
  vector: number[];
  dimension: number;
  umap2d?: [number, number];
  umap3d?: [number, number, number];
}

/**
 * UMAP configuration
 */
export interface UMAPConfig {
  nComponents: 2 | 3;
  nNeighbors: number;
  minDist: number;
  metric: 'euclidean' | 'cosine' | 'manhattan';
  spread?: number;
}

/**
 * Topos slice representing a domain
 */
export interface ToposSlice {
  id: string;
  domain: string;
  description?: string;
  objects: Set<string>;          // Concept IDs in this slice
  morphisms: SliceMorphism[];    // Internal morphisms (edges)
}

/**
 * Morphism within a topos slice
 */
export interface SliceMorphism {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
}

/**
 * Functor mapping between topos slices
 */
export interface SliceFunctor {
  sourceSliceId: string;
  targetSliceId: string;
  objectMap: Map<string, string>;     // Maps concepts across domains
  morphismMap: Map<string, string>;   // Maps relations across domains
  similarity: number;                  // Structural similarity score
}

/**
 * Cross-domain analogy
 */
export interface CrossDomainAnalogy {
  sourceSlice: ToposSlice;
  targetSlice: ToposSlice;
  functor: SliceFunctor;
  analogousPairs: Array<{
    sourceConcept: string;
    targetConcept: string;
    similarity: number;
  }>;
}
