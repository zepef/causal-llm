// DEMOCRITUS - Geometric Transformer
// Processes simplicial complexes (edges and triangles) to refine node embeddings
// Based on the DEMOCRITUS paper's approach to higher-order causal motifs

import * as tf from '@tensorflow/tfjs';
import type { SimplicialComplex } from '@/types/graph';

/**
 * Configuration for the Geometric Transformer
 */
export interface GeometricTransformerConfig {
  embeddingDim: number;      // Dimension of input embeddings
  hiddenDim: number;         // Hidden layer dimension
  numHeads: number;          // Number of attention heads
  dropoutRate: number;       // Dropout rate for regularization
  numLayers: number;         // Number of transformer layers
  useLayerNorm: boolean;     // Whether to use layer normalization
}

/**
 * Default configuration
 */
export const DEFAULT_GT_CONFIG: GeometricTransformerConfig = {
  embeddingDim: 128,
  hiddenDim: 256,
  numHeads: 4,
  dropoutRate: 0.1,
  numLayers: 2,
  useLayerNorm: true,
};

/**
 * Multi-Head Attention layer for simplicial data
 */
class MultiHeadAttention {
  private numHeads: number;
  private keyDim: number;
  private wq: tf.Variable;
  private wk: tf.Variable;
  private wv: tf.Variable;
  private wo: tf.Variable;

  constructor(embeddingDim: number, numHeads: number) {
    this.numHeads = numHeads;
    this.keyDim = Math.floor(embeddingDim / numHeads);

    // Initialize weights
    const initializerQ = tf.initializers.glorotUniform({});
    const initializerK = tf.initializers.glorotUniform({});
    const initializerV = tf.initializers.glorotUniform({});
    const initializerO = tf.initializers.glorotUniform({});

    this.wq = tf.variable(
      initializerQ.apply([embeddingDim, numHeads * this.keyDim]) as tf.Tensor
    );
    this.wk = tf.variable(
      initializerK.apply([embeddingDim, numHeads * this.keyDim]) as tf.Tensor
    );
    this.wv = tf.variable(
      initializerV.apply([embeddingDim, numHeads * this.keyDim]) as tf.Tensor
    );
    this.wo = tf.variable(
      initializerO.apply([numHeads * this.keyDim, embeddingDim]) as tf.Tensor
    );
  }

  /**
   * Apply multi-head attention
   * @param query Query tensor [batch, seqLen, embDim]
   * @param key Key tensor [batch, seqLen, embDim]
   * @param value Value tensor [batch, seqLen, embDim]
   * @param mask Optional attention mask
   */
  call(
    query: tf.Tensor3D,
    key: tf.Tensor3D,
    value: tf.Tensor3D,
    mask?: tf.Tensor
  ): tf.Tensor3D {
    return tf.tidy(() => {
      const batchSize = query.shape[0];
      const seqLen = query.shape[1];

      // Linear projections
      let q = tf.matMul(query.reshape([-1, query.shape[2]]), this.wq);
      let k = tf.matMul(key.reshape([-1, key.shape[2]]), this.wk);
      let v = tf.matMul(value.reshape([-1, value.shape[2]]), this.wv);

      // Reshape for multi-head attention
      q = q.reshape([batchSize, seqLen, this.numHeads, this.keyDim]);
      k = k.reshape([batchSize, seqLen, this.numHeads, this.keyDim]);
      v = v.reshape([batchSize, seqLen, this.numHeads, this.keyDim]);

      // Transpose to [batch, numHeads, seqLen, keyDim]
      q = q.transpose([0, 2, 1, 3]);
      k = k.transpose([0, 2, 1, 3]);
      v = v.transpose([0, 2, 1, 3]);

      // Scaled dot-product attention
      const scale = Math.sqrt(this.keyDim);
      let scores = tf.matMul(q, k.transpose([0, 1, 3, 2])).div(scale);

      // Apply mask if provided
      if (mask) {
        const maskExpanded = mask.expandDims(1).expandDims(1);
        scores = scores.add(maskExpanded.mul(-1e9));
      }

      // Softmax and weighted sum
      const attnWeights = tf.softmax(scores, -1);
      let output = tf.matMul(attnWeights, v);

      // Transpose back and reshape
      output = output.transpose([0, 2, 1, 3]);
      output = output.reshape([batchSize, seqLen, this.numHeads * this.keyDim]);

      // Final linear projection
      output = tf.matMul(output.reshape([-1, this.numHeads * this.keyDim]), this.wo);
      return output.reshape([batchSize, seqLen, -1]) as tf.Tensor3D;
    });
  }

