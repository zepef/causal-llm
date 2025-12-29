'use client';

import { useState, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { CausalStatement } from '@/types/graph';

const confidenceColors: Record<string, string> = {
  high: 'bg-green-900/30 text-green-400 border-green-800',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  low: 'bg-red-900/30 text-red-400 border-red-800',
};

const getConfidenceLevel = (confidence: number): string => {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
};

export default function StatementsPage() {
  const [manualQuestion, setManualQuestion] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [statements, setStatements] = useState<CausalStatement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingQuestionId, setGeneratingQuestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterConfidence, setFilterConfidence] = useState<string | null>(null);

  // Pipeline store
  const pipelineQuestions = usePipelineStore((state) => state.questions);
  const pipelineStatements = usePipelineStore((state) => state.statements);
  const addStatements = usePipelineStore((state) => state.addStatements);

  // Generate statements for a single question
  const generateStatementsForQuestion = useCallback(async (
    questionText: string,
    questionId: string
  ): Promise<CausalStatement[]> => {
    const response = await fetch('/api/llm/statements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questionText,
        questionId,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate statements');
    }

    const data = await response.json();
    return data.statements.map((s: {
      id: string;
      text: string;
      cause: string;
      effect: string;
      mechanism: string;
      confidence: number;
    }) => ({
      id: s.id,
      text: s.text,
      cause: s.cause,
      effect: s.effect,
      mechanism: s.mechanism,
      confidence: s.confidence,
      questionId,
      triples: [],
    }));
  }, []);

  // Handle manual question submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuestion.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const newStatements = await generateStatementsForQuestion(
        manualQuestion.trim(),
        `manual-${Date.now()}`
      );
      setStatements(prev => [...prev, ...newStatements]);
      addStatements(newStatements);
      setManualQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate statements for a pipeline question
  const handleGenerateForQuestion = async (questionId: string, questionText: string) => {
    setGeneratingQuestionId(questionId);
    setError(null);

    try {
      const newStatements = await generateStatementsForQuestion(questionText, questionId);
      setStatements(prev => [...prev, ...newStatements]);
      addStatements(newStatements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate statements');
    } finally {
      setGeneratingQuestionId(null);
    }
  };

  // Generate statements for all selected questions
  const handleGenerateForSelected = async () => {
    if (selectedQuestionIds.size === 0) return;

    setIsLoading(true);
    setError(null);

    const selectedQuestions = pipelineQuestions.filter(q => selectedQuestionIds.has(q.id));

    for (const question of selectedQuestions) {
      try {
        setGeneratingQuestionId(question.id);
        const newStatements = await generateStatementsForQuestion(question.text, question.id);
        setStatements(prev => [...prev, ...newStatements]);
        addStatements(newStatements);
      } catch (err) {
        console.error(`Failed to generate for ${question.text}:`, err);
      }
    }

    setGeneratingQuestionId(null);
    setIsLoading(false);
    setSelectedQuestionIds(new Set());
  };

  // Toggle question selection
  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Select all questions
  const selectAllQuestions = () => {
    setSelectedQuestionIds(new Set(pipelineQuestions.map(q => q.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedQuestionIds(new Set());
  };

  // Filter statements by confidence
  const filteredStatements = filterConfidence
    ? statements.filter(s => getConfidenceLevel(s.confidence) === filterConfidence)
    : statements;

  // Count statements by confidence level
  const statementCounts = statements.reduce((acc, s) => {
    const level = getConfidenceLevel(s.confidence);
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Question type colors for display
  const questionTypeColors: Record<string, string> = {
    cause: 'text-red-400',
    effect: 'text-blue-400',
    mechanism: 'text-green-400',
    condition: 'text-yellow-400',
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Causal Statement Generator</h2>
        <p className="text-gray-400 text-sm">
          Generate isolated causal claims from questions. Each statement expresses a single, falsifiable causal relationship.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Question Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Manual Question Input */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Manual Question</h3>
            <form onSubmit={handleManualSubmit}>
              <textarea
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
                placeholder="Enter a causal question..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                rows={3}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !manualQuestion.trim()}
                className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading && !generatingQuestionId ? 'Generating...' : 'Generate Statements'}
              </button>
            </form>
          </div>

          {/* Pipeline Questions */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Pipeline Questions</h3>
              <span className="text-xs text-gray-500">{pipelineQuestions.length} questions</span>
            </div>

            {pipelineQuestions.length > 0 ? (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={selectAllQuestions}
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
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {pipelineQuestions.map(question => {
                    const isSelected = selectedQuestionIds.has(question.id);
                    const isGenerating = generatingQuestionId === question.id;
                    const hasStatements = statements.some(s => s.questionId === question.id);

                    return (
                      <div
                        key={question.id}
                        className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-gray-800'
                        }`}
                        onClick={() => toggleQuestionSelection(question.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded bg-gray-700 border-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white line-clamp-2">{question.text}</p>
                          <p className={`text-xs ${questionTypeColors[question.type]} mt-0.5`}>
                            {question.type}
                          </p>
                        </div>
                        {!hasStatements && !isGenerating && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateForQuestion(question.id, question.text);
                            }}
                            className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50 shrink-0"
                          >
                            Gen
                          </button>
                        )}
                        {hasStatements && (
                          <span className="text-xs text-green-400 shrink-0">✓</span>
                        )}
                        {isGenerating && (
                          <span className="text-xs text-blue-400 animate-spin shrink-0">⟳</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedQuestionIds.size > 0 && (
                  <button
                    onClick={handleGenerateForSelected}
                    disabled={isLoading}
                    className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    Generate for {selectedQuestionIds.size} Question{selectedQuestionIds.size > 1 ? 's' : ''}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No questions in pipeline.<br />
                <span className="text-xs">Go to Questions page to generate questions first.</span>
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{statements.length}</div>
                <div className="text-xs text-gray-500">Statements</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{pipelineStatements.length}</div>
                <div className="text-xs text-gray-500">In Pipeline</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Avg confidence: {statements.length > 0
                ? (statements.reduce((sum, s) => sum + s.confidence, 0) / statements.length * 100).toFixed(0)
                : 0}%
            </div>
          </div>
        </div>

        {/* Right Column - Statements List */}
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

          {/* Statements */}
          {statements.length > 0 ? (
            <div className="space-y-4">
              {/* Header with filters */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold">Generated Statements ({filteredStatements.length})</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilterConfidence(null)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filterConfidence === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    All ({statements.length})
                  </button>
                  {Object.entries(statementCounts).map(([level, count]) => (
                    <button
                      key={level}
                      onClick={() => setFilterConfidence(filterConfidence === level ? null : level)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filterConfidence === level
                          ? confidenceColors[level]
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Statement Cards */}
              <div className="space-y-3">
                {filteredStatements.map((statement) => {
                  const question = pipelineQuestions.find(q => q.id === statement.questionId);
                  const confidenceLevel = getConfidenceLevel(statement.confidence);

                  return (
                    <div
                      key={statement.id}
                      className={`p-4 rounded-lg border ${confidenceColors[confidenceLevel]}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-white font-medium">{statement.text}</p>
                          {question && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              Q: {question.text}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs uppercase font-medium px-2 py-0.5 rounded bg-black/20">
                            {getConfidenceLabel(statement.confidence)}
                          </span>
                          <span className="text-xs font-mono">
                            {(statement.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Cause / Effect / Mechanism */}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        {statement.cause && (
                          <div className="bg-black/20 rounded p-2">
                            <span className="text-xs text-gray-500 uppercase block mb-1">Cause</span>
                            <p className="text-red-300">{statement.cause}</p>
                          </div>
                        )}
                        {statement.effect && (
                          <div className="bg-black/20 rounded p-2">
                            <span className="text-xs text-gray-500 uppercase block mb-1">Effect</span>
                            <p className="text-blue-300">{statement.effect}</p>
                          </div>
                        )}
                        {statement.mechanism && (
                          <div className="bg-black/20 rounded p-2">
                            <span className="text-xs text-gray-500 uppercase block mb-1">Mechanism</span>
                            <p className="text-green-300">{statement.mechanism}</p>
                          </div>
                        )}
                      </div>

                      {/* Confidence bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              statement.confidence >= 0.7
                                ? 'bg-green-500'
                                : statement.confidence >= 0.4
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${statement.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-lg">No statements generated yet</p>
              <p className="text-sm mt-2">
                Select questions from the pipeline or enter a question manually
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <h4 className="text-sm font-medium text-gray-300 mb-2">How it works</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Select questions from the pipeline (generated in Questions page) or enter manually</li>
          <li>Click &quot;Generate Statements&quot; to create 3-5 causal statements per question</li>
          <li>Each statement isolates a single causal relationship with cause, effect, and mechanism</li>
          <li>Statements include confidence scores based on scientific evidence</li>
          <li>Statements are saved to the pipeline for triple extraction</li>
        </ol>
      </div>
    </div>
  );
}
