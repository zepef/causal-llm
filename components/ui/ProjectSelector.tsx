'use client';

// DEMOCRITUS - Project Selector Component
// Allows users to create, select, save, and load projects

import { useState, useEffect, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';

interface Project {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    topics: number;
    questions: number;
    statements: number;
    triples: number;
  };
}

export function ProjectSelector() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');

  const {
    projectId,
    isSaving,
    isLoading,
    saveToProject,
    loadFromProject,
    topics,
    questions,
    statements,
    triples,
  } = usePipelineStore();

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription || undefined,
          domain: newProjectDomain || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProjects((prev) => [data.project, ...prev]);
        setNewProjectName('');
        setNewProjectDescription('');
        setNewProjectDomain('');
        setShowNewProject(false);
        // Automatically select the new project
        await loadFromProject(data.project.id);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleSave = async () => {
    if (!projectId) {
      setShowNewProject(true);
      return;
    }
    await saveToProject(projectId);
    fetchProjects(); // Refresh project list to update counts
  };

  const handleLoad = async (id: string) => {
    await loadFromProject(id);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all associated data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const currentProject = projects.find((p) => p.id === projectId);
  const hasData = topics.length > 0 || questions.length > 0 || statements.length > 0 || triples.length > 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Project</h3>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasData}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowNewProject(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            New
          </button>
        </div>
      </div>

      {/* Current Project */}
      {currentProject ? (
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <div className="font-medium">{currentProject.name}</div>
          {currentProject.domain && (
            <div className="text-sm text-gray-400">{currentProject.domain}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(currentProject.updatedAt).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-gray-700 rounded text-gray-400 text-sm">
          No project selected. Create a new project or load an existing one.
        </div>
      )}

      {/* New Project Form */}
      {showNewProject && (
        <div className="mb-4 p-3 bg-gray-700 rounded space-y-3">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={newProjectDomain}
            onChange={(e) => setNewProjectDomain(e.target.value)}
            placeholder="Domain (e.g., Economics, Biology)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
            >
              Create & Save
            </button>
            <button
              onClick={() => setShowNewProject(false)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400 mb-2">
          {isLoadingProjects ? 'Loading projects...' : `${projects.length} projects`}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-3 rounded cursor-pointer transition-colors ${
                project.id === projectId
                  ? 'bg-blue-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex-1"
                  onClick={() => handleLoad(project.id)}
                >
                  <div className="font-medium">{project.name}</div>
                  {project.domain && (
                    <div className="text-sm text-gray-300">{project.domain}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {project._count.topics}T / {project._count.questions}Q / {project._count.statements}S / {project._count.triples}Tr
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="text-gray-400 hover:text-red-500 text-sm px-2"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div>Loading project...</div>
          </div>
        </div>
      )}
    </div>
  );
}
