'use client';

import { useEmbeddingStore } from '@/stores/embeddingStore';
import { useGraphStore } from '@/stores/graphStore';
import type { UMAPConfig } from '@/types/graph';

interface VisualizationControlsProps {
  onRecomputeUMAP?: () => void;
  isComputing?: boolean;
}

export function VisualizationControls({
  onRecomputeUMAP,
  isComputing = false,
}: VisualizationControlsProps) {
  const {
    config,
    updateConfig,
    colorBy,
    setColorBy,
    sizeBy,
    setSizeBy,
    showConnections,
    setShowConnections,
    connectionOpacity,
    setConnectionOpacity,
  } = useEmbeddingStore();

  const { is3DMode, toggle3DMode, showLabels, toggleLabels } = useGraphStore();

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
      <h3 className="font-semibold text-white mb-3">Visualization Settings</h3>

      {/* UMAP Configuration */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400">UMAP Parameters</h4>

        {/* n_neighbors */}
        <div>
          <label className="text-xs text-gray-500 flex justify-between">
            <span>Neighbors</span>
            <span>{config.nNeighbors}</span>
          </label>
          <input
            type="range"
            min="5"
            max="50"
            value={config.nNeighbors}
            onChange={(e) =>
              updateConfig({ nNeighbors: parseInt(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>Local</span>
            <span>Global</span>
          </div>
        </div>

        {/* min_dist */}
        <div>
          <label className="text-xs text-gray-500 flex justify-between">
            <span>Min Distance</span>
            <span>{config.minDist.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0.01"
            max="0.99"
            step="0.01"
            value={config.minDist}
            onChange={(e) =>
              updateConfig({ minDist: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>Tight</span>
            <span>Spread</span>
          </div>
        </div>

        {/* Metric */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Distance Metric</label>
          <select
            value={config.metric}
            onChange={(e) =>
              updateConfig({ metric: e.target.value as UMAPConfig['metric'] })
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="euclidean">Euclidean</option>
            <option value="cosine">Cosine</option>
            <option value="manhattan">Manhattan</option>
          </select>
        </div>

        {/* Recompute button */}
        {onRecomputeUMAP && (
          <button
            onClick={onRecomputeUMAP}
            disabled={isComputing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isComputing ? 'Computing...' : 'Recompute UMAP'}
          </button>
        )}
      </div>

      {/* Appearance */}
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <h4 className="text-sm font-medium text-gray-400">Appearance</h4>

        {/* Color by */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Color By</label>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as typeof colorBy)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="domain">Domain</option>
            <option value="centrality">Centrality</option>
            <option value="cluster">Cluster</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Size by */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Size By</label>
          <select
            value={sizeBy}
            onChange={(e) => setSizeBy(e.target.value as typeof sizeBy)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="degree">Degree</option>
            <option value="centrality">Centrality</option>
            <option value="uniform">Uniform</option>
          </select>
        </div>
      </div>

      {/* Edges */}
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <h4 className="text-sm font-medium text-gray-400">Edges</h4>

        {/* Show connections */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showConnections}
            onChange={(e) => setShowConnections(e.target.checked)}
            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Show Edges</span>
        </label>

        {/* Edge opacity */}
        {showConnections && (
          <div>
            <label className="text-xs text-gray-500 flex justify-between">
              <span>Edge Opacity</span>
              <span>{(connectionOpacity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={connectionOpacity}
              onChange={(e) => setConnectionOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* View */}
      <div className="space-y-3 pt-3 border-t border-gray-800">
        <h4 className="text-sm font-medium text-gray-400">View</h4>

        {/* 2D/3D toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={is3DMode}
            onChange={toggle3DMode}
            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">3D Mode</span>
        </label>

        {/* Show labels */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={toggleLabels}
            className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Show Labels</span>
        </label>
      </div>
    </div>
  );
}