  dispose(): void {
    this.wq.dispose();
    this.wk.dispose();
    this.wv.dispose();
    this.wo.dispose();
  }
}

/**
 * Feed-Forward Network for transformer
 */
class FeedForward {
  private w1: tf.Variable;
  private w2: tf.Variable;
  private b1: tf.Variable;
  private b2: tf.Variable;

  constructor(embeddingDim: number, hiddenDim: number) {
    const initializer1 = tf.initializers.glorotUniform({});
    const initializer2 = tf.initializers.glorotUniform({});

    this.w1 = tf.variable(initializer1.apply([embeddingDim, hiddenDim]) as tf.Tensor);
    this.w2 = tf.variable(initializer2.apply([hiddenDim, embeddingDim]) as tf.Tensor);
    this.b1 = tf.variable(tf.zeros([hiddenDim]));
    this.b2 = tf.variable(tf.zeros([embeddingDim]));
  }

  call(x: tf.Tensor3D): tf.Tensor3D {
    return tf.tidy(() => {
      const shape = x.shape;
      let out = tf.matMul(x.reshape([-1, shape[2]]), this.w1).add(this.b1);
      out = tf.relu(out);
      out = tf.matMul(out, this.w2).add(this.b2);
      return out.reshape(shape) as tf.Tensor3D;
    });
  }

  dispose(): void {
    this.w1.dispose();
    this.w2.dispose();
    this.b1.dispose();
    this.b2.dispose();
  }
}

/**
 * Transformer layer for simplicial data
 */
class SimplicialTransformerLayer {
  private attention: MultiHeadAttention;
  private ffn: FeedForward;
  private layerNorm1Scale: tf.Variable;
  private layerNorm1Bias: tf.Variable;
  private layerNorm2Scale: tf.Variable;
  private layerNorm2Bias: tf.Variable;
  private useLayerNorm: boolean;

  constructor(config: GeometricTransformerConfig) {
    this.attention = new MultiHeadAttention(config.embeddingDim, config.numHeads);
    this.ffn = new FeedForward(config.embeddingDim, config.hiddenDim);
    this.useLayerNorm = config.useLayerNorm;

    if (this.useLayerNorm) {
      this.layerNorm1Scale = tf.variable(tf.ones([config.embeddingDim]));
      this.layerNorm1Bias = tf.variable(tf.zeros([config.embeddingDim]));
      this.layerNorm2Scale = tf.variable(tf.ones([config.embeddingDim]));
      this.layerNorm2Bias = tf.variable(tf.zeros([config.embeddingDim]));
    } else {
      this.layerNorm1Scale = tf.variable(tf.ones([1]));
      this.layerNorm1Bias = tf.variable(tf.zeros([1]));
      this.layerNorm2Scale = tf.variable(tf.ones([1]));
      this.layerNorm2Bias = tf.variable(tf.zeros([1]));
    }
  }

  private layerNorm(x: tf.Tensor3D, scale: tf.Variable, bias: tf.Variable): tf.Tensor3D {
    if (!this.useLayerNorm) return x;

    return tf.tidy(() => {
      const mean = x.mean(-1, true);
      const variance = x.sub(mean).square().mean(-1, true);
      const normalized = x.sub(mean).div(variance.add(1e-6).sqrt());
      return normalized.mul(scale).add(bias) as tf.Tensor3D;
    });
  }

