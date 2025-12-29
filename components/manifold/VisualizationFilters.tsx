'use client';

// DEMOCRITUS - Visualization Filters Component
// Filter graph elements by domain, relation type, and confidence

import { useState, useMemo, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useGraphStore } from '@/stores/graphStore';
import type { RelationType } from '@/types/graph';

interface FilterState {
  domains: Set<string>;
  relations: Set<string>;
  minConfidence: number;
}

interface VisualizationFiltersProps {
  onFiltersChange?: (filters: FilterState) => void;
}

const relationColors: Record<string, string> = {
  causes: 'bg-red-600',
  enables: 'bg-green-600',
  prevents: 'bg-orange-600',
  increases: 'bg-blue-600',
  decreases: 'bg-purple-600',
  correlates_with: 'bg-gray-600',
  requires: 'bg-teal-600',
  produces: 'bg-yellow-600',
  inhibits: 'bg-pink-600',
  modulates: 'bg-indigo-600',
  triggers: 'bg-cyan-600',
  amplifies: 'bg-lime-600',
  mediates: 'bg-amber-600',
};

const domainColors: Record<string, string> = {
  climate: 'bg-green-500',
  medicine: 'bg-red-500',
  economics: 'bg-yellow-500',
  biology: 'bg-emerald-500',
  psychology: 'bg-purple-500',
  sociology: 'bg-orange-500',
  physics: 'bg-blue-500',
  default: 'bg-gray-500',
};

