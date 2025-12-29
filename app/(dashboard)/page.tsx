'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePipelineRunner } from '@/hooks/usePipelineRunner';

interface ModuleCard {
  href: string;
  title: string;
  description: string;
  icon: string;
  status: 'ready' | 'coming' | 'active';
}

const modules: ModuleCard[] = [
  {
    href: '/topics',
    title: 'Topic Graph',
    description: 'Build a hierarchical topic tree via LLM-driven BFS expansion. Start with a root topic and discover causally relevant subtopics.',
    icon: '🌳',
    status: 'ready',
  },
  {
    href: '/questions',
    title: 'Causal Questions',
    description: 'Generate targeted causal queries for each topic. Questions probe cause-effect relationships, mechanisms, and conditions.',
    icon: '❓',
    status: 'ready',
  },
  {
    href: '/statements',
    title: 'Causal Statements',
    description: 'Generate isolated causal claims in natural language. Each statement expresses a single, falsifiable causal relationship.',
    icon: '📝',
    status: 'ready',
  },
  {
    href: '/triples',
    title: 'Relational Triples',
    description: 'Extract structured triples: (source, relation, target). Build a directed multi-relational causal graph.',
    icon: '🔗',
    status: 'ready',
  },
  {
    href: '/manifold',
    title: 'Relational Manifold',
    description: 'Refine embeddings with Geometric Transformer. Visualize causal structure in 2D/3D with UMAP projections.',
    icon: '🌐',
    status: 'coming',
  },
  {
    href: '/topos',
    title: 'Topos Slices',
    description: 'Organize domains as topos slices. Discover cross-domain analogies and integrate causal knowledge.',
    icon: '🔮',
    status: 'coming',
  },
];

const stageLabels: Record<string, string> = {
  idle: 'Ready',
  topics: 'Expanding Topics',
  questions: 'Generating Questions',
  statements: 'Creating Statements',
  triples: 'Extracting Triples',
  complete: 'Complete',
};

export default function DashboardPage() {
  const [rootTopic, setRootTopic] = useState('');

  // Pipeline store
  const topics = usePipelineStore((s) => s.topics);
  const questions = usePipelineStore((s) => s.questions);
  const statements = usePipelineStore((s) => s.statements);
  const triples = usePipelineStore((s) => s.triples);

  // Settings
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);

  // Pipeline runner
  const {
    isRunning,
    currentStage,
    progress,
    error,
    runFullPipeline,
    stopPipeline,
    clearState,
  } = usePipelineRunner();

  const handleRunPipeline = async () => {
    if (!rootTopic.trim()) return;
    await runFullPipeline(rootTopic.trim());
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to DEMOCRITUS</h1>
        <p className="text-gray-400 max-w-2xl">
          Extract causal knowledge from Large Language Models to build Large Causal Models (LCMs).
          Follow the 6-module pipeline to discover, structure, and visualize causal relationships.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">{topics.length}</div>
          <div className="text-sm text-gray-500">Topics</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">{questions.length}</div>
          <div className="text-sm text-gray-500">Questions</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">{statements.length}</div>
          <div className="text-sm text-gray-500">Statements</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">{triples.length}</div>
          <div className="text-sm text-gray-500">Triples</div>
        </div>
      </div>

      {/* Auto-Run Pipeline */}
      <div className="mb-8 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-800">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🚀</span>
          <h2 className="text-xl font-semibold">Auto-Run Pipeline</h2>
        </div>

        {!anthropicApiKey && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg text-yellow-400 text-sm">
            <span className="font-medium">API Key Required:</span> Please configure your Anthropic API key in{' '}
            <Link href="/settings" className="underline hover:text-yellow-300">Settings</Link> before running the pipeline.
          </div>
        )}

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Root Topic</label>
            <input
              type="text"
              value={rootTopic}
              onChange={(e) => setRootTopic(e.target.value)}
              placeholder="e.g., Climate change impacts on global food security"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              disabled={isRunning}
            />
          </div>
          {isRunning ? (
            <button
              onClick={stopPipeline}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleRunPipeline}
              disabled={!rootTopic.trim() || !anthropicApiKey}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Run Full Pipeline
            </button>
          )}
        </div>

        {/* Progress Display */}
        {(isRunning || progress) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                {stageLabels[currentStage] || currentStage}
              </span>
              {progress && (
                <span className="text-sm text-gray-400">
                  Stage {progress.current}/{progress.total}
                </span>
              )}
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  currentStage === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: progress ? `${(progress.current / progress.total) * 100}%` : '0%' }}
              />
            </div>
            {progress && (
              <p className="mt-2 text-sm text-gray-400">{progress.message}</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearState} className="text-red-300 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Success Display */}
        {currentStage === 'complete' && !error && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm">
            Pipeline completed successfully! View your results in the{' '}
            <Link href="/manifold" className="underline hover:text-green-300">Manifold</Link> visualization.
          </div>
        )}

        {/* Quick Examples */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Quick examples:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Climate change impacts',
              'Pandemic spread dynamics',
              'Economic recession causes',
              'Urban development patterns',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setRootTopic(example)}
                disabled={isRunning}
                className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Modules */}
      <h2 className="text-xl font-semibold mb-4">Pipeline Modules</h2>
      <div className="grid grid-cols-2 gap-4">
        {modules.map((module, index) => (
          <Link
            key={module.href}
            href={module.href}
            className={`
              group bg-gray-900 rounded-lg p-5 border border-gray-800
              hover:border-blue-600 transition-colors
              ${module.status === 'coming' ? 'opacity-60' : ''}
            `}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{module.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">
                    Module {index + 1}
                  </span>
                  {module.status === 'coming' && (
                    <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded">
                      Coming Soon
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-1 group-hover:text-blue-400 transition-colors">
                  {module.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {module.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Getting Started */}
      <div className="mt-8 bg-blue-900/30 rounded-lg p-6 border border-blue-800">
        <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
        <ol className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
            <span>Configure your API key in <Link href="/settings" className="text-blue-400 hover:underline">Settings</Link></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
            <span>Use <strong>Auto-Run Pipeline</strong> above for one-click extraction, or manually explore each module</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
            <span>Enter a root topic (e.g., &quot;Indus Valley Civilization decline&quot;)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
            <span>The pipeline will expand topics, generate questions, create statements, and extract triples</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
            <span>Visualize and explore your Large Causal Model in the Manifold view</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
