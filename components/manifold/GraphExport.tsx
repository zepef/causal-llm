'use client';

import { useState } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore } from '@/stores/embeddingStore';
import type { SerializedGraph, CausalNode, CausalEdge } from '@/types/graph';

export function GraphExport() {
  const [isExporting, setIsExporting] = useState(false);

  const graph = useGraphStore((state) => state.graph);
  const umap3dProjections = useEmbeddingStore((state) => state.umap3dProjections);
  const embeddings = useEmbeddingStore((state) => state.embeddings);

  const nodeCount = graph.getNodeCount();
  const edgeCount = graph.getEdgeCount();

  const hasData = nodeCount > 0;

  // Export as JSON with full graph structure
  const handleExportJson = () => {
    setIsExporting(true);

    try {
      const nodes = graph.getAllNodes();
      const edges = graph.getAllEdges();

      // Enhance nodes with UMAP projections
      const enhancedNodes: CausalNode[] = nodes.map((node) => ({
        ...node,
        umap3d: umap3dProjections.get(node.id),
        embedding: embeddings.get(node.id)?.vector,
      }));

      const data: SerializedGraph = {
        version: '1.0',
        nodes: enhancedNodes,
        edges,
        metadata: {
          createdAt: new Date().toISOString(),
          nodeCount,
          edgeCount,
          domains: [...new Set(nodes.map((n) => n.domain).filter(Boolean))] as string[],
        },
      };

      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `causal-graph-${formatDate()}.json`, 'application/json');
    } finally {
      setIsExporting(false);
    }
  };

  // Export nodes as CSV
  const handleExportNodesCsv = () => {
    setIsExporting(true);

    try {
      const nodes = graph.getAllNodes();
      const headers = ['id', 'label', 'domain', 'type', 'in_degree', 'out_degree', 'umap_x', 'umap_y', 'umap_z'];

      const rows = nodes.map((node) => {
        const pos = umap3dProjections.get(node.id);
        return [
          escapeCSV(node.id),
          escapeCSV(node.label),
          escapeCSV(node.domain || ''),
          escapeCSV(node.type),
          node.inDegree?.toString() || graph.getInDegree(node.id).toString(),
          node.outDegree?.toString() || graph.getOutDegree(node.id).toString(),
          pos?.[0]?.toFixed(4) || '',
          pos?.[1]?.toFixed(4) || '',
          pos?.[2]?.toFixed(4) || '',
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      downloadFile(csv, `causal-nodes-${formatDate()}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  // Export edges as CSV
  const handleExportEdgesCsv = () => {
    setIsExporting(true);

    try {
      const edges = graph.getAllEdges();
      const headers = ['id', 'source', 'target', 'relation_type', 'confidence'];

      const rows = edges.map((edge) =>
        [
          escapeCSV(edge.id),
          escapeCSV(edge.source),
          escapeCSV(edge.target),
          escapeCSV(edge.relationType),
          edge.confidence?.toFixed(2) || '',
        ].join(',')
      );

      const csv = [headers.join(','), ...rows].join('\n');
      downloadFile(csv, `causal-edges-${formatDate()}.csv`, 'text/csv');
    } finally {
      setIsExporting(false);
    }
  };

  // Export as GraphML (XML format for graph tools)
  const handleExportGraphML = () => {
    setIsExporting(true);

    try {
      const nodes = graph.getAllNodes();
      const edges = graph.getAllEdges();

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="domain" for="node" attr.name="domain" attr.type="string"/>
  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>
  <key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>
  <graph id="causal-graph" edgedefault="directed">
`;

      for (const node of nodes) {
        xml += `    <node id="${escapeXML(node.id)}">
      <data key="label">${escapeXML(node.label)}</data>
      <data key="domain">${escapeXML(node.domain || '')}</data>
    </node>
`;
      }

      for (const edge of edges) {
        xml += `    <edge source="${escapeXML(edge.source)}" target="${escapeXML(edge.target)}">
      <data key="relationType">${escapeXML(edge.relationType)}</data>
      <data key="confidence">${edge.confidence || 1}</data>
    </edge>
`;
      }

      xml += `  </graph>
</graphml>`;

      downloadFile(xml, `causal-graph-${formatDate()}.graphml`, 'application/xml');
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasData) {
    return null;
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h4 className="text-sm font-medium text-gray-400 mb-3">Export Graph</h4>
      <div className="space-y-2">
        <button
          onClick={handleExportJson}
          disabled={isExporting}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Export JSON (Full)
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportNodesCsv}
            disabled={isExporting}
            className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Nodes CSV
          </button>
          <button
            onClick={handleExportEdgesCsv}
            disabled={isExporting}
            className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Edges CSV
          </button>
        </div>
        <button
          onClick={handleExportGraphML}
          disabled={isExporting}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          Export GraphML (for Gephi, yEd)
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {nodeCount} nodes, {edgeCount} edges
      </p>
    </div>
  );
}

// Helper functions
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0];
}
