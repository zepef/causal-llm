'use client';

import { useState, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import { BatchProgress } from '@/components/ui/BatchProgress';
import type { CausalQuestion, TopicNode } from '@/types/graph';

const questionTypeColors: Record<string, string> = {
  cause: 'bg-red-900/30 text-red-400 border-red-800',
  effect: 'bg-blue-900/30 text-blue-400 border-blue-800',
  mechanism: 'bg-green-900/30 text-green-400 border-green-800',
  condition: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
};

const questionTypeLabels: Record<string, string> = {
  cause: 'Cause',
  effect: 'Effect',
  mechanism: 'Mechanism',
  condition: 'Condition',
};

export default function QuestionsPage() {
  const [manualTopic, setManualTopic] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<CausalQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Pipeline store
  const pipelineTopics = usePipelineStore((state) => state.topics);
  const pipelineQuestions = usePipelineStore((state) => state.questions);
  const addQuestions = usePipelineStore((state) => state.addQuestions);

  // Settings store - get API key
  const anthropicApiKey = useSettingsStore((state) => state.anthropicApiKey);

  // Batch processor
  const { progress: batchProgress, processBatch, abort: abortBatch, isRunning: isBatchRunning } = useBatchProcessor<TopicNode, CausalQuestion[]>();

  // Generate questions for a single topic
  const generateQuestionsForTopic = useCallback(async (
    topicName: string,
    topicId: string
  ): Promise<CausalQuestion[]> => {
    const response = await fetch('/api/llm/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topicName,
        topicId,
        existingQuestions: questions.map(q => q.text),
        apiKey: anthropicApiKey || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate questions');
    }

    const data = await response.json();
    return data.questions.map((q: {
      id: string;
      text: string;
      type: 'cause' | 'effect' | 'mechanism' | 'condition';
      variables: string[];
    }) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      variables: q.variables,
      topicId,
    }));
  }, [questions, anthropicApiKey]);

  // Handle manual topic submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTopic.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const newQuestions = await generateQuestionsForTopic(
        manualTopic.trim(),
        `manual-${Date.now()}`
      );
      setQuestions(prev => [...prev, ...newQuestions]);
      addQuestions(newQuestions);
      setManualTopic('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate questions for a pipeline topic
  const handleGenerateForTopic = async (topicId: string, topicName: string) => {
    setGeneratingTopicId(topicId);
    setError(null);

    try {
      const newQuestions = await generateQuestionsForTopic(topicName, topicId);
      setQuestions(prev => [...prev, ...newQuestions]);
      addQuestions(newQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setGeneratingTopicId(null);
    }
  };

  // Generate questions for all selected topics
  const handleGenerateForSelected = async () => {
    if (selectedTopicIds.size === 0) return;

    setIsLoading(true);
    setError(null);

    const selectedTopics = pipelineTopics.filter(t => selectedTopicIds.has(t.id));

    for (const topic of selectedTopics) {
      try {
        setGeneratingTopicId(topic.id);
        const newQuestions = await generateQuestionsForTopic(topic.name, topic.id);
        setQuestions(prev => [...prev, ...newQuestions]);
        addQuestions(newQuestions);
      } catch (err) {
        console.error(`Failed to generate for ${topic.name}:`, err);
      }
    }

    setGeneratingTopicId(null);
    setIsLoading(false);
    setSelectedTopicIds(new Set());
  };

  // Batch generate for all topics
  const handleGenerateForAll = async () => {
    // Filter to topics without questions
    const topicsWithoutQuestions = pipelineTopics.filter(
      (t) => !questions.some((q) => q.topicId === t.id)
    );

    if (topicsWithoutQuestions.length === 0) {
      setError('All topics already have questions generated');
      return;
    }

    await processBatch({
      items: topicsWithoutQuestions,
      processor: async (topic) => {
        const response = await fetch('/api/llm/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic.name,
            topicId: topic.id,
            existingQuestions: questions.map(q => q.text),
            apiKey: anthropicApiKey || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate questions');
        }

        const data = await response.json();
        return data.questions.map((q: {
          id: string;
          text: string;
          type: 'cause' | 'effect' | 'mechanism' | 'condition';
          variables: string[];
        }) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          variables: q.variables,
          topicId: topic.id,
        }));
      },
      onItemComplete: (_, result) => {
        setQuestions((prev) => [...prev, ...result]);
        addQuestions(result);
      },
      getItemLabel: (topic) => topic.name,
      delayBetweenItems: 1000, // 1 second delay to avoid rate limiting
    });
  };

  // Toggle topic selection
  const toggleTopicSelection = (topicId: string) => {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Select all topics
  const selectAllTopics = () => {
    setSelectedTopicIds(new Set(pipelineTopics.map(t => t.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTopicIds(new Set());
  };

  // Filter questions by type
  const filteredQuestions = filterType
    ? questions.filter(q => q.type === filterType)
    : questions;

  // Count questions by type
  const questionCounts = questions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Causal Question Generator</h2>
        <p className="text-gray-400 text-sm">
          Generate targeted causal questions from topics. Questions probe cause-effect relationships, mechanisms, and conditions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Topic Selection */}
        <div className="lg:col-span-1 space-y-4">
          {/* Manual Topic Input */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Manual Topic</h3>
            <form onSubmit={handleManualSubmit}>
              <input
                type="text"
                value={manualTopic}
                onChange={(e) => setManualTopic(e.target.value)}
                placeholder="Enter a topic..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !manualTopic.trim()}
                className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading && !generatingTopicId ? 'Generating...' : 'Generate Questions'}
              </button>
            </form>
          </div>

          {/* Pipeline Topics */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Pipeline Topics</h3>
              <span className="text-xs text-gray-500">{pipelineTopics.length} topics</span>
            </div>

            {pipelineTopics.length > 0 ? (
              <>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={selectAllTopics}
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

                {/* Generate All Button */}
                <button
                  onClick={handleGenerateForAll}
                  disabled={isBatchRunning || !anthropicApiKey}
                  className="w-full mb-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isBatchRunning ? 'Processing...' : 'Generate All'}
                </button>

                {/* Batch Progress */}
                {(isBatchRunning || batchProgress.total > 0) && (
                  <div className="mb-3">
                    <BatchProgress progress={batchProgress} onCancel={abortBatch} />
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {pipelineTopics.map(topic => {
                    const isSelected = selectedTopicIds.has(topic.id);
                    const isGenerating = generatingTopicId === topic.id;
                    const hasQuestions = questions.some(q => q.topicId === topic.id);

                    return (
                      <div
                        key={topic.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-gray-800'
                        }`}
                        onClick={() => toggleTopicSelection(topic.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{topic.name}</p>
                          <p className="text-xs text-gray-500">depth {topic.depth}</p>
                        </div>
                        {!hasQuestions && !isGenerating && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateForTopic(topic.id, topic.name);
                            }}
                            className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-400 rounded hover:bg-blue-600/50"
                          >
                            Gen
                          </button>
                        )}
                        {hasQuestions && (
                          <span className="text-xs text-green-400">✓</span>
                        )}
                        {isGenerating && (
                          <span className="text-xs text-blue-400 animate-spin">⟳</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedTopicIds.size > 0 && (
                  <button
                    onClick={handleGenerateForSelected}
                    disabled={isLoading}
                    className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                  >
                    Generate for {selectedTopicIds.size} Topic{selectedTopicIds.size > 1 ? 's' : ''}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No topics in pipeline.<br />
                <span className="text-xs">Go to Topics page to expand topics first.</span>
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <h3 className="font-medium mb-3">Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{questions.length}</div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="bg-gray-800 rounded p-2 text-center">
                <div className="text-xl font-bold text-white">{pipelineQuestions.length}</div>
                <div className="text-xs text-gray-500">In Pipeline</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Questions List */}
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

          {/* Questions */}
          {questions.length > 0 ? (
            <div className="space-y-4">
              {/* Header with filters */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold">Generated Questions ({filteredQuestions.length})</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilterType(null)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filterType === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  {Object.entries(questionCounts).map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(filterType === type ? null : type)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filterType === type
                          ? questionTypeColors[type]
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {questionTypeLabels[type]} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Cards */}
              <div className="space-y-3">
                {filteredQuestions.map((question) => {
                  const topic = pipelineTopics.find(t => t.id === question.topicId);

                  return (
                    <div
                      key={question.id}
                      className={`p-4 rounded-lg border ${questionTypeColors[question.type]}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-white">{question.text}</p>
                          {topic && (
                            <p className="text-xs text-gray-500 mt-1">
                              Topic: {topic.name}
                            </p>
                          )}
                        </div>
                        <span className="text-xs uppercase font-medium shrink-0 px-2 py-0.5 rounded bg-black/20">
                          {question.type}
                        </span>
                      </div>
                      {question.variables.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {question.variables.map((variable, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-black/30 text-gray-300 rounded"
                            >
                              {variable}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">
              <div className="text-5xl mb-4">❓</div>
              <p className="text-lg">No questions generated yet</p>
              <p className="text-sm mt-2">
                Select topics from the pipeline or enter a topic manually
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <h4 className="text-sm font-medium text-gray-300 mb-2">How it works</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Select topics from the pipeline (expanded in Topics page) or enter manually</li>
          <li>Click &quot;Generate Questions&quot; to create 5-10 causal questions per topic</li>
          <li>Questions are categorized by type: Cause, Effect, Mechanism, Condition</li>
          <li>Use filters to view questions by type</li>
          <li>Questions are saved to the pipeline for statement generation</li>
        </ol>
      </div>
    </div>
  );
}
