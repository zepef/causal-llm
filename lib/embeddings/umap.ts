// DEMOCRITUS - UMAP wrapper for dimensionality reduction
// Uses umap-js for computing 2D/3D projections of embeddings

import { UMAP } from 'umap-js';
import type { UMAPConfig } from '@/types/graph';

/**
 * Default UMAP configuration
 */
export const DEFAULT_UMAP_CONFIG: UMAPConfig = {
  nComponents: 3,
  nNeighbors: 15,
  minDist: 0.1,
  metric: 'euclidean',
  spread: 1.0,
};

/**
 * Cosine distance function for UMAP
 */
function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity;
}

/**
 * Manhattan distance function for UMAP
 */
function manhattanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

/**
 * Get distance function based on metric name
 */
function getDistanceFunction(metric: UMAPConfig['metric']) {
  switch (metric) {
    case 'cosine':
      return cosineDistance;
    case 'manhattan':
      return manhattanDistance;
    case 'euclidean':
    default:
      return undefined; // UMAP uses euclidean by default
  }
}

/**
 * Compute UMAP projection for a set of embeddings
 */
export async function computeUMAP(
  embeddings: number[][],
  config: Partial<UMAPConfig> = {}
): Promise<number[][]> {
  const fullConfig = { ...DEFAULT_UMAP_CONFIG, ...config };

  if (embeddings.length < 2) {
    // Not enough data for UMAP
    return embeddings.map(() =>
      Array(fullConfig.nComponents).fill(0).map(() => Math.random() * 10)
    );
  }

  // Adjust nNeighbors if we have fewer samples
  const effectiveNeighbors = Math.min(
    fullConfig.nNeighbors,
    embeddings.length - 1
  );

  const umap = new UMAP({
    nComponents: fullConfig.nComponents,
    nNeighbors: effectiveNeighbors,
    minDist: fullConfig.minDist,
    spread: fullConfig.spread,
    distanceFn: getDistanceFunction(fullConfig.metric),
  });

  // Fit and transform
  const projection = umap.fit(embeddings);

  return projection;
}

/**
 * Compute UMAP with progress callback
 */
export async function computeUMAPWithProgress(
  embeddings: number[][],
  config: Partial<UMAPConfig> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<number[][]> {
  const fullConfig = { ...DEFAULT_UMAP_CONFIG, ...config };

  if (embeddings.length < 2) {
    onProgress?.(100, 'Not enough data');
    return embeddings.map(() =>
      Array(fullConfig.nComponents).fill(0).map(() => Math.random() * 10)
    );
  }

  onProgress?.(10, 'Initializing UMAP...');

  const effectiveNeighbors = Math.min(
    fullConfig.nNeighbors,
    embeddings.length - 1
  );

  const umap = new UMAP({
    nComponents: fullConfig.nComponents,
    nNeighbors: effectiveNeighbors,
    minDist: fullConfig.minDist,
    spread: fullConfig.spread,
    distanceFn: getDistanceFunction(fullConfig.metric),
  });

  onProgress?.(30, 'Computing nearest neighbors...');

  // Use initializeFit and step for progress tracking
  const nEpochs = umap.initializeFit(embeddings);

  onProgress?.(40, `Running ${nEpochs} optimization epochs...`);

  // Run epochs with progress updates
  const updateInterval = Math.max(1, Math.floor(nEpochs / 10));

  for (let i = 0; i < nEpochs; i++) {
    umap.step();

    if (i % updateInterval === 0) {
      const progress = 40 + Math.floor((i / nEpochs) * 50);
      onProgress?.(progress, `Epoch ${i}/${nEpochs}`);
    }
  }

  onProgress?.(95, 'Extracting embeddings...');

  const result = umap.getEmbedding();

  onProgress?.(100, 'Complete');

  return result;
}

/**
 * Normalize UMAP coordinates to a specific range
 */
export function normalizeProjection(
  projection: number[][],
  range: { min: number; max: number } = { min: -50, max: 50 }
): number[][] {
  if (projection.length === 0) return [];

  const dims = projection[0].length;
  const mins: number[] = Array(dims).fill(Infinity);
  const maxs: number[] = Array(dims).fill(-Infinity);

  // Find min/max for each dimension
  for (const point of projection) {
    for (let d = 0; d < dims; d++) {
      mins[d] = Math.min(mins[d], point[d]);
      maxs[d] = Math.max(maxs[d], point[d]);
    }
  }

  // Normalize to range
  const targetRange = range.max - range.min;

  return projection.map((point) =>
    point.map((val, d) => {
      const originalRange = maxs[d] - mins[d];
      if (originalRange === 0) return range.min + targetRange / 2;
      return range.min + ((val - mins[d]) / originalRange) * targetRange;
    })
  );
}

/**
 * Generate random embeddings for testing
 */
export function generateRandomEmbeddings(
  count: number,
  dimension: number = 128,
  clusters: number = 3
): { conceptId: string; label: string; domain: string; vector: number[] }[] {
  const domains = ['archaeology', 'biology', 'economics', 'climate', 'medicine'];
  const embeddings: { conceptId: string; label: string; domain: string; vector: number[] }[] = [];

  // Generate cluster centers
  const centers: number[][] = [];
  for (let c = 0; c < clusters; c++) {
    centers.push(Array(dimension).fill(0).map(() => Math.random() * 2 - 1));
  }

  for (let i = 0; i < count; i++) {
    const clusterId = i % clusters;
    const center = centers[clusterId];
    const domain = domains[clusterId % domains.length];

    // Generate point near cluster center
    const vector = center.map((v) => v + (Math.random() - 0.5) * 0.5);

    embeddings.push({
      conceptId: `concept-${i}`,
      label: `Concept ${i}`,
      domain,
      vector,
    });
  }

  return embeddings;
}

/**
 * Convert projection array to Map with IDs
 */
export function projectionsToMap<T extends number[]>(
  ids: string[],
  projections: number[][]
): Map<string, T> {
  const map = new Map<string, T>();

  for (let i = 0; i < ids.length; i++) {
    if (projections[i]) {
      map.set(ids[i], projections[i] as T);
    }
  }

  return map;
}
