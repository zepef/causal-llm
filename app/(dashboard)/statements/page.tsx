'use client';

import { useState } from 'react';

interface Statement {
  id: string;
  text: string;
  cause: string;
  effect: string;
  mechanism: string;
  confidence: number;
}

export default function StatementsPage() {
  const [question, setQuestion] = useState('');
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStatements = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/llm/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate statements');
      }

      const data = await response.json();
      setStatements(data.statements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Causal Statement Generator</h2>
        <p className="text-gray-400 text-sm">
          Generate isolated causal claims from questions. Each statement expresses a single, falsifiable causal relationship.
        </p>
      </div>

      {/* Input Form */}
      <div className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter a causal question..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && generateStatements()}
          />
          <button
            onClick={generateStatements}
            disabled={isLoading || !question.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Statements'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Statements List */}
      {statements.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-semibold">Generated Statements ({statements.length})</h3>

          {statements.map((statement) => (
            <div
              key={statement.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <p className="text-white font-medium mb-3">{statement.text}</p>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs uppercase">Cause</span>
                  <p className="text-red-400 mt-1">{statement.cause}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Effect</span>
                  <p className="text-blue-400 mt-1">{statement.effect}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Mechanism</span>
                  <p className="text-green-400 mt-1">{statement.mechanism}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-gray-500 text-xs">Confidence:</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      statement.confidence >= 0.8
                        ? 'bg-green-500'
                        : statement.confidence >= 0.5
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${statement.confidence * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-mono ${getConfidenceColor(statement.confidence)}`}>
                  {(statement.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">📝</div>
          <p>Enter a causal question above to generate statements</p>
        </div>
      )}

      {/* Example Questions */}
      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Example Questions</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'What causes climate change?',
            'How does stress affect health?',
            'What enables economic growth?',
            'Why do ecosystems collapse?',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setQuestion(example)}
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
