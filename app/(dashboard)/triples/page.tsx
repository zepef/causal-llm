'use client';

import { useState } from 'react';

interface Triple {
  id: string;
  source: string;
  relation: string;
  target: string;
  confidence: number;
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

export default function TriplesPage() {
  const [statement, setStatement] = useState('');
  const [triples, setTriples] = useState<Triple[]>([]);
  const [concepts, setConcepts] = useState<{ name: string; normalized: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractTriples = async () => {
    if (!statement.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/llm/triples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: statement.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract triples');
      }

      const data = await response.json();
      setTriples(data.triples);
      setConcepts(data.concepts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Triple Extractor</h2>
        <p className="text-gray-400 text-sm">
          Extract structured triples from causal statements. Each triple has the form: (source, relation, target).
        </p>
      </div>

      {/* Input Form */}
      <div className="mb-8">
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Enter a causal statement..."
          className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={extractTriples}
            disabled={isLoading || !statement.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Extracting...' : 'Extract Triples'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {triples.length > 0 && (
        <div className="space-y-6">
          {/* Triples */}
          <div>
            <h3 className="font-semibold mb-4">Extracted Triples ({triples.length})</h3>
            <div className="space-y-3">
              {triples.map((triple) => (
                <div
                  key={triple.id}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex items-center gap-3"
                >
                  {/* Source */}
                  <div className="flex-1 text-right">
                    <span className="px-3 py-1.5 bg-gray-800 rounded-lg text-white inline-block">
                      {triple.source}
                    </span>
                  </div>

                  {/* Relation Arrow */}
                  <div className="flex items-center gap-2 px-4">
                    <div className="w-8 h-0.5 bg-gray-700" />
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium text-white ${
                        relationColors[triple.relation] || 'bg-gray-600'
                      }`}
                    >
                      {triple.relation}
                    </span>
                    <div className="w-8 h-0.5 bg-gray-700" />
                    <div className="text-gray-500">→</div>
                  </div>

                  {/* Target */}
                  <div className="flex-1">
                    <span className="px-3 py-1.5 bg-gray-800 rounded-lg text-white inline-block">
                      {triple.target}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="text-xs text-gray-500 w-16 text-right">
                    {(triple.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts */}
          <div>
            <h3 className="font-semibold mb-3">Extracted Concepts ({concepts.length})</h3>
            <div className="flex flex-wrap gap-2">
              {concepts.map((concept, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg text-sm border border-blue-800"
                >
                  {concept.name}
                </span>
              ))}
            </div>
          </div>

          {/* Relation Types Legend */}
          <div>
            <h3 className="font-semibold mb-3">Relation Types</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(relationColors).map(([relation, color]) => (
                <span
                  key={relation}
                  className={`px-2 py-1 rounded text-xs font-medium text-white ${color}`}
                >
                  {relation}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {triples.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🔗</div>
          <p>Enter a causal statement above to extract triples</p>
        </div>
      )}

      {/* Example Statements */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Example Statements</h3>
        <div className="space-y-2">
          {[
            'Reduced monsoon rainfall decreases river discharge, which affects agricultural productivity.',
            'Chronic stress increases cortisol levels, leading to weakened immune function.',
            'Higher minimum wage enables workers to afford better housing and healthcare.',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setStatement(example)}
              className="block w-full text-left px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
