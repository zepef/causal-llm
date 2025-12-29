'use client';

import { useState, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import { BatchProgress } from '@/components/ui/BatchProgress';
import type { CausalTriple, CausalStatement, RelationType } from '@/types/graph';

interface ExtractedTriple extends CausalTriple {
  id: string;
  statementId?: string;
  statementText?: string;
}

interface ExtractedConcept {
  name: string;
  normalized: string;
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

const relationLabels: Record<string, string> = {
  causes: 'Causes',
  enables: 'Enables',
  prevents: 'Prevents',
  increases: 'Increases',
  decreases: 'Decreases',
  correlates_with: 'Correlates',
  requires: 'Requires',
  produces: 'Produces',
  inhibits: 'Inhibits',
  modulates: 'Modulates',
  triggers: 'Triggers',
  amplifies: 'Amplifies',
  mediates: 'Mediates',
};

export default function TriplesPage() {
  const [manualStatement, setManualStatement] = useState('');
  const [selectedStatementIds, setSelectedStatementIds] = useState<Set<string>>(new Set());
  const [triples, setTriples] = useState<ExtractedTriple[]>([]);
  const [concepts, setConcepts] = useState<ExtractedConcept[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [extractingStatementId, setExtractingStatementId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterRelation, setFilterRelation] = useState<RelationType | null>(null);

  // Pipeline store
  const pipelineStatements = usePipelineStore((state) => state.statements);
  const pipelineTriples = usePipelineStore((state) => state.triples);
  const addTriples = usePipelineStore((state) => state.addTriples);

  // Settings store - get API key
  const anthropicApiKey = useSettingsStore((state) => state.anthropicApiKey);

  // Batch processor
  const { progress: batchProgress, processBatch, abort: abortBatch, isRunning: isBatchRunning } = useBatchProcessor<CausalStatement, { triples: ExtractedTriple[]; concepts: ExtractedConcept[] }>();

  // Extract triples for a single statement
  const extractTriplesForStatement = useCallback(async (
    statementText: string,
    statementId: string
  ): Promise<{ triples: ExtractedTriple[]; concepts: ExtractedConcept[] }> => {
    const response = await fetch('/api/llm/triples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statement: statementText,
        statementId,
        apiKey: anthropicApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to extract triples');
    }

    const data = await response.json();
    const extractedTriples = data.triples.map((t: {
      id: string;
      source: string;
      relation: RelationType;
      target: string;
      confidence: number;
    }) => ({
      id: t.id,
      source: t.source,
      relation: t.relation,
      target: t.target,
      confidence: t.confidence,
      statementId,
      statementText,
    }));

    return {
      triples: extractedTriples,
      concepts: data.concepts,
    };
  }, [anthropicApiKey]);

  // Handle manual statement submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStatement.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await extractTriplesForStatement(
        manualStatement.trim(),
        `manual-${Date.now()}`
      );
      setTriples(prev => [...prev, ...result.triples]);
      setConcepts(prev => {
        const existing = new Set(prev.map(c => c.normalized));
        const newConcepts = result.concepts.filter(c => !existing.has(c.normalized));
        return [...prev, ...newConcepts];
      });
      addTriples(result.triples.map(t => ({
        source: t.source,
        relation: t.relation,
        target: t.target,
        confidence: t.confidence,
      })));
      setManualStatement('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Extract triples for a pipeline statement
  const handleExtractForStatement = async (statementId: string, statementText: string) => {
    setExtractingStatementId(statementId);
    setError(null);

    try {
      const result = await extractTriplesForStatement(statementText, statementId);
      setTriples(prev => [...prev, ...result.triples]);
      setConcepts(prev => {
        const existing = new Set(prev.map(c => c.normalized));
        const newConcepts = result.concepts.filter(c => !existing.has(c.normalized));
        return [...prev, ...newConcepts];
      });
      addTriples(result.triples.map(t => ({
        source: t.source,
        relation: t.relation,
        target: t.target,
        confidence: t.confidence,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract triples');
    } finally {
      setExtractingStatementId(null);
    }
  };

  // Extract triples for all selected statements
  const handleExtractForSelected = async () => {
    if (selectedStatementIds.size === 0) return;

    setIsLoading(true);
    setError(null);

    const selectedStatements = pipelineStatements.filter(s => selectedStatementIds.has(s.id));

    for (const statement of selectedStatements) {
      try {
        setExtractingStatementId(statement.id);
        const result = await extractTriplesForStatement(statement.text, statement.id);
        setTriples(prev => [...prev, ...result.triples]);
        setConcepts(prev => {
          const existing = new Set(prev.map(c => c.normalized));
          const newConcepts = result.concepts.filter(c => !existing.has(c.normalized));
          return [...prev, ...newConcepts];
        });
        addTriples(result.triples.map(t => ({
          source: t.source,
          relation: t.relation,
          target: t.target,
          confidence: t.confidence,
        })));
      } catch (err) {
        console.error(`Failed to extract for statement:`, err);
      }
    }

    setExtractingStatementId(null);
    setIsLoading(false);
    setSelectedStatementIds(new Set());
  };

  // Generate triples for all statements without triples (batch)
  const handleGenerateForAll = async () => {
    const statementsWithoutTriples = pipelineStatements.filter(
      (s) => !triples.some((t) => t.statementId === s.id)
    );

    if (statementsWithoutTriples.length === 0) return;

    await processBatch({
      items: statementsWithoutTriples,
      processor: async (statement) => {
        return extractTriplesForStatement(statement.text, statement.id);
      },
      onItemComplete: (statement, result) => {
        setTriples((prev) => [...prev, ...result.triples]);
        setConcepts((prev) => {
          const existing = new Set(prev.map((c) => c.normalized));
          const newConcepts = result.concepts.filter((c) => !existing.has(c.normalized));
          return [...prev, ...newConcepts];
        });
        addTriples(
          result.triples.map((t) => ({
            source: t.source,
            relation: t.relation,
            target: t.target,
            confidence: t.confidence,
          }))
        );
      },
      getItemLabel: (statement) => statement.text.slice(0, 50) + '...',
      delayBetweenItems: 1000,
    });
  };

  // Toggle statement selection
  const toggleStatementSelection = (statementId: string) => {
    setSelectedStatementIds(prev => {
      const next = new Set(prev);
      if (next.has(statementId)) {
        next.delete(statementId);
      } else {
        next.add(statementId);
      }
      return next;
    });
  };

  // Select all statements
  const selectAllStatements = () => {
    setSelectedStatementIds(new Set(pipelineStatements.map(s => s.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedStatementIds(new Set());
  };

  // Filter triples by relation type
  const filteredTriples = filterRelation
    ? triples.filter(t => t.relation === filterRelation)
    : triples;

  // Count triples by relation type
  const relationCounts = triples.reduce((acc, t) => {
    acc[t.relation] = (acc[t.relation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Triple Extractor</h2>
        <p className="text-gray-400 text-sm">
          Extract structured triples from causal statements. Each triple has the form: (source, relation, target).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Statement Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Manual Statement Input */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Manual Statement</h3>
            <form onSubmit={handleManualSubmit}>
              <textarea
                value={manualStatement}
                onChange={(e) => setManualStatement(e.target.value)}
                placeholder="Enter a causal statement..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                rows={4}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !manualStatement.trim()}
                className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading && !extractingStatementId ? 'Extracting...' : 'Extract Triples'}
              </button>
            </form>
          </div>

          {/* Pipeline Statements */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Pipeline Statements</h3>
              <span className="text-xs text-gray-500">{pipelineStatements.length} statements</span>
            </div>

            {/* Batch Progress */}
            {(isBatchRunning || batchProgress.total > 0) && (
              <div className="mb-3">
                <BatchProgress progress={batchProgress} onCancel={abortBatch} />
              </div>
            )}

            {pipelineStatements.length > 0 ? (
              <>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button
                    onClick={selectAllStatements}
                    className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleGenerateForAll}
                    disabled={isBatchRunning || pipelineStatements.every((s) => triples.some((t) => t.statementId === s.id))}
                    className="text-xs px-2 py-1 bg-purple-600/30 text-purple-400 rounded hover:bg-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBatchRunning ? 'Processing...' : 'Generate All'}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {pipelineStatements.map(statement => {
                    const isSelected = selectedStatementIds.has(statement.id);
                    const isExtracting = extractingStatementId === statement.id;
                    const hasTriples = triples.some(t => t.statementId === statement.id);

                    return (
                      <div
                        key={statement.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-gray-800'
                        }`}
                        onClick={() => toggleStatementSelection(statement.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded bg-gray-700 border-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white line-clamp-2">{statement.text}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(statement.confidence * 100).toFixed(0)}% confidence
                          </p>
                        </div>
                        {!hasTriples && !isExtracting && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExtractForStatement(statement.id, statement.text);
                            }}
                            className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50 shrink-0"
                          >
                            Extract
                          </button>
                        )}
                        {hasTriples && (
                          <span className="text-xs text-green-400 shrink-0">✓</span>
                        )}
                        {isExtracting && (
                          <span className="text-xs text-blue-400 animate-spin shrink-0">⟳</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedStatementIds.size > 0 && (
                  <button
                    onClick={handleExtractForSelected}
                    disabled={isLoading}
                    className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    Extract from {selectedStatementIds.size} Statement{selectedStatementIds.size > 1 ? 's' : ''}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No statements in pipeline.<br />
                <span className="text-xs">Go to Statements page to generate statements first.</span>
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{triples.length}</div>
                <div className="text-xs text-gray-500">Triples</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{concepts.length}</div>
                <div className="text-xs text-gray-500">Concepts</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{pipelineTriples.length}</div>
                <div className="text-xs text-gray-500">In Pipeline</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{Object.keys(relationCounts).length}</div>
                <div className="text-xs text-gray-500">Relation Types</div>
              </div>
            </div>
          </div>

          {/* Concepts */}
          {concepts.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium mb-3">Extracted Concepts ({concepts.length})</h3>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {concepts.map((concept, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs border border-blue-800"
                  >
                    {concept.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Triples List */}
        <div className="lg:col-span-2">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 flex items-start gap-2">
              <span>⚠</span>
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Triples */}
          {triples.length > 0 ? (
            <div className="space-y-4">
              {/* Header with filters */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold">Extracted Triples ({filteredTriples.length})</h3>
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setFilterRelation(null)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filterRelation === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    All ({triples.length})
                  </button>
                  {Object.entries(relationCounts).map(([relation, count]) => (
                    <button
                      key={relation}
                      onClick={() => setFilterRelation(filterRelation === relation ? null : relation as RelationType)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filterRelation === relation
                          ? `${relationColors[relation]} text-white`
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {relationLabels[relation] || relation} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Triple Cards */}
              <div className="space-y-3">
                {filteredTriples.map((triple) => (
                  <div
                    key={triple.id}
                    className="bg-gray-900 rounded-lg p-4 border border-gray-800"
                  >
                    {/* Triple visualization */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Source */}
                      <div className="flex-1 min-w-[120px]">
                        <span className="px-3 py-2 bg-gray-800 rounded-lg text-white inline-block w-full text-center">
                          {triple.source}
                        </span>
                      </div>

                      {/* Relation Arrow */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-6 h-0.5 bg-gray-700" />
                        <span
                          className={`px-3 py-1.5 rounded text-xs font-medium text-white ${
                            relationColors[triple.relation] || 'bg-gray-600'
                          }`}
                        >
                          {triple.relation}
                        </span>
                        <div className="w-6 h-0.5 bg-gray-700" />
                        <span className="text-gray-500 text-lg">→</span>
                      </div>

                      {/* Target */}
                      <div className="flex-1 min-w-[120px]">
                        <span className="px-3 py-2 bg-gray-800 rounded-lg text-white inline-block w-full text-center">
                          {triple.target}
                        </span>
                      </div>

                      {/* Confidence */}
                      <div className={`text-sm font-mono shrink-0 ${getConfidenceColor(triple.confidence || 0)}`}>
                        {((triple.confidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Source statement */}
                    {triple.statementText && (
                      <p className="text-xs text-gray-500 mt-3 line-clamp-1">
                        From: {triple.statementText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">
              <div className="text-5xl mb-4">🔗</div>
              <p className="text-lg">No triples extracted yet</p>
              <p className="text-sm mt-2">
                Select statements from the pipeline or enter a statement manually
              </p>
            </div>
          )}

          {/* Relation Types Legend */}
          {triples.length > 0 && (
            <div className="mt-6 bg-gray-900 rounded-lg p-4 border border-gray-800">
              <h3 className="font-medium mb-3">Relation Types</h3>
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
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <h4 className="text-sm font-medium text-gray-300 mb-2">How it works</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Select statements from the pipeline (generated in Statements page) or enter manually</li>
          <li>Click &quot;Extract Triples&quot; to parse causal relationships</li>
          <li>Each triple has the form: (source concept) → [relation] → (target concept)</li>
          <li>Concepts are normalized for consistency across the graph</li>
          <li>Triples are saved to the pipeline for graph construction and embedding</li>
        </ol>
      </div>
    </div>
  );
}