  call(x: tf.Tensor3D): tf.Tensor3D {
    return tf.tidy(() => {
      // Self-attention with residual connection
      const attnOutput = this.attention.call(x, x, x);
      let out = x.add(attnOutput) as tf.Tensor3D;
      out = this.layerNorm(out, this.layerNorm1Scale, this.layerNorm1Bias);

      // Feed-forward with residual connection
      const ffnOutput = this.ffn.call(out);
      out = out.add(ffnOutput) as tf.Tensor3D;
      out = this.layerNorm(out, this.layerNorm2Scale, this.layerNorm2Bias);

      return out;
    }) as tf.Tensor3D;
  }

  dispose(): void {
    this.attention.dispose();
    this.ffn.dispose();
    this.layerNorm1Scale.dispose();
    this.layerNorm1Bias.dispose();
    this.layerNorm2Scale.dispose();
    this.layerNorm2Bias.dispose();
  }
}

/**
 * Geometric Transformer for processing simplicial complexes
 *
 * Processes:
 * - 1-simplices (edges): Pairs of connected concepts
 * - 2-simplices (triangles): Triadic causal motifs
 *
 * Uses message passing to aggregate higher-order information
 * back to node embeddings.
 */
export class GeometricTransformer {
  private config: GeometricTransformerConfig;
  private edgeLayers: SimplicialTransformerLayer[];
  private triangleLayers: SimplicialTransformerLayer[];
  private edgeAggregationW: tf.Variable;
  private triangleAggregationW: tf.Variable;
  private finalProjection: tf.Variable;
  private initialized: boolean = false;

  constructor(config: Partial<GeometricTransformerConfig> = {}) {
    this.config = { ...DEFAULT_GT_CONFIG, ...config };
    this.edgeLayers = [];
    this.triangleLayers = [];

    // Placeholder variables - will be initialized on first use
    this.edgeAggregationW = tf.variable(tf.zeros([1]));
    this.triangleAggregationW = tf.variable(tf.zeros([1]));
    this.finalProjection = tf.variable(tf.zeros([1]));
  }

  /**
   * Ensure TensorFlow.js backend is ready
   */
  private async ensureBackend(): Promise<void> {
    await tf.ready();
  }

  /**
   * Initialize the transformer layers
   */
  private initialize(): void {
    if (this.initialized) return;

    // Dispose placeholder variables
    this.edgeAggregationW.dispose();
    this.triangleAggregationW.dispose();
    this.finalProjection.dispose();

    // Create edge transformer layers
    for (let i = 0; i < this.config.numLayers; i++) {
      this.edgeLayers.push(new SimplicialTransformerLayer(this.config));
    }

    // Create triangle transformer layers
    for (let i = 0; i < this.config.numLayers; i++) {
      this.triangleLayers.push(new SimplicialTransformerLayer(this.config));
    }

    // Aggregation weights
    const initAgg = tf.initializers.glorotUniform({});
    this.edgeAggregationW = tf.variable(
      initAgg.apply([this.config.embeddingDim * 2, this.config.embeddingDim]) as tf.Tensor
    );
    this.triangleAggregationW = tf.variable(
      initAgg.apply([this.config.embeddingDim * 3, this.config.embeddingDim]) as tf.Tensor
    );

    // Final projection
    const initFinal = tf.initializers.glorotUniform({});
    this.finalProjection = tf.variable(
      initFinal.apply([this.config.embeddingDim * 3, this.config.embeddingDim]) as tf.Tensor
    );

    this.initialized = true;
  }

  /**
   * Process edge embeddings (1-simplices)
   * @param edges Array of [sourceEmb, targetEmb] pairs
   */
  processEdges(edges: tf.Tensor3D): tf.Tensor3D {
    this.initialize();

    return tf.tidy(() => {
      let x = edges;

      // Apply transformer layers
      for (const layer of this.edgeLayers) {
        x = layer.call(x);
      }

      return x;
    });
  }

