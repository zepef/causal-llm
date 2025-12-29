'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePipelineProgress } from '@/stores/pipelineStore';
import { ProjectSelector } from '@/components/ui/ProjectSelector';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    icon: '🏠',
    description: 'Dashboard home',
  },
  {
    href: '/topics',
    label: 'Topics',
    icon: '🌳',
    description: 'Module 1: Topic Graph',
  },
  {
    href: '/questions',
    label: 'Questions',
    icon: '❓',
    description: 'Module 2: Causal Questions',
  },
  {
    href: '/statements',
    label: 'Statements',
    icon: '📝',
    description: 'Module 3: Causal Statements',
  },
  {
    href: '/triples',
    label: 'Triples',
    icon: '🔗',
    description: 'Module 4: Relational Triples',
  },
  {
    href: '/manifold',
    label: 'Manifold',
    icon: '🌐',
    description: 'Module 5: Relational Manifold',
  },
  {
    href: '/topos',
    label: 'Topos',
    icon: '🔮',
    description: 'Module 6: Topos Slices',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'Configure API & options',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [showProjects, setShowProjects] = useState(false);
  const { stage, isRunning, counts } = usePipelineProgress();

  const getStatusColor = () => {
    if (isRunning) return 'bg-yellow-500 animate-pulse';
    if (stage === 'complete') return 'bg-green-500';
    if (stage === 'idle') return 'bg-gray-500';
    return 'bg-blue-500';
  };

  const getStatusText = () => {
    if (isRunning) return `Running: ${stage}`;
    if (stage === 'complete') return 'Complete';
    if (stage === 'idle') return 'Ready';
    return `Paused: ${stage}`;
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">DEMOCRITUS</h1>
        <p className="text-xs text-gray-500 mt-1">Large Causal Models</p>
      </div>

      {/* Project Toggle */}
      <button
        onClick={() => setShowProjects(!showProjects)}
        className="mx-4 mt-4 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-left flex items-center justify-between"
      >
        <span>Projects</span>
        <span className="text-gray-400">{showProjects ? '▲' : '▼'}</span>
      </button>

      {/* Project Selector (collapsible) */}
      {showProjects && (
        <div className="px-4 py-2">
          <ProjectSelector />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-colors duration-150
                ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                {isActive && (
                  <div className="text-xs text-blue-200 mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Pipeline Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            {getStatusText()}
          </div>
          <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-1">
            <span>{counts.topics} topics</span>
            <span>{counts.questions} questions</span>
            <span>{counts.statements} statements</span>
            <span>{counts.triples} triples</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
