'use client';

import { useState, useRef, useCallback } from 'react';
import { useGraphStore } from '@/stores/graphStore';
import { useEmbeddingStore } from '@/stores/embeddingStore';
import type { SerializedGraph, CausalNode, CausalEdge, RelationType, NodeType } from '@/types/graph';

type ImportMode = 'replace' | 'merge';

const VALID_RELATION_TYPES: RelationType[] = [
  'causes', 'enables', 'prevents', 'increases', 'decreases',
  'correlates_with', 'requires', 'produces', 'inhibits',
  'modulates', 'triggers', 'amplifies', 'mediates'
];

const VALID_NODE_TYPES: NodeType[] = ['concept', 'topic', 'question', 'statement'];

export function GraphImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGraph = useGraphStore((state) => state.loadGraph);
  const mergeGraph = useGraphStore((state) => state.mergeGraph);
  const setEmbeddings = useEmbeddingStore((state) => state.setEmbeddings);
  const setUMAP3D = useEmbeddingStore((state) => state.setUMAP3D);

  const handleImport = useCallback((nodes: CausalNode[], edges: CausalEdge[]) => {
    if (importMode === 'replace') {
      loadGraph({ nodes, edges });
    } else {
      mergeGraph({ nodes, edges });
    }

    // Extract and store embeddings/projections if present
    const embeddingsList: Array<{
      conceptId: string;
      label: string;
      domain?: string;
      vector: number[];
    }> = [];
    const projections = new Map<string, [number, number, number]>();

    for (const node of nodes) {
      if (node.embedding) {
        embeddingsList.push({
          conceptId: node.id,
          label: node.label,
          domain: node.domain,
          vector: node.embedding,
        });
      }
      if (node.umap3d) {
        projections.set(node.id, node.umap3d);
      }
    }

    if (embeddingsList.length > 0) {
      setEmbeddings(embeddingsList);
    }
    if (projections.size > 0) {
      setUMAP3D(projections);
    }

    setSuccess(`Imported ${nodes.length} nodes and ${edges.length} edges`);
    setTimeout(() => setSuccess(null), 3000);
  }, [importMode, loadGraph, mergeGraph, setEmbeddings, setUMAP3D]);

  // Parse JSON format (our native format)
  const parseJSON = useCallback((content: string): { nodes: CausalNode[]; edges: CausalEdge[] } => {
    const data = JSON.parse(content) as SerializedGraph;

    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error('Invalid JSON: missing nodes array');
    }
    if (!data.edges || !Array.isArray(data.edges)) {
      throw new Error('Invalid JSON: missing edges array');
    }

    // Validate and normalize nodes
    const nodes: CausalNode[] = data.nodes.map((n, i) => ({
      id: n.id || `node_${i}`,
      label: n.label || n.id || `Node ${i}`,
      type: VALID_NODE_TYPES.includes(n.type) ? n.type : 'concept',
      domain: n.domain,
      description: n.description,
      embedding: n.embedding,
      umap2d: n.umap2d,
      umap3d: n.umap3d,
      inDegree: n.inDegree,
      outDegree: n.outDegree,
      centrality: n.centrality,
      metadata: n.metadata,
    }));

    // Validate and normalize edges
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges: CausalEdge[] = data.edges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e, i) => ({
        id: e.id || `edge_${i}`,
        source: e.source,
        target: e.target,
        relationType: VALID_RELATION_TYPES.includes(e.relationType) ? e.relationType : 'causes',
        weight: e.weight,
        confidence: e.confidence,
        statementId: e.statementId,
        statementText: e.statementText,
        metadata: e.metadata,
      }));

    return { nodes, edges };
  }, []);

  // Parse CSV format (nodes or edges)
  const parseCSV = useCallback((content: string, type: 'nodes' | 'edges'): CausalNode[] | CausalEdge[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    if (type === 'nodes') {
      const idIdx = headers.indexOf('id');
      const labelIdx = headers.indexOf('label');
      const domainIdx = headers.indexOf('domain');
      const typeIdx = headers.indexOf('type');
      const umapXIdx = headers.indexOf('umap_x');
      const umapYIdx = headers.indexOf('umap_y');
      const umapZIdx = headers.indexOf('umap_z');

      if (idIdx === -1 && labelIdx === -1) {
        throw new Error('Nodes CSV must have "id" or "label" column');
      }

      return lines.slice(1).map((line, i) => {
        const values = parseRow(line);
        const id = idIdx !== -1 ? values[idIdx] : `node_${i}`;
        const label = labelIdx !== -1 ? values[labelIdx] : id;

        const node: CausalNode = {
          id,
          label,
          type: (typeIdx !== -1 && VALID_NODE_TYPES.includes(values[typeIdx] as NodeType))
            ? values[typeIdx] as NodeType
            : 'concept',
          domain: domainIdx !== -1 ? values[domainIdx] || undefined : undefined,
        };

        // Parse UMAP coordinates if present
        if (umapXIdx !== -1 && umapYIdx !== -1 && umapZIdx !== -1) {
          const x = parseFloat(values[umapXIdx]);
          const y = parseFloat(values[umapYIdx]);
          const z = parseFloat(values[umapZIdx]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            node.umap3d = [x, y, z];
          }
        }

        return node;
      });
    } else {
      const idIdx = headers.indexOf('id');
      const sourceIdx = headers.indexOf('source');
      const targetIdx = headers.indexOf('target');
      const relationIdx = headers.findIndex(h => h === 'relation_type' || h === 'relationtype' || h === 'relation');
      const confidenceIdx = headers.indexOf('confidence');

      if (sourceIdx === -1 || targetIdx === -1) {
        throw new Error('Edges CSV must have "source" and "target" columns');
      }

      return lines.slice(1).map((line, i) => {
        const values = parseRow(line);
        const relationType = relationIdx !== -1 ? values[relationIdx] : 'causes';

        return {
          id: idIdx !== -1 ? values[idIdx] : `edge_${i}`,
          source: values[sourceIdx],
          target: values[targetIdx],
          relationType: VALID_RELATION_TYPES.includes(relationType as RelationType)
            ? relationType as RelationType
            : 'causes',
          confidence: confidenceIdx !== -1 ? parseFloat(values[confidenceIdx]) || undefined : undefined,
        } as CausalEdge;
      });
    }
  }, []);

  // Parse GraphML format
  const parseGraphML = useCallback((content: string): { nodes: CausalNode[]; edges: CausalEdge[] } => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid GraphML: ' + parseError.textContent);
    }

    const graphml = doc.querySelector('graphml');
    if (!graphml) {
      throw new Error('Invalid GraphML: missing graphml element');
    }

    // Parse key definitions
    const keys = new Map<string, { for: string; name: string }>();
    doc.querySelectorAll('key').forEach(key => {
      const id = key.getAttribute('id');
      const forAttr = key.getAttribute('for');
      const name = key.getAttribute('attr.name');
      if (id && forAttr && name) {
        keys.set(id, { for: forAttr, name });
      }
    });

    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // Parse nodes
    doc.querySelectorAll('node').forEach((nodeEl, i) => {
      const id = nodeEl.getAttribute('id') || `node_${i}`;
      const dataMap = new Map<string, string>();

      nodeEl.querySelectorAll('data').forEach(data => {
        const keyId = data.getAttribute('key');
        if (keyId && keys.has(keyId)) {
          const keyDef = keys.get(keyId)!;
          dataMap.set(keyDef.name, data.textContent || '');
        }
      });

      nodes.push({
        id,
        label: dataMap.get('label') || id,
        type: VALID_NODE_TYPES.includes(dataMap.get('type') as NodeType)
          ? dataMap.get('type') as NodeType
          : 'concept',
        domain: dataMap.get('domain') || undefined,
      });
    });

    // Parse edges
    doc.querySelectorAll('edge').forEach((edgeEl, i) => {
      const source = edgeEl.getAttribute('source');
      const target = edgeEl.getAttribute('target');

      if (!source || !target) return;

      const dataMap = new Map<string, string>();
      edgeEl.querySelectorAll('data').forEach(data => {
        const keyId = data.getAttribute('key');
        if (keyId && keys.has(keyId)) {
          const keyDef = keys.get(keyId)!;
          dataMap.set(keyDef.name, data.textContent || '');
        }
      });

      const relationType = dataMap.get('relationType') || 'causes';
      const confidence = parseFloat(dataMap.get('confidence') || '1');

      edges.push({
        id: `edge_${i}`,
        source,
        target,
        relationType: VALID_RELATION_TYPES.includes(relationType as RelationType)
          ? relationType as RelationType
          : 'causes',
        confidence: isNaN(confidence) ? undefined : confidence,
      });
    });

    return { nodes, edges };
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if we have multiple CSV files (nodes + edges)
      const fileArray = Array.from(files);
      const csvFiles = fileArray.filter(f => f.name.endsWith('.csv'));

      if (csvFiles.length === 2) {
        // Import paired CSV files
        const nodesFile = csvFiles.find(f => f.name.toLowerCase().includes('node'));
        const edgesFile = csvFiles.find(f => f.name.toLowerCase().includes('edge'));

        if (!nodesFile || !edgesFile) {
          throw new Error('For CSV import, please select files named with "node" and "edge" in the filenames');
        }

        const nodesContent = await nodesFile.text();
        const edgesContent = await edgesFile.text();

        const nodes = parseCSV(nodesContent, 'nodes') as CausalNode[];
        const edges = parseCSV(edgesContent, 'edges') as CausalEdge[];

        handleImport(nodes, edges);
      } else if (files.length === 1) {
        const file = files[0];
        const content = await file.text();

        if (file.name.endsWith('.json')) {
          const { nodes, edges } = parseJSON(content);
          handleImport(nodes, edges);
        } else if (file.name.endsWith('.graphml') || file.name.endsWith('.xml')) {
          const { nodes, edges } = parseGraphML(content);
          handleImport(nodes, edges);
        } else if (file.name.endsWith('.csv')) {
          throw new Error('For CSV import, please select both nodes and edges CSV files');
        } else {
          throw new Error('Unsupported file format. Use JSON, GraphML, or CSV files.');
        }
      } else {
        throw new Error('Please select a single JSON/GraphML file, or two CSV files (nodes + edges)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import graph');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [parseJSON, parseCSV, parseGraphML, handleImport]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h4 className="text-sm font-medium text-gray-400 mb-3">Import Graph</h4>

      {/* Import Mode Toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setImportMode('replace')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            importMode === 'replace'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Replace
        </button>
        <button
          onClick={() => setImportMode('merge')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            importMode === 'merge'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Merge
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.graphml,.xml,.csv"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Import Button */}
      <button
        onClick={triggerFileSelect}
        disabled={isImporting}
        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isImporting ? 'Importing...' : 'Select Files to Import'}
      </button>

      {/* Format hints */}
      <p className="text-xs text-gray-500 mt-2">
        Supports: JSON, GraphML, CSV (nodes + edges)
      </p>

      {/* Success message */}
      {success && (
        <div className="mt-2 p-2 bg-green-900/30 border border-green-800 rounded text-green-400 text-xs">
          {success}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
