'use client';

import { useState } from 'react';

interface Question {
  id: string;
  text: string;
  type: 'cause' | 'effect' | 'mechanism' | 'condition';
  variables: string[];
  topic: string;
}

const questionTypeColors = {
  cause: 'bg-red-900/30 text-red-400 border-red-800',
  effect: 'bg-blue-900/30 text-blue-400 border-blue-800',
  mechanism: 'bg-green-900/30 text-green-400 border-green-800',
  condition: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
};

export default function QuestionsPage() {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestions = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/llm/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Causal Question Generator</h2>
        <p className="text-gray-400 text-sm">
          Generate targeted causal questions for a topic. Questions probe cause-effect relationships, mechanisms, and conditions.
        </p>
      </div>

      {/* Input Form */}
      <div className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && generateQuestions()}
          />
          <button
            onClick={generateQuestions}
            disabled={isLoading || !topic.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Questions'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Questions List */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Generated Questions ({questions.length})</h3>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded">Cause</span>
              <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded">Effect</span>
              <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded">Mechanism</span>
              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded">Condition</span>
            </div>
          </div>

          {questions.map((question) => (
            <div
              key={question.id}
              className={`p-4 rounded-lg border ${questionTypeColors[question.type]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-white">{question.text}</p>
                <span className="text-xs uppercase font-medium shrink-0">
                  {question.type}
                </span>
              </div>
              {question.variables.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {question.variables.map((variable, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">❓</div>
          <p>Enter a topic above to generate causal questions</p>
        </div>
      )}
    </div>
  );
}