  /**
   * Process triangle embeddings (2-simplices)
   * @param triangles Array of [emb1, emb2, emb3] triplets
   */
  processTriangles(triangles: tf.Tensor3D): tf.Tensor3D {
    this.initialize();

    return tf.tidy(() => {
      let x = triangles;

      // Apply transformer layers
      for (const layer of this.triangleLayers) {
        x = layer.call(x);
      }

      return x;
    });
  }

  /**
   * Aggregate edge information to source node
   * @param edgeEmbeddings Processed edge embeddings [numEdges, 2, embDim]
   * Returns aggregated embeddings as number arrays (not tensors)
   */
  aggregateEdgesToNodes(
    edgeEmbeddings: tf.Tensor3D,
    nodeIds: string[],
    edgeSourceIds: string[]
  ): Map<string, number[]> {
    this.initialize();

    // Use number arrays to avoid tensor disposal issues
    const nodeAggregates = new Map<string, number[][]>();

    // Initialize empty arrays for each node
    for (const nodeId of nodeIds) {
      nodeAggregates.set(nodeId, []);
    }

    // Get edge embeddings as array
    const edgeEmbs = edgeEmbeddings.arraySync() as number[][][];
    const weightsArray = this.edgeAggregationW.arraySync() as number[][];

    // Aggregate edge embeddings to source nodes
    for (let i = 0; i < edgeSourceIds.length; i++) {
      const sourceId = edgeSourceIds[i];
      const edgeEmb = edgeEmbs[i];

      // Concatenate source and target embeddings
      const combined = [...edgeEmb[0], ...edgeEmb[1]];

      // Manual matrix multiplication: combined (1 x 2*embDim) * weights (2*embDim x embDim)
      const projected: number[] = [];
      for (let j = 0; j < weightsArray[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < combined.length; k++) {
          sum += combined[k] * weightsArray[k][j];
        }
        projected.push(sum);
      }

      const existing = nodeAggregates.get(sourceId) || [];
      existing.push(projected);
      nodeAggregates.set(sourceId, existing);
    }

    // Average aggregates for each node
    const result = new Map<string, number[]>();

    for (const [nodeId, vectors] of nodeAggregates) {
      if (vectors.length > 0) {
        // Compute mean
        const mean: number[] = new Array(vectors[0].length).fill(0);
        for (const vec of vectors) {
          for (let i = 0; i < vec.length; i++) {
            mean[i] += vec[i];
          }
        }
        for (let i = 0; i < mean.length; i++) {
          mean[i] /= vectors.length;
        }
        result.set(nodeId, mean);
      }
    }

    return result;
  }

