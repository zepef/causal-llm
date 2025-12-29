'use client';

import { useMemo } from 'react';
import { useGraphStore } from '@/stores/graphStore';

const DOMAIN_COLORS: Record<string, string> = {
  archaeology: '#f59e0b',
  biology: '#22c55e',
  climate: '#3b82f6',
  economics: '#8b5cf6',
  medicine: '#ef4444',
  physics: '#06b6d4',
  psychology: '#ec4899',
  sociology: '#f97316',
  default: '#6b7280',
};

const RELATION_COLORS: Record<string, string> = {
  causes: '#ef4444',
  enables: '#22c55e',
  prevents: '#f97316',
  increases: '#3b82f6',
  decreases: '#8b5cf6',
  correlates_with: '#6b7280',
  requires: '#14b8a6',
  produces: '#eab308',
  inhibits: '#ec4899',
};

interface DomainLegendProps {
  showDomains?: boolean;
  showRelations?: boolean;
}

export function DomainLegend({
  showDomains = true,
  showRelations = true,
}: DomainLegendProps) {
  const graph = useGraphStore((state) => state.graph);
  const setDomainFilter = useGraphStore((state) => state.setDomainFilter);
  const setRelationFilter = useGraphStore((state) => state.setRelationFilter);
  const filterByDomain = useGraphStore((state) => state.filterByDomain);
  const filterByRelationType = useGraphStore((state) => state.filterByRelationType);

  // Get unique domains and relation types from current graph
  const { domains, relationTypes } = useMemo(() => {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    const domainCounts = new Map<string, number>();
    const relationCounts = new Map<string, number>();

    for (const node of nodes) {
      const domain = node.domain || 'default';
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }

    for (const edge of edges) {
      relationCounts.set(
        edge.relationType,
        (relationCounts.get(edge.relationType) || 0) + 1
      );
    }

    return {
      domains: Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]),
      relationTypes: Array.from(relationCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [graph]);

  const handleDomainClick = (domain: string) => {
    if (filterByDomain === domain) {
      setDomainFilter(null);
    } else {
      setDomainFilter(domain);
    }
  };

  const handleRelationClick = (relation: string) => {
    if (filterByRelationType === relation) {
      setRelationFilter(null);
    } else {
      setRelationFilter(relation as typeof filterByRelationType);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
      {/* Domain Legend */}
      {showDomains && domains.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Domains</h4>
          <div className="flex flex-wrap gap-2">
            {domains.map(([domain, count]) => (
              <button
                key={domain}
                onClick={() => handleDomainClick(domain)}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all
                  ${
                    filterByDomain === domain
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                      : 'hover:opacity-80'
                  }
                `}
                style={{
                  backgroundColor: `${DOMAIN_COLORS[domain] || DOMAIN_COLORS.default}20`,
                  color: DOMAIN_COLORS[domain] || DOMAIN_COLORS.default,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: DOMAIN_COLORS[domain] || DOMAIN_COLORS.default,
                  }}
                />
                <span className="capitalize">{domain}</span>
                <span className="text-gray-500">({count})</span>
              </button>
            ))}
          </div>
          {filterByDomain && (
            <button
              onClick={() => setDomainFilter(null)}
              className="mt-2 text-xs text-gray-500 hover:text-white"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Relation Type Legend */}
      {showRelations && relationTypes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Relations</h4>
          <div className="flex flex-wrap gap-2">
            {relationTypes.map(([relation, count]) => (
              <button
                key={relation}
                onClick={() => handleRelationClick(relation)}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all
                  ${
                    filterByRelationType === relation
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                      : 'hover:opacity-80'
                  }
                `}
                style={{
                  backgroundColor: `${RELATION_COLORS[relation] || '#6b7280'}20`,
                  color: RELATION_COLORS[relation] || '#6b7280',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: RELATION_COLORS[relation] || '#6b7280',
                  }}
                />
                <span>{relation}</span>
                <span className="text-gray-500">({count})</span>
              </button>
            ))}
          </div>
          {filterByRelationType && (
            <button
              onClick={() => setRelationFilter(null)}
              className="mt-2 text-xs text-gray-500 hover:text-white"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {domains.length === 0 && relationTypes.length === 0 && (
        <div className="text-center text-gray-500 py-4 text-sm">
          No data loaded
        </div>
      )}
    </div>
  );
}
