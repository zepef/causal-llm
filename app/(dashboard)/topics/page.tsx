'use client';

import { useState, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { TopicNode } from '@/types/graph';

export default function TopicsPage() {
  const [rootTopic, setRootTopic] = useState('');
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_totalExpanded, setTotalExpanded] = useState(0);

  // Pipeline store
  const addTopics = usePipelineStore((state) => state.addTopics);
  const pipelineTopics = usePipelineStore((state) => state.topics);

  // Expand a topic via LLM
  const expandTopic = useCallback(async (
    topicName: string,
    depth: number = 0,
    parentId?: string
  ): Promise<TopicNode[]> => {
    const response = await fetch('/api/llm/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topicName, depth, maxDepth: 5 }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to expand topic');
    }

    const data = await response.json();

    return data.subtopics.map((st: {
      id: string;
      name: string;
      description: string;
      causalRelevance: string;
    }) => ({
      id: st.id,
      name: st.name,
      description: st.description,
      causalRelevance: st.causalRelevance,
      depth: depth + 1,
      parentId,
      children: [],
      expanded: false,
      questionCount: 0,
    }));
  }, []);

  // Handle initial topic submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootTopic.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setTotalExpanded(0);

    try {
      const children = await expandTopic(rootTopic.trim(), 0, 'root');

      const rootNode: TopicNode = {
        id: `root-${Date.now()}`,
        name: rootTopic.trim(),
        description: 'Root topic for causal exploration',
        causalRelevance: '',
        depth: 0,
        parentId: undefined,
        children,
        expanded: true,
        questionCount: 0,
      };

      setTopics([rootNode]);
      setTotalExpanded(children.length + 1);

      // Add to pipeline store
      addTopics([rootNode, ...children]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle expand/collapse
  const toggleExpand = (topicId: string) => {
    setTopics(prev => updateTopicTree(prev, topicId, (topic) => ({
      ...topic,
      expanded: !topic.expanded,
    })));
  };

  // Expand a child topic (fetch its children)
  const handleExpandChild = async (topic: TopicNode) => {
    if (topic.children.length > 0 || topic.depth >= 4) {
      // Already expanded or at max depth, just toggle
      toggleExpand(topic.id);
      return;
    }

    setExpandingId(topic.id);
    setError(null);

    try {
      const children = await expandTopic(topic.name, topic.depth, topic.id);

      setTopics(prev => updateTopicTree(prev, topic.id, (t) => ({
        ...t,
        children,
        expanded: true,
      })));

      setTotalExpanded(prev => prev + children.length);

      // Add to pipeline store
      addTopics(children);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expand topic');
    } finally {
      setExpandingId(null);
    }
  };

  // Helper to update a topic in the tree
  const updateTopicTree = (
    topics: TopicNode[],
    targetId: string,
    updater: (topic: TopicNode) => TopicNode
  ): TopicNode[] => {
    return topics.map(topic => {
      if (topic.id === targetId) {
        return updater(topic);
      }
      if (topic.children.length > 0) {
        return {
          ...topic,
          children: updateTopicTree(topic.children, targetId, updater),
        };
      }
      return topic;
    });
  };

  // Count total topics in tree
  const countTopics = (topics: TopicNode[]): number => {
    return topics.reduce((sum, t) => sum + 1 + countTopics(t.children), 0);
  };

  // Render a single topic
  const renderTopic = (topic: TopicNode, level: number = 0) => {
    const isExpanding = expandingId === topic.id;
    const hasChildren = topic.children.length > 0;
    const canExpand = topic.depth < 4;

    return (
      <div key={topic.id} className="relative">
        {/* Vertical connector line */}
        {level > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-gray-700"
            style={{ left: (level - 1) * 24 + 8 }}
          />
        )}

        <div
          className="py-2 pl-2 hover:bg-gray-800/50 rounded transition-colors"
          style={{ marginLeft: level * 24 }}
        >
          <div className="flex items-start gap-2">
            {/* Expand/collapse button */}
            <button
              className="mt-1 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              onClick={() => hasChildren ? toggleExpand(topic.id) : (canExpand && handleExpandChild(topic))}
              disabled={isExpanding}
            >
              {isExpanding ? (
                <span className="animate-spin text-blue-400">⟳</span>
              ) : hasChildren ? (
                topic.expanded ? '▼' : '▶'
              ) : canExpand ? (
                <span className="text-blue-400 text-xs">+</span>
              ) : (
                '•'
              )}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{topic.name}</span>
                <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                  d{topic.depth}
                </span>
                {hasChildren && (
                  <span className="text-xs text-gray-500">
                    ({topic.children.length} subtopics)
                  </span>
                )}
              </div>

              {topic.description && (
                <p className="text-sm text-gray-400 mt-0.5">{topic.description}</p>
              )}

              {topic.causalRelevance && (
                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                  <span>↳</span> {topic.causalRelevance}
                </p>
              )}

              {/* Expand button for topics without children */}
              {!hasChildren && canExpand && !isExpanding && (
                <button
                  onClick={() => handleExpandChild(topic)}
                  className="mt-2 text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                >
                  Expand subtopics
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Render children */}
        {topic.expanded && topic.children.map((child) => renderTopic(child, level + 1))}
      </div>
    );
  };

  const topicCount = countTopics(topics);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Topic Graph Explorer</h2>
        <p className="text-gray-400 text-sm">
          Enter a root topic to begin BFS expansion. The LLM will discover causally relevant subtopics.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={rootTopic}
            onChange={(e) => setRootTopic(e.target.value)}
            placeholder="e.g., Climate change impacts on agriculture"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !rootTopic.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Expanding...
              </span>
            ) : (
              'Expand Topic'
            )}
          </button>
        </div>
      </form>

      {/* Stats Bar */}
      {topicCount > 0 && (
        <div className="mb-4 flex items-center gap-4 text-sm">
          <div className="px-3 py-1.5 bg-gray-800 rounded-lg">
            <span className="text-gray-400">Topics:</span>{' '}
            <span className="text-white font-medium">{topicCount}</span>
          </div>
          <div className="px-3 py-1.5 bg-gray-800 rounded-lg">
            <span className="text-gray-400">In Pipeline:</span>{' '}
            <span className="text-white font-medium">{pipelineTopics.length}</span>
          </div>
          {expandingId && (
            <div className="px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg animate-pulse">
              Expanding topic...
            </div>
          )}
        </div>
      )}

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

      {/* Topic Tree */}
      {topics.length > 0 ? (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Topic Tree</h3>
            <span className="text-xs text-gray-500">Click + to expand subtopics</span>
          </div>
          <div className="space-y-1">
            {topics.map((topic) => renderTopic(topic))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4">🌳</div>
          <p className="text-lg">Enter a topic above to start building your topic tree</p>
          <p className="text-sm mt-2">The LLM will identify causally relevant subtopics</p>
        </div>
      )}

      {/* Example Topics */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Start Examples</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Climate change impacts',
            'Pandemic spread dynamics',
            'Economic recession causes',
            'Ecosystem collapse mechanisms',
            'Urban development patterns',
            'Stress and health outcomes',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setRootTopic(example)}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <h4 className="text-sm font-medium text-gray-300 mb-2">How it works</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Enter a root topic (e.g., &quot;Climate change impacts&quot;)</li>
          <li>The LLM identifies 5-8 causally relevant subtopics</li>
          <li>Click the <span className="text-blue-400">+</span> button to expand any subtopic</li>
          <li>Build a tree up to depth 4 for detailed causal decomposition</li>
          <li>Topics are saved to the pipeline for question generation</li>
        </ol>
      </div>
    </div>
  );
}