  /**
   * Process a full simplicial complex and refine node embeddings
   */
  async processComplex(
    complex: SimplicialComplex,
    nodeEmbeddings: Map<string, number[]>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Map<string, number[]>> {
    onProgress?.(0, 'Initializing TensorFlow.js...');

    // Ensure TensorFlow.js backend is ready
    await this.ensureBackend();

    this.initialize();

    onProgress?.(5, 'Initializing Geometric Transformer...');

    const nodeIds = Array.from(nodeEmbeddings.keys());
    const embDim = this.config.embeddingDim;

    // Validate embedding dimensions
    for (const [, emb] of nodeEmbeddings) {
      if (emb.length !== embDim) {
        throw new Error(
          `Embedding dimension mismatch: expected ${embDim}, got ${emb.length}`
        );
      }
    }

    onProgress?.(10, 'Processing edges (1-simplices)...');

    // Process edges
    const edgeEmbeddings: number[][][] = [];
    const edgeSourceIds: string[] = [];

    for (const edge of complex.edges) {
      const sourceEmb = nodeEmbeddings.get(edge.source);
      const targetEmb = nodeEmbeddings.get(edge.target);

      if (sourceEmb && targetEmb) {
        edgeEmbeddings.push([sourceEmb, targetEmb]);
        edgeSourceIds.push(edge.source);
      }
    }

    let edgeRefinements = new Map<string, number[]>();

    if (edgeEmbeddings.length > 0) {
      const edgeTensor = tf.tensor3d(edgeEmbeddings);
      const processedEdges = this.processEdges(edgeTensor);

      // Aggregate to nodes (returns Map<string, number[]>)
      edgeRefinements = this.aggregateEdgesToNodes(
        processedEdges,
        nodeIds,
        edgeSourceIds
      );

      edgeTensor.dispose();
      processedEdges.dispose();
    }

    onProgress?.(40, 'Processing triangles (2-simplices)...');

    // Process triangles
    const triangleEmbeddings: number[][][] = [];
    const triangleNodeIds: string[][] = [];

    for (const [a, b, c] of complex.triangles) {
      const embA = nodeEmbeddings.get(a);
      const embB = nodeEmbeddings.get(b);
      const embC = nodeEmbeddings.get(c);

      if (embA && embB && embC) {
        triangleEmbeddings.push([embA, embB, embC]);
        triangleNodeIds.push([a, b, c]);
      }
    }

    const triangleRefinements = new Map<string, number[]>();

    if (triangleEmbeddings.length > 0) {
      const triangleTensor = tf.tensor3d(triangleEmbeddings);
      const processedTriangles = this.processTriangles(triangleTensor);
      const triEmbs = processedTriangles.arraySync() as number[][][];

      // Aggregate triangle information to constituent nodes
      const nodeTriAggregates = new Map<string, number[][]>();

      for (let i = 0; i < triangleNodeIds.length; i++) {
        const [a, b, c] = triangleNodeIds[i];
        const triEmb = triEmbs[i];

        // Concatenate all three embeddings
        const combined = [...triEmb[0], ...triEmb[1], ...triEmb[2]];

        for (const nodeId of [a, b, c]) {
          const existing = nodeTriAggregates.get(nodeId) || [];
          existing.push(combined);
          nodeTriAggregates.set(nodeId, existing);
        }
      }

      // Average and project
      for (const [nodeId, embeddings] of nodeTriAggregates) {
        const avgEmb = embeddings[0].map((_, i) =>
          embeddings.reduce((sum, e) => sum + e[i], 0) / embeddings.length
        );

        // Project to embedding dimension
        const avgTensor = tf.tensor2d([avgEmb]);
        const projected = tf.matMul(avgTensor, this.triangleAggregationW);
        triangleRefinements.set(nodeId, Array.from(projected.dataSync()));

        avgTensor.dispose();
        projected.dispose();
      }

      triangleTensor.dispose();
      processedTriangles.dispose();
    }

    onProgress?.(70, 'Combining refinements...');

    // Combine original, edge, and triangle refinements
    const refinedEmbeddings = new Map<string, number[]>();

    for (const nodeId of nodeIds) {
      const original = nodeEmbeddings.get(nodeId)!;
      const edgeRef = edgeRefinements.get(nodeId) || new Array(embDim).fill(0);
      const triRef = triangleRefinements.get(nodeId) || new Array(embDim).fill(0);

      // Concatenate all three
      const combined = [...original, ...edgeRef, ...triRef];

      // Project to final embedding dimension
      const combinedTensor = tf.tensor2d([combined]);
      const finalEmb = tf.matMul(combinedTensor, this.finalProjection);
      refinedEmbeddings.set(nodeId, Array.from(finalEmb.dataSync()));

      combinedTensor.dispose();
      finalEmb.dispose();
    }

    onProgress?.(100, 'Complete');

    return refinedEmbeddings;
  }

  /**
   * Get current configuration
   */
  getConfig(): GeometricTransformerConfig {
    return { ...this.config };
  }

  /**
   * Dispose all tensors and free memory
   */
  dispose(): void {
    for (const layer of this.edgeLayers) {
      layer.dispose();
    }
    for (const layer of this.triangleLayers) {
      layer.dispose();
    }
    this.edgeAggregationW.dispose();
    this.triangleAggregationW.dispose();
    this.finalProjection.dispose();
  }
}

/**
 * Create a new Geometric Transformer instance
 */
export function createGeometricTransformer(
  config?: Partial<GeometricTransformerConfig>
): GeometricTransformer {
  return new GeometricTransformer(config);
}
