// DEMOCRITUS - Pipeline execution state management
// Tracks the progress of the causal extraction pipeline

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TopicNode, CausalQuestion, CausalStatement, CausalTriple, RelationType } from '@/types/graph';

type PipelineStage =
  | 'idle'
  | 'topics'      // Module 1: Topic expansion
  | 'questions'   // Module 2: Question generation
  | 'statements'  // Module 3: Statement generation
  | 'triples'     // Module 4: Triple extraction
  | 'embeddings'  // Module 5: Geometric Transformer
  | 'umap'        // UMAP projection
  | 'complete';

interface PipelineProgress {
  current: number;
  total: number;
  message: string;
}

interface PipelineError {
  stage: PipelineStage;
  message: string;
  details?: string;
}

interface PipelineState {
  // Current state
  stage: PipelineStage;
  isRunning: boolean;
  progress: PipelineProgress | null;
  error: PipelineError | null;

  // Project context
  projectId: string | null;
  rootTopic: string | null;

  // Accumulated data
  topics: TopicNode[];
  questions: CausalQuestion[];
  statements: CausalStatement[];
  triples: CausalTriple[];

  // Configuration
  config: {
    maxTopicDepth: number;
    questionsPerTopic: number;
    statementsPerQuestion: number;
    embeddingDimension: number;
    umapDimensions: 2 | 3;
  };

  // Actions
  startPipeline: (projectId: string, rootTopic: string) => void;
  setStage: (stage: PipelineStage) => void;
  setProgress: (progress: PipelineProgress) => void;
  setError: (error: PipelineError | null) => void;
  pausePipeline: () => void;
  resumePipeline: () => void;
  resetPipeline: () => void;

  // Data accumulation
  addTopics: (topics: TopicNode[]) => void;
  addQuestions: (questions: CausalQuestion[]) => void;
  addStatements: (statements: CausalStatement[]) => void;
  addTriples: (triples: CausalTriple[]) => void;

  // Configuration
  updateConfig: (updates: Partial<PipelineState['config']>) => void;

  // Persistence
  saveToProject: (projectId: string) => Promise<boolean>;
  loadFromProject: (projectId: string) => Promise<boolean>;
  isSaving: boolean;
  isLoading: boolean;
}

