'use client';

// DEMOCRITUS - Settings Page
// Configure API keys, LLM parameters, and visualization options

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { ExportImport } from '@/components/ui/ExportImport';

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const {
    anthropicApiKey,
    llmModel,
    maxTokens,
    temperature,
    maxTopicDepth,
    questionsPerTopic,
    statementsPerQuestion,
    graphDimensions,
    showEdgeLabels,
    nodeSize,
    setAnthropicApiKey,
    setLlmModel,
    setMaxTokens,
    setTemperature,
    setMaxTopicDepth,
    setQuestionsPerTopic,
    setStatementsPerQuestion,
    setGraphDimensions,
    setShowEdgeLabels,
    setNodeSize,
    resetToDefaults,
  } = useSettingsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const testApiKey = async () => {
    if (!anthropicApiKey) {
      setTestStatus('error');
      setTestMessage('Please enter an API key first');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connection...');

    try {
      const response = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: anthropicApiKey }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestStatus('success');
        setTestMessage('API key is valid!');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Invalid API key');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Failed to test API key');
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your DEMOCRITUS instance</p>
      </div>

      {/* API Configuration */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🔑</span>
          API Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 pr-20"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                onClick={testApiKey}
                disabled={testStatus === 'testing'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testMessage && (
              <p className={`mt-2 text-sm ${testStatus === 'success' ? 'text-green-400' : testStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                {testMessage}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Get your API key from{' '}
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* LLM Settings */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          LLM Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Model
            </label>
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value as typeof llmModel)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
              <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Faster)</option>
              <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Tokens: {maxTokens}
            </label>
            <input
              type="range"
              min="1024"
              max="8192"
              step="1024"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower = more focused, Higher = more creative
            </p>
          </div>
        </div>
      </section>

      {/* Pipeline Settings */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          Pipeline Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Topic Depth: {maxTopicDepth}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={maxTopicDepth}
              onChange={(e) => setMaxTopicDepth(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              How deep to expand topic tree
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Questions per Topic: {questionsPerTopic}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={questionsPerTopic}
              onChange={(e) => setQuestionsPerTopic(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Statements per Question: {statementsPerQuestion}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={statementsPerQuestion}
              onChange={(e) => setStatementsPerQuestion(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Visualization Settings */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🎨</span>
          Visualization Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Graph Dimensions
            </label>
            <select
              value={graphDimensions}
              onChange={(e) => setGraphDimensions(parseInt(e.target.value) as 2 | 3)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value={3}>3D (Recommended)</option>
              <option value={2}>2D</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Node Size: {nodeSize}
            </label>
            <input
              type="range"
              min="2"
              max="15"
              value={nodeSize}
              onChange={(e) => setNodeSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showEdgeLabels}
                onChange={(e) => setShowEdgeLabels(e.target.checked)}
                className="w-5 h-5 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-300">Show Edge Labels</span>
            </label>
          </div>
        </div>
      </section>

      {/* Export/Import */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">💾</span>
          Export / Import
        </h2>
        <ExportImport />
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          onClick={resetToDefaults}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
