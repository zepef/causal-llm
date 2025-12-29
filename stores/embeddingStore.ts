// DEMOCRITUS - Embedding state management with Zustand
// Manages embeddings and UMAP projections for visualization

import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UMAPConfig } from '@/types/graph';

// Enable Immer MapSet plugin
enableMapSet();

interface EmbeddingData {
  conceptId: string;
  label: string;
  domain?: string;
  vector: number[];
  umap2d?: [number, number];
  umap3d?: [number, number, number];
}

interface EmbeddingState {
  // Raw embeddings
  embeddings: Map<string, EmbeddingData>;

  // UMAP projections (cached)
  umap2dProjections: Map<string, [number, number]>;
  umap3dProjections: Map<string, [number, number, number]>;

  // Computation state
  isComputing: boolean;
  computationProgress: number;
  computationMessage: string;

  // Configuration
  config: UMAPConfig;

  // Selected/highlighted
  selectedEmbeddingId: string | null;
  hoveredEmbeddingId: string | null;

  // View settings
  colorBy: 'domain' | 'centrality' | 'cluster' | 'none';
  sizeBy: 'degree' | 'pagerank' | 'betweenness' | 'closeness' | 'uniform';
  showConnections: boolean;
  connectionOpacity: number;

  // Actions
  setEmbeddings: (embeddings: EmbeddingData[]) => void;
  addEmbedding: (embedding: EmbeddingData) => void;
  removeEmbedding: (conceptId: string) => void;
  clearEmbeddings: () => void;

  setUMAP2D: (projections: Map<string, [number, number]>) => void;
  setUMAP3D: (projections: Map<string, [number, number, number]>) => void;

  setComputing: (isComputing: boolean, message?: string) => void;
  setProgress: (progress: number) => void;

  updateConfig: (config: Partial<UMAPConfig>) => void;

  selectEmbedding: (id: string | null) => void;
  hoverEmbedding: (id: string | null) => void;

  setColorBy: (colorBy: EmbeddingState['colorBy']) => void;
  setSizeBy: (sizeBy: EmbeddingState['sizeBy']) => void;
  setShowConnections: (show: boolean) => void;
  setConnectionOpacity: (opacity: number) => void;
}

export const useEmbeddingStore = create<EmbeddingState>()(
  immer((set) => ({
    // Initial state
    embeddings: new Map(),
    umap2dProjections: new Map(),
    umap3dProjections: new Map(),

    isComputing: false,
    computationProgress: 0,
    computationMessage: '',

    config: {
      nComponents: 3,
      nNeighbors: 15,
      minDist: 0.1,
      metric: 'euclidean',
      spread: 1.0,
    },

    selectedEmbeddingId: null,
    hoveredEmbeddingId: null,

    colorBy: 'domain',
    sizeBy: 'degree',
    showConnections: true,
    connectionOpacity: 0.3,

    // Actions
    setEmbeddings: (embeddings) =>
      set((state) => {
        state.embeddings.clear();
        for (const emb of embeddings) {
          state.embeddings.set(emb.conceptId, emb);
        }
      }),

    addEmbedding: (embedding) =>
      set((state) => {
        state.embeddings.set(embedding.conceptId, embedding);
      }),

    removeEmbedding: (conceptId) =>
      set((state) => {
        state.embeddings.delete(conceptId);
        state.umap2dProjections.delete(conceptId);
        state.umap3dProjections.delete(conceptId);
      }),

    clearEmbeddings: () =>
      set((state) => {
        state.embeddings.clear();
        state.umap2dProjections.clear();
        state.umap3dProjections.clear();
      }),

    setUMAP2D: (projections) =>
      set((state) => {
        state.umap2dProjections = projections;
        // Also update embeddings
        for (const [id, proj] of projections) {
          const emb = state.embeddings.get(id);
          if (emb) {
            emb.umap2d = proj;
          }
        }
      }),

    setUMAP3D: (projections) =>
      set((state) => {
        state.umap3dProjections = projections;
        // Also update embeddings
        for (const [id, proj] of projections) {
          const emb = state.embeddings.get(id);
          if (emb) {
            emb.umap3d = proj;
          }
        }
      }),

    setComputing: (isComputing, message = '') =>
      set((state) => {
        state.isComputing = isComputing;
        state.computationMessage = message;
        if (!isComputing) {
          state.computationProgress = 0;
        }
      }),

    setProgress: (progress) =>
      set((state) => {
        state.computationProgress = Math.min(100, Math.max(0, progress));
      }),

    updateConfig: (config) =>
      set((state) => {
        Object.assign(state.config, config);
      }),

    selectEmbedding: (id) =>
      set((state) => {
        state.selectedEmbeddingId = id;
      }),

    hoverEmbedding: (id) =>
      set((state) => {
        state.hoveredEmbeddingId = id;
      }),

    setColorBy: (colorBy) =>
      set((state) => {
        state.colorBy = colorBy;
      }),

    setSizeBy: (sizeBy) =>
      set((state) => {
        state.sizeBy = sizeBy;
      }),

    setShowConnections: (show) =>
      set((state) => {
        state.showConnections = show;
      }),

    setConnectionOpacity: (opacity) =>
      set((state) => {
        state.connectionOpacity = opacity;
      }),
  }))
);

// Selector hooks - use individual selectors to avoid hydration issues
export const useEmbeddingList = () =>
  useEmbeddingStore((state) => Array.from(state.embeddings.values()));

export const useUMAP3DProjections = () =>
  useEmbeddingStore((state) => state.umap3dProjections);

export const useIsComputing = () =>
  useEmbeddingStore((state) => state.isComputing);

export const useComputationProgress = () =>
  useEmbeddingStore((state) => state.computationProgress);

export const useComputationMessage = () =>
  useEmbeddingStore((state) => state.computationMessage);

// Combined hook for computation status - must be used in client components only
export function useComputationStatus() {
  const isComputing = useEmbeddingStore((state) => state.isComputing);
  const progress = useEmbeddingStore((state) => state.computationProgress);
  const message = useEmbeddingStore((state) => state.computationMessage);
  return { isComputing, progress, message };
}