export const usePipelineStore = create<PipelineState>()(
  immer((set) => ({
    // Initial state
    stage: 'idle',
    isRunning: false,
    progress: null,
    error: null,
    projectId: null,
    rootTopic: null,
    topics: [],
    questions: [],
    statements: [],
    triples: [],

    config: {
      maxTopicDepth: 5,
      questionsPerTopic: 5,
      statementsPerQuestion: 3,
      embeddingDimension: 128,
      umapDimensions: 3,
    },

    isSaving: false,
    isLoading: false,

    // Actions
    startPipeline: (projectId, rootTopic) =>
      set((state) => {
        state.projectId = projectId;
        state.rootTopic = rootTopic;
        state.stage = 'topics';
        state.isRunning = true;
        state.error = null;
        state.topics = [];
        state.questions = [];
        state.statements = [];
        state.triples = [];
      }),

    setStage: (stage) =>
      set((state) => {
        state.stage = stage;
        state.progress = null;
      }),

    setProgress: (progress) =>
      set((state) => {
        state.progress = progress;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        if (error) {
          state.isRunning = false;
        }
      }),

    pausePipeline: () =>
      set((state) => {
        state.isRunning = false;
      }),

    resumePipeline: () =>
      set((state) => {
        if (state.stage !== 'idle' && state.stage !== 'complete') {
          state.isRunning = true;
          state.error = null;
        }
      }),

    resetPipeline: () =>
      set((state) => {
        state.stage = 'idle';
        state.isRunning = false;
        state.progress = null;
        state.error = null;
        state.projectId = null;
        state.rootTopic = null;
        state.topics = [];
        state.questions = [];
        state.statements = [];
        state.triples = [];
      }),

    // Data accumulation
    addTopics: (topics) =>
      set((state) => {
        state.topics.push(...topics);
      }),

    addQuestions: (questions) =>
      set((state) => {
        state.questions.push(...questions);
      }),

    addStatements: (statements) =>
      set((state) => {
        state.statements.push(...statements);
      }),

    addTriples: (triples) =>
      set((state) => {
        state.triples.push(...triples);
      }),

    // Configuration
    updateConfig: (updates) =>
      set((state) => {
        Object.assign(state.config, updates);
      }),

    // Persistence
    saveToProject: async (projectId: string) => {
      set((state) => {
        state.isSaving = true;
      });

      try {
        const state = usePipelineStore.getState();
        const response = await fetch(`/api/projects/${projectId}/pipeline`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topics: state.topics.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
            })),
            questions: state.questions.map((q) => ({
              id: q.id,
              topicId: q.topicId,
              text: q.text,
              questionType: q.type,
            })),
            statements: state.statements.map((s) => ({
              id: s.id,
              questionId: s.questionId,
              text: s.text,
              confidence: s.confidence,
              source: s.mechanism,
            })),
            triples: state.triples.map((t) => ({
              id: `${t.source}-${t.relation}-${t.target}`,
              subject: t.source,
              predicate: t.relation,
              object: t.target,
              relationType: t.relation,
              confidence: t.confidence,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save pipeline');
        }

        set((state) => {
          state.isSaving = false;
          state.projectId = projectId;
        });

        return true;
      } catch (error) {
        console.error('Failed to save pipeline:', error);
        set((state) => {
          state.isSaving = false;
          state.error = {
            stage: state.stage,
            message: 'Failed to save pipeline',
            details: error instanceof Error ? error.message : String(error),
          };
        });
        return false;
      }
    },

    loadFromProject: async (projectId: string) => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const response = await fetch(`/api/projects/${projectId}/pipeline`);

        if (!response.ok) {
          throw new Error('Failed to load pipeline');
        }

        const data = await response.json();
        const { pipeline } = data;

        set((state) => {
          state.isLoading = false;
          state.projectId = projectId;
          state.topics = pipeline.topics.map((t: { id: string; name: string; description?: string }) => ({
            id: t.id,
            name: t.name,
            description: t.description,
          }));
          state.questions = pipeline.questions.map((q: { id: string; topicId: string; text: string; questionType?: string }) => ({
            id: q.id,
            topicId: q.topicId,
            text: q.text,
            type: (q.questionType || 'cause') as 'cause' | 'effect' | 'mechanism' | 'condition',
            variables: [] as string[],
          }));
          state.statements = pipeline.statements.map((s: { id: string; questionId?: string; text: string; confidence?: number; source?: string }) => ({
            id: s.id,
            questionId: s.questionId,
            text: s.text,
            confidence: s.confidence || 1.0,
            mechanism: s.source,
            triples: [] as CausalTriple[],
          }));
          state.triples = pipeline.triples.map((t: { subject: string; predicate: string; object: string; relationType?: string; confidence?: number }) => ({
            source: t.subject,
            relation: (t.relationType || t.predicate) as RelationType,
            target: t.object,
            confidence: t.confidence,
          }));
          state.stage = pipeline.triples.length > 0 ? 'complete' : 'idle';
        });

        return true;
      } catch (error) {
        console.error('Failed to load pipeline:', error);
        set((state) => {
          state.isLoading = false;
          state.error = {
            stage: state.stage,
            message: 'Failed to load pipeline',
            details: error instanceof Error ? error.message : String(error),
          };
        });
        return false;
      }
    },
  }))
);

// Computed selectors - use individual selectors to avoid hydration issues
export const usePipelineProgress = () => {
  const stage = usePipelineStore((state) => state.stage);
  const isRunning = usePipelineStore((state) => state.isRunning);
  const progress = usePipelineStore((state) => state.progress);
  const error = usePipelineStore((state) => state.error);
  const topicsCount = usePipelineStore((state) => state.topics.length);
  const questionsCount = usePipelineStore((state) => state.questions.length);
  const statementsCount = usePipelineStore((state) => state.statements.length);
  const triplesCount = usePipelineStore((state) => state.triples.length);

  return {
    stage,
    isRunning,
    progress,
    error,
    counts: {
      topics: topicsCount,
      questions: questionsCount,
      statements: statementsCount,
      triples: triplesCount,
    },
  };
};