export function VisualizationFilters({ onFiltersChange }: VisualizationFiltersProps) {
  const [expandedSection, setExpandedSection] = useState<'domains' | 'relations' | 'confidence' | null>('relations');

  // Graph store for filtering
  const graph = useGraphStore((state) => state.graph);
  const filteredNodeIds = useGraphStore((state) => state.filteredNodeIds);
  const filteredEdgeIds = useGraphStore((state) => state.filteredEdgeIds);
  const setFilteredNodeIds = useGraphStore((state) => state.setFilteredNodeIds);
  const setFilteredEdgeIds = useGraphStore((state) => state.setFilteredEdgeIds);

  // Pipeline data
  const triples = usePipelineStore((state) => state.triples);

  // Extract unique domains and relations
  const { domains, relations } = useMemo(() => {
    const domainSet = new Set<string>();
    const relationSet = new Set<string>();

    graph.getAllNodes().forEach((node) => {
      if (node.domain) domainSet.add(node.domain);
    });

    graph.getAllEdges().forEach((edge) => {
      relationSet.add(edge.relationType);
    });

    return {
      domains: Array.from(domainSet).sort(),
      relations: Array.from(relationSet).sort(),
    };
  }, [graph]);

  // Filter state
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set(domains));
  const [selectedRelations, setSelectedRelations] = useState<Set<string>>(new Set(relations));
  const [minConfidence, setMinConfidence] = useState(0);

  // Update filters when selections change
  const applyFilters = useCallback(() => {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    // Filter nodes by domain
    const visibleNodeIds = new Set<string>();
    nodes.forEach((node) => {
      if (!node.domain || selectedDomains.has(node.domain)) {
        visibleNodeIds.add(node.id);
      }
    });

    // Filter edges by relation type and confidence
    const visibleEdgeIds = new Set<string>();
    edges.forEach((edge) => {
      const relationMatch = selectedRelations.has(edge.relationType);
      const confidenceMatch = (edge.confidence || 1) >= minConfidence;
      const nodeMatch = visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);

      if (relationMatch && confidenceMatch && nodeMatch) {
        visibleEdgeIds.add(edge.id);
      }
    });

    setFilteredNodeIds(visibleNodeIds);
    setFilteredEdgeIds(visibleEdgeIds);

    onFiltersChange?.({
      domains: selectedDomains,
      relations: selectedRelations,
      minConfidence,
    });
  }, [graph, selectedDomains, selectedRelations, minConfidence, setFilteredNodeIds, setFilteredEdgeIds, onFiltersChange]);

  // Toggle domain
  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Toggle relation
  const toggleRelation = (relation: string) => {
    setSelectedRelations((prev) => {
      const next = new Set(prev);
      if (next.has(relation)) {
        next.delete(relation);
      } else {
        next.add(relation);
      }
      return next;
    });
  };

  // Select all / none helpers
  const selectAllDomains = () => setSelectedDomains(new Set(domains));
  const selectNoDomains = () => setSelectedDomains(new Set());
  const selectAllRelations = () => setSelectedRelations(new Set(relations));
  const selectNoRelations = () => setSelectedRelations(new Set());

  // Reset filters
  const resetFilters = () => {
    setSelectedDomains(new Set(domains));
    setSelectedRelations(new Set(relations));
    setMinConfidence(0);
    setFilteredNodeIds(null);
    setFilteredEdgeIds(null);
  };

  if (domains.length === 0 && relations.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h3 className="font-semibold text-white mb-2">Filters</h3>
        <p className="text-sm text-gray-500">Load graph data to enable filtering</p>
      </div>
    );
  }

  const activeFilters =
    selectedDomains.size < domains.length ||
    selectedRelations.size < relations.length ||
    minConfidence > 0;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Filters</h3>
        {activeFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Reset
          </button>
        )}
      </div>

      {/* Domains Section */}
      {domains.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedSection(expandedSection === 'domains' ? null : 'domains')}
            className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white"
          >
            <span>
              Domains ({selectedDomains.size}/{domains.length})
            </span>
            <span>{expandedSection === 'domains' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'domains' && (
            <div className="space-y-1 pl-2">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={selectAllDomains}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  All
                </button>
                <button
                  onClick={selectNoDomains}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  None
                </button>
              </div>
              {domains.map((domain) => (
                <label key={domain} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDomains.has(domain)}
                    onChange={() => toggleDomain(domain)}
                    className="w-3 h-3 rounded"
                  />
                  <span
                    className={`w-2 h-2 rounded-full ${domainColors[domain] || domainColors.default}`}
                  />
                  <span className="text-xs text-gray-300 capitalize">{domain}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relations Section */}
      {relations.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setExpandedSection(expandedSection === 'relations' ? null : 'relations')}
            className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white"
          >
            <span>
              Relations ({selectedRelations.size}/{relations.length})
            </span>
            <span>{expandedSection === 'relations' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'relations' && (
            <div className="space-y-1 pl-2">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={selectAllRelations}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  All
                </button>
                <button
                  onClick={selectNoRelations}
                  className="text-xs text-gray-500 hover:text-white"
                >
                  None
                </button>
              </div>
              {relations.map((relation) => (
                <label key={relation} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRelations.has(relation)}
                    onChange={() => toggleRelation(relation)}
                    className="w-3 h-3 rounded"
                  />
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs text-white ${
                      relationColors[relation] || 'bg-gray-600'
                    }`}
                  >
                    {relation}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confidence Section */}
      <div className="space-y-2">
        <button
          onClick={() => setExpandedSection(expandedSection === 'confidence' ? null : 'confidence')}
          className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-white"
        >
          <span>Confidence {minConfidence > 0 ? `(≥${(minConfidence * 100).toFixed(0)}%)` : ''}</span>
          <span>{expandedSection === 'confidence' ? '▼' : '▶'}</span>
        </button>

        {expandedSection === 'confidence' && (
          <div className="pl-2">
            <label className="text-xs text-gray-500 flex justify-between mb-1">
              <span>Minimum Confidence</span>
              <span>{(minConfidence * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>All</span>
              <span>High only</span>
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <button
        onClick={applyFilters}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        Apply Filters
      </button>

      {/* Filter Status */}
      {activeFilters && (
        <div className="text-xs text-gray-500 text-center">
          Showing {filteredNodeIds?.size ?? graph.getNodeCount()} nodes,{' '}
          {filteredEdgeIds?.size ?? graph.getEdgeCount()} edges
        </div>
      )}
    </div>
  );
}
