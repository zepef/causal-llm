'use client';

import Link from 'next/link';

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

export default function DashboardPage() {
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
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-gray-500">Topics</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-gray-500">Questions</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-gray-500">Statements</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-2xl font-bold">0</div>
          <div className="text-sm text-gray-500">Triples</div>
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
            <span>Go to <strong>Topics</strong> and enter a root topic (e.g., &quot;Indus Valley Civilization decline&quot;)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
            <span>Expand the topic tree to discover causally relevant subtopics</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
            <span>Generate causal questions and statements for each topic</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
            <span>Extract relational triples to build your causal graph</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
            <span>Visualize and explore your Large Causal Model</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
