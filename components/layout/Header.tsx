'use client';

import { usePathname } from 'next/navigation';

const pageTitles: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Dashboard',
    description: 'Overview of your causal models',
  },
  '/topics': {
    title: 'Topic Graph',
    description: 'Module 1: BFS expansion of topics via LLM prompts',
  },
  '/questions': {
    title: 'Causal Questions',
    description: 'Module 2: Generate targeted causal queries',
  },
  '/statements': {
    title: 'Causal Statements',
    description: 'Module 3: Generate isolated causal claims',
  },
  '/triples': {
    title: 'Relational Triples',
    description: 'Module 4: Extract structured (source, relation, target) triples',
  },
  '/manifold': {
    title: 'Relational Manifold',
    description: 'Module 5: Geometric Transformer embeddings with UMAP visualization',
  },
  '/topos': {
    title: 'Topos Slices',
    description: 'Module 6: Domain organization and cross-domain integration',
  },
};

export function Header() {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || { title: 'DEMOCRITUS', description: '' };

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{pageInfo.title}</h2>
        <p className="text-xs text-gray-500">{pageInfo.description}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Actions */}
        <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          New Project
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
          Settings
        </button>
      </div>
    </header>
  );
}
