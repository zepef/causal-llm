'use client';

// DEMOCRITUS - Graph Search Component
// Search through concepts and triples

import { useState, useMemo } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { CausalTriple } from '@/types/graph';

interface SearchResult {
  type: 'concept' | 'triple';
  text: string;
  metadata?: {
    relation?: string;
    confidence?: number;
    source?: string;
    target?: string;
  };
}

interface GraphSearchProps {
  onSelectConcept?: (concept: string) => void;
  onSelectTriple?: (triple: CausalTriple) => void;
  compact?: boolean;
}

export function GraphSearch({ onSelectConcept, onSelectTriple, compact = false }: GraphSearchProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'concepts' | 'triples'>('all');

  // Pipeline data
  const triples = usePipelineStore((s) => s.triples);

  // Extract unique concepts from triples
  const concepts = useMemo(() => {
    const conceptSet = new Set<string>();
    triples.forEach((t) => {
      conceptSet.add(t.source);
      conceptSet.add(t.target);
    });
    return Array.from(conceptSet).sort();
  }, [triples]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchQuery = query.toLowerCase();
    const matches: SearchResult[] = [];

    // Search concepts
    if (searchType === 'all' || searchType === 'concepts') {
      concepts
        .filter((c) => c.toLowerCase().includes(searchQuery))
        .forEach((c) => {
          matches.push({
            type: 'concept',
            text: c,
          });
        });
    }

    // Search triples
    if (searchType === 'all' || searchType === 'triples') {
      triples
        .filter(
          (t) =>
            t.source.toLowerCase().includes(searchQuery) ||
            t.target.toLowerCase().includes(searchQuery) ||
            t.relation.toLowerCase().includes(searchQuery)
        )
        .forEach((t) => {
          matches.push({
            type: 'triple',
            text: `${t.source} → ${t.relation} → ${t.target}`,
            metadata: {
              relation: t.relation,
              confidence: t.confidence,
              source: t.source,
              target: t.target,
            },
          });
        });
    }

    return matches.slice(0, 20); // Limit results
  }, [query, searchType, concepts, triples]);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'concept' && onSelectConcept) {
      onSelectConcept(result.text);
    } else if (result.type === 'triple' && onSelectTriple && result.metadata) {
      onSelectTriple({
        source: result.metadata.source!,
        relation: result.metadata.relation! as CausalTriple['relation'],
        target: result.metadata.target!,
        confidence: result.metadata.confidence,
      });
    }
  };

  if (concepts.length === 0 && triples.length === 0) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-gray-800/50 rounded-lg text-center text-gray-500 text-sm`}>
        No data to search. Run the pipeline first.
      </div>
    );
  }

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts and triples..."
          className={`w-full bg-gray-800 border border-gray-700 rounded-lg ${
            compact ? 'px-3 py-2 text-sm' : 'px-4 py-3'
          } text-white placeholder-gray-500 focus:outline-none focus:border-blue-500`}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* Search Type Tabs */}
      <div className="flex gap-1">
        {(['all', 'concepts', 'triples'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSearchType(type)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              searchType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            {type === 'concepts' && ` (${concepts.length})`}
            {type === 'triples' && ` (${triples.length})`}
          </button>
        ))}
      </div>

      {/* Results */}
      {query && (
        <div className={`${compact ? 'max-h-48' : 'max-h-64'} overflow-y-auto space-y-1`}>
          {results.length > 0 ? (
            results.map((result, i) => (
              <button
                key={i}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      result.type === 'concept'
                        ? 'bg-blue-900 text-blue-400'
                        : 'bg-green-900 text-green-400'
                    }`}
                  >
                    {result.type}
                  </span>
                  <span className="text-sm text-white truncate flex-1">{result.text}</span>
                  {result.metadata?.confidence && (
                    <span className="text-xs text-gray-500">
                      {(result.metadata.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No results found</p>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {!query && !compact && (
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-lg font-bold text-white">{concepts.length}</div>
            <div className="text-gray-500">Unique Concepts</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2">
            <div className="text-lg font-bold text-white">{triples.length}</div>
            <div className="text-gray-500">Triples</div>
          </div>
        </div>
      )}
    </div>
  );
}
