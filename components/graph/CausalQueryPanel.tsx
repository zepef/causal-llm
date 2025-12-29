'use client';

// DEMOCRITUS - Causal Query Panel
// UI for querying causal relationships in the graph

import { useState, useMemo } from 'react';
import { useGraphStore, useQueryResult } from '@/stores/graphStore';
import type { CausalNode } from '@/types/graph';

interface CausalQueryPanelProps {
  onNodeClick?: (nodeId: string) => void;
}

const queryLabels: Record<string, string> = {
  causes: 'Direct Causes',
  effects: 'Direct Effects',
  ancestors: 'All Ancestors',
  descendants: 'All Descendants',
  rootCauses: 'Root Causes',
  ultimateEffects: 'Ultimate Effects',
  path: 'Causal Path',
};

export function CausalQueryPanel({ onNodeClick }: CausalQueryPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const graph = useGraphStore((s) => s.graph);
  const queryResult = useQueryResult();
  const queryCauses = useGraphStore((s) => s.queryCauses);
  const queryEffects = useGraphStore((s) => s.queryEffects);
  const queryAncestors = useGraphStore((s) => s.queryAncestors);
  const queryDescendants = useGraphStore((s) => s.queryDescendants);
  const queryRootCauses = useGraphStore((s) => s.queryRootCauses);
  const queryUltimateEffects = useGraphStore((s) => s.queryUltimateEffects);
  const queryPath = useGraphStore((s) => s.queryPath);
  const clearQueryResult = useGraphStore((s) => s.clearQueryResult);
  const highlightQueryResults = useGraphStore((s) => s.highlightQueryResults);
  const selectNode = useGraphStore((s) => s.selectNode);

  // Get all nodes for selection
  const allNodes = useMemo(() => graph.getAllNodes(), [graph]);

  // Filter nodes by search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return allNodes.slice(0, 20);
    const query = searchQuery.toLowerCase();
    return allNodes
      .filter((n) => n.label.toLowerCase().includes(query))
      .slice(0, 20);
  }, [allNodes, searchQuery]);

  const handleQuery = (type: string) => {
    if (!selectedNodeId) return;

    switch (type) {
      case 'causes':
        queryCauses(selectedNodeId);
        break;
      case 'effects':
        queryEffects(selectedNodeId);
        break;
      case 'ancestors':
        queryAncestors(selectedNodeId);
        break;
      case 'descendants':
        queryDescendants(selectedNodeId);
        break;
      case 'rootCauses':
        queryRootCauses(selectedNodeId);
        break;
      case 'ultimateEffects':
        queryUltimateEffects(selectedNodeId);
        break;
      case 'path':
        if (targetNodeId) {
          queryPath(selectedNodeId, targetNodeId);
        }
        break;
    }
  };

  const handleHighlight = () => {
    highlightQueryResults();
  };

  const handleNodeClick = (node: CausalNode) => {
    selectNode(node.id);
    onNodeClick?.(node.id);
  };

  const selectedNode = selectedNodeId ? graph.getNode(selectedNodeId) : null;
  const targetNode = targetNodeId ? graph.getNode(targetNodeId) : null;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="font-semibold text-white mb-4">Causal Queries</h3>

      {/* Node Selection */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Search Node</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Node List */}
        <div className="max-h-32 overflow-y-auto space-y-1">
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                selectedNodeId === node.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {node.label}
            </button>
          ))}
          {filteredNodes.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">No nodes found</p>
          )}
        </div>

        {selectedNode && (
          <div className="text-xs text-gray-400">
            Selected: <span className="text-blue-400">{selectedNode.label}</span>
          </div>
        )}
      </div>

      {/* Query Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => handleQuery('causes')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-red-600/30 text-red-400 rounded text-xs hover:bg-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          What causes this?
        </button>
        <button
          onClick={() => handleQuery('effects')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-green-600/30 text-green-400 rounded text-xs hover:bg-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          What does this affect?
        </button>
        <button
          onClick={() => handleQuery('ancestors')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-purple-600/30 text-purple-400 rounded text-xs hover:bg-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          All Ancestors
        </button>
        <button
          onClick={() => handleQuery('descendants')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-blue-600/30 text-blue-400 rounded text-xs hover:bg-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          All Descendants
        </button>
        <button
          onClick={() => handleQuery('rootCauses')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-orange-600/30 text-orange-400 rounded text-xs hover:bg-orange-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Root Causes
        </button>
        <button
          onClick={() => handleQuery('ultimateEffects')}
          disabled={!selectedNodeId}
          className="px-3 py-2 bg-teal-600/30 text-teal-400 rounded text-xs hover:bg-teal-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Ultimate Effects
        </button>
      </div>

      {/* Path Finder */}
      <div className="border-t border-gray-800 pt-4 mb-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Path Finder</h4>
        <div className="flex gap-2 mb-2">
          <select
            value={targetNodeId}
            onChange={(e) => setTargetNodeId(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">Select target node...</option>
            {allNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => handleQuery('path')}
          disabled={!selectedNodeId || !targetNodeId}
          className="w-full px-3 py-2 bg-yellow-600/30 text-yellow-400 rounded text-xs hover:bg-yellow-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Find Causal Paths
        </button>
        {selectedNode && targetNode && (
          <p className="text-xs text-gray-500 mt-1">
            From: {selectedNode.label} → To: {targetNode.label}
          </p>
        )}
      </div>

      {/* Query Results */}
      {queryResult && (
        <div className="border-t border-gray-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-300">
              {queryLabels[queryResult.query] || queryResult.query}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={handleHighlight}
                className="text-xs px-2 py-1 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
              >
                Highlight
              </button>
              <button
                onClick={clearQueryResult}
                className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Paths Display */}
          {queryResult.paths && queryResult.paths.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">
                Found {queryResult.paths.length} path(s):
              </p>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {queryResult.paths.slice(0, 5).map((path, i) => (
                  <div key={i} className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1">
                    {path.map((nodeId, j) => {
                      const node = graph.getNode(nodeId);
                      return (
                        <span key={nodeId}>
                          <span className="text-blue-400">{node?.label || nodeId}</span>
                          {j < path.length - 1 && <span className="text-gray-500"> → </span>}
                        </span>
                      );
                    })}
                  </div>
                ))}
                {queryResult.paths.length > 5 && (
                  <p className="text-xs text-gray-500">
                    ...and {queryResult.paths.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="text-xs text-gray-400 mb-2">
            {queryResult.results.length} node(s) found
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {queryResult.results.map((node) => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className="w-full text-left px-2 py-1.5 bg-gray-800 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-between"
              >
                <span>{node.label}</span>
                {node.domain && (
                  <span className="text-xs text-gray-500">{node.domain}</span>
                )}
              </button>
            ))}
            {queryResult.results.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
