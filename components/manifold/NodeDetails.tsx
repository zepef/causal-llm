'use client';

import { useGraphStore, useSelectedNode } from '@/stores/graphStore';
import type { CausalEdge } from '@/types/graph';

const RELATION_COLORS: Record<string, string> = {
  causes: 'text-red-400',
  enables: 'text-green-400',
  prevents: 'text-orange-400',
  increases: 'text-blue-400',
  decreases: 'text-purple-400',
  correlates_with: 'text-gray-400',
  requires: 'text-teal-400',
  produces: 'text-yellow-400',
  inhibits: 'text-pink-400',
  default: 'text-gray-400',
};

export function NodeDetails() {
  const selectedNode = useSelectedNode();
  const graph = useGraphStore((state) => state.graph);
  const selectNode = useGraphStore((state) => state.selectNode);
  const highlightNeighbors = useGraphStore((state) => state.highlightNeighbors);

  if (!selectedNode) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="text-center text-gray-500 py-8">
          <div className="text-3xl mb-2">👆</div>
          <p className="text-sm">Click a node to see details</p>
        </div>
      </div>
    );
  }

  const inEdges = graph.getConnectedEdges(selectedNode.id).filter(
    (e: CausalEdge) => e.target === selectedNode.id
  );
  const outEdges = graph.getConnectedEdges(selectedNode.id).filter(
    (e: CausalEdge) => e.source === selectedNode.id
  );

  const handleNodeClick = (nodeId: string) => {
    selectNode(nodeId);
    highlightNeighbors(nodeId);
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
      {/* Node Info */}
      <div>
        <h3 className="font-semibold text-white text-lg">{selectedNode.label}</h3>
        {selectedNode.domain && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">
            {selectedNode.domain}
          </span>
        )}
        {selectedNode.description && (
          <p className="text-sm text-gray-400 mt-2">{selectedNode.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{inEdges.length}</div>
          <div className="text-xs text-gray-500">In-edges</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{outEdges.length}</div>
          <div className="text-xs text-gray-500">Out-edges</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-lg font-bold text-white">
            {graph.getDegree(selectedNode.id)}
          </div>
          <div className="text-xs text-gray-500">Degree</div>
        </div>
      </div>

      {/* Causes (incoming edges) */}
      {inEdges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Caused by ({inEdges.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {inEdges.map((edge: CausalEdge) => {
              const sourceNode = graph.getNode(edge.source);
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800 rounded px-2 py-1"
                  onClick={() => handleNodeClick(edge.source)}
                >
                  <span className="text-gray-300 truncate flex-1">
                    {sourceNode?.label || edge.source}
                  </span>
                  <span
                    className={`text-xs ${
                      RELATION_COLORS[edge.relationType] || RELATION_COLORS.default
                    }`}
                  >
                    {edge.relationType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Effects (outgoing edges) */}
      {outEdges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Causes ({outEdges.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {outEdges.map((edge: CausalEdge) => {
              const targetNode = graph.getNode(edge.target);
              return (
                <div
                  key={edge.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800 rounded px-2 py-1"
                  onClick={() => handleNodeClick(edge.target)}
                >
                  <span
                    className={`text-xs ${
                      RELATION_COLORS[edge.relationType] || RELATION_COLORS.default
                    }`}
                  >
                    {edge.relationType}
                  </span>
                  <span className="text-gray-300 truncate flex-1">
                    {targetNode?.label || edge.target}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={() => selectNode(null)}
        className="w-full px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
      >
        Clear Selection
      </button>
    </div>
  );
}
