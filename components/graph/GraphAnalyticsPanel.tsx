'use client';

// DEMOCRITUS - Graph Analytics Panel
// UI for displaying graph analytics and centrality measures

import { useMemo } from 'react';
import { useGraphStore, useGraphAnalytics } from '@/stores/graphStore';

interface GraphAnalyticsPanelProps {
  onNodeClick?: (nodeId: string) => void;
}

export function GraphAnalyticsPanel({ onNodeClick }: GraphAnalyticsPanelProps) {
  const graph = useGraphStore((s) => s.graph);
  const analytics = useGraphAnalytics();
  const analyticsComputed = useGraphStore((s) => s.analyticsComputed);
  const computeAnalytics = useGraphStore((s) => s.computeAnalytics);
  const clearAnalytics = useGraphStore((s) => s.clearAnalytics);
  const selectNode = useGraphStore((s) => s.selectNode);
  const highlightNeighbors = useGraphStore((s) => s.highlightNeighbors);

  // Sort nodes by different centrality measures
  const topPageRank = useMemo(() => {
    if (!analytics?.pageRank) return [];
    return Array.from(analytics.pageRank.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        node: graph.getNode(id),
        score,
      }))
      .filter((item) => item.node);
  }, [analytics?.pageRank, graph]);

  const topBetweenness = useMemo(() => {
    if (!analytics?.betweenness) return [];
    return Array.from(analytics.betweenness.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        node: graph.getNode(id),
        score,
      }))
      .filter((item) => item.node);
  }, [analytics?.betweenness, graph]);

  const topCloseness = useMemo(() => {
    if (!analytics?.closeness) return [];
    return Array.from(analytics.closeness.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, score]) => ({
        node: graph.getNode(id),
        score,
      }))
      .filter((item) => item.node);
  }, [analytics?.closeness, graph]);

  const handleNodeClick = (nodeId: string) => {
    selectNode(nodeId);
    highlightNeighbors(nodeId);
    onNodeClick?.(nodeId);
  };

  // Summary stats
  const connectedComponentCount = analytics?.connectedComponents?.length || 0;
  const sccCount = analytics?.stronglyConnectedComponents?.length || 0;
  const cycleCount = analytics?.stronglyConnectedComponents?.filter(
    (scc) => scc.length > 1
  ).length || 0;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Graph Analytics</h3>
        {!analyticsComputed ? (
          <button
            onClick={computeAnalytics}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Compute
          </button>
        ) : (
          <button
            onClick={clearAnalytics}
            className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {!analyticsComputed ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm mb-2">Analytics not computed yet</p>
          <p className="text-xs">Click &quot;Compute&quot; to calculate centrality measures</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-lg font-bold text-white">{connectedComponentCount}</div>
              <div className="text-xs text-gray-500">Components</div>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-lg font-bold text-white">{sccCount}</div>
              <div className="text-xs text-gray-500">SCCs</div>
            </div>
            <div className="bg-gray-800 rounded p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">{cycleCount}</div>
              <div className="text-xs text-gray-500">Cycles</div>
            </div>
          </div>

          {/* PageRank */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              PageRank (Importance)
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {topPageRank.map(({ node, score }, i) => (
                <button
                  key={node!.id}
                  onClick={() => handleNodeClick(node!.id)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-white">{node!.label}</span>
                  </span>
                  <span className="text-purple-400 font-mono">{(score * 100).toFixed(2)}%</span>
                </button>
              ))}
              {topPageRank.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No data</p>
              )}
            </div>
          </div>

          {/* Betweenness */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Betweenness (Bridge Nodes)
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {topBetweenness.map(({ node, score }, i) => (
                <button
                  key={node!.id}
                  onClick={() => handleNodeClick(node!.id)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-white">{node!.label}</span>
                  </span>
                  <span className="text-orange-400 font-mono">{(score * 100).toFixed(2)}%</span>
                </button>
              ))}
              {topBetweenness.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No data</p>
              )}
            </div>
          </div>

          {/* Closeness */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              Closeness (Reachability)
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {topCloseness.map(({ node, score }, i) => (
                <button
                  key={node!.id}
                  onClick={() => handleNodeClick(node!.id)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="text-white">{node!.label}</span>
                  </span>
                  <span className="text-teal-400 font-mono">{(score * 100).toFixed(2)}%</span>
                </button>
              ))}
              {topCloseness.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No data</p>
              )}
            </div>
          </div>

          {/* Cycles / Strongly Connected Components */}
          {cycleCount > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Causal Cycles (Feedback Loops)
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {analytics?.stronglyConnectedComponents
                  ?.filter((scc) => scc.length > 1)
                  .slice(0, 5)
                  .map((scc, i) => (
                    <div
                      key={i}
                      className="px-2 py-1.5 bg-gray-800 rounded text-xs"
                    >
                      <span className="text-yellow-400">{scc.length} nodes: </span>
                      <span className="text-gray-300">
                        {scc
                          .slice(0, 3)
                          .map((id) => graph.getNode(id)?.label || id)
                          .join(' → ')}
                        {scc.length > 3 && ` ... → ${graph.getNode(scc[0])?.label || scc[0]}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
            <p><strong>PageRank:</strong> Nodes that receive many incoming edges from important nodes</p>
            <p><strong>Betweenness:</strong> Nodes that lie on many shortest paths (bridges)</p>
            <p><strong>Closeness:</strong> Nodes that can quickly reach many other nodes</p>
          </div>
        </div>
      )}
    </div>
  );
}
