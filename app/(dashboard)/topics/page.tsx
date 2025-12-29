'use client';

import { useState } from 'react';

interface Topic {
  id: string;
  name: string;
  description: string;
  causalRelevance: string;
  depth: number;
  children: Topic[];
  expanded: boolean;
}

export default function TopicsPage() {
  const [rootTopic, setRootTopic] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expandTopic = async (topic: string, depth: number = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/llm/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, depth, maxDepth: 5 }),
      });

      if (!response.ok) {
        throw new Error('Failed to expand topic');
      }

      const data = await response.json();

      if (depth === 0) {
        // Root topic
        const rootNode: Topic = {
          id: `root-${Date.now()}`,
          name: topic,
          description: 'Root topic',
          causalRelevance: '',
          depth: 0,
          children: data.subtopics.map((st: { id: string; name: string; description: string; causalRelevance: string }) => ({
            ...st,
            children: [],
            expanded: false,
          })),
          expanded: true,
        };
        setTopics([rootNode]);
      }

      return data.subtopics;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootTopic.trim()) return;
    await expandTopic(rootTopic.trim());
  };

  const renderTopic = (topic: Topic, level: number = 0) => (
    <div
      key={topic.id}
      className="border-l-2 border-gray-700 pl-4 ml-2"
      style={{ marginLeft: level * 16 }}
    >
      <div className="py-2">
        <div className="flex items-center gap-2">
          <button
            className="text-gray-500 hover:text-white"
            onClick={() => {
              // Toggle expand/collapse
            }}
          >
            {topic.children.length > 0 ? (topic.expanded ? '▼' : '▶') : '•'}
          </button>
          <span className="font-medium">{topic.name}</span>
          <span className="text-xs text-gray-500">depth: {topic.depth}</span>
        </div>
        {topic.description && (
          <p className="text-sm text-gray-400 ml-6">{topic.description}</p>
        )}
        {topic.causalRelevance && (
          <p className="text-xs text-blue-400 ml-6 mt-1">
            ↳ {topic.causalRelevance}
          </p>
        )}
      </div>
      {topic.expanded && topic.children.map((child) => renderTopic(child, level + 1))}
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Topic Graph Explorer</h2>
        <p className="text-gray-400 text-sm">
          Enter a root topic to begin BFS expansion. The LLM will discover causally relevant subtopics.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={rootTopic}
            onChange={(e) => setRootTopic(e.target.value)}
            placeholder="e.g., Indus Valley Civilization decline"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !rootTopic.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Expanding...' : 'Expand Topic'}
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Topic Tree */}
      {topics.length > 0 ? (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="font-semibold mb-4">Topic Tree</h3>
          {topics.map((topic) => renderTopic(topic))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🌳</div>
          <p>Enter a topic above to start building your topic tree</p>
        </div>
      )}

      {/* Example Topics */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Example Topics</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Climate change impacts',
            'Pandemic spread dynamics',
            'Economic recession causes',
            'Ecosystem collapse',
            'Urban development patterns',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setRootTopic(example)}
              className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
