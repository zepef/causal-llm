'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';

interface Project {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    topics: number;
    questions: number;
    statements: number;
    triples: number;
  };
}

interface ProjectManagerProps {
  compact?: boolean;
}

export function ProjectManager({ compact = false }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pipeline store
  const pipelineProjectId = usePipelineStore((s) => s.projectId);
  const isSaving = usePipelineStore((s) => s.isSaving);
  const isLoadingPipeline = usePipelineStore((s) => s.isLoading);
  const saveToProject = usePipelineStore((s) => s.saveToProject);
  const loadFromProject = usePipelineStore((s) => s.loadFromProject);
  const topics = usePipelineStore((s) => s.topics);
  const triples = usePipelineStore((s) => s.triples);

  const hasPipelineData = topics.length > 0 || triples.length > 0;

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      setIsCreating(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const data = await res.json();
      setProjects((prev) => [data.project, ...prev]);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
      setSelectedProjectId(data.project.id);

      // Auto-save current pipeline to new project
      if (hasPipelineData) {
        await saveToProject(data.project.id);
        fetchProjects(); // Refresh to get updated counts
      }
    } catch (err) {
      setError('Failed to create project');
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its data?')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete project');

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    } catch (err) {
      setError('Failed to delete project');
      console.error(err);
    }
  };

  // Load project
  const handleLoadProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    const success = await loadFromProject(projectId);
    if (success) {
      setError(null);
    } else {
      setError('Failed to load project data');
    }
  };

  // Save to project
  const handleSaveToProject = async (projectId: string) => {
    const success = await saveToProject(projectId);
    if (success) {
      fetchProjects(); // Refresh to get updated counts
      setError(null);
    } else {
      setError('Failed to save project');
    }
  };

  if (compact) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Projects</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {showCreateForm ? 'Cancel' : '+ New'}
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-3 space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
              className="w-full py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create & Save Current Data'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-gray-500">No projects yet</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {projects.slice(0, 5).map((project) => (
              <div
                key={project.id}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  pipelineProjectId === project.id
                    ? 'bg-blue-900/30 border border-blue-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => handleLoadProject(project.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{project.name}</span>
                  <span className="text-xs text-gray-500">
                    {project._count.triples}t
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasPipelineData && selectedProjectId && (
          <button
            onClick={() => handleSaveToProject(selectedProjectId)}
            disabled={isSaving}
            className="mt-3 w-full py-1.5 bg-green-600 text-white rounded text-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Current Data'}
          </button>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-400">{error}</div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Project Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg space-y-3">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          />
          <input
            type="text"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
          />
          <button
            onClick={handleCreateProject}
            disabled={!newProjectName.trim() || isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : hasPipelineData ? 'Create & Save Current Data' : 'Create Project'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No projects yet</p>
          <p className="text-sm">Create a project to save and organize your pipeline data</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-4 rounded-lg transition-colors ${
                pipelineProjectId === project.id
                  ? 'bg-blue-900/30 border border-blue-700'
                  : 'bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>{project._count.topics} topics</span>
                    <span>{project._count.questions} questions</span>
                    <span>{project._count.statements} statements</span>
                    <span>{project._count.triples} triples</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleLoadProject(project.id)}
                    disabled={isLoadingPipeline}
                    className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                  >
                    {isLoadingPipeline && selectedProjectId === project.id ? 'Loading...' : 'Load'}
                  </button>
                  {hasPipelineData && (
                    <button
                      onClick={() => handleSaveToProject(project.id)}
                      disabled={isSaving}
                      className="px-3 py-1 bg-green-700 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="px-3 py-1 bg-red-900 text-red-300 rounded text-sm hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
