// DEMOCRITUS - Pipeline execution state management
// Tracks the progress of the causal extraction pipeline

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TopicNode, CausalQuestion, CausalStatement, CausalTriple } from '@/types/graph';

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
  }))
);

// Computed selectors
export const usePipelineProgress = () =>
  usePipelineStore((state) => ({
    stage: state.stage,
    isRunning: state.isRunning,
    progress: state.progress,
    error: state.error,
    counts: {
      topics: state.topics.length,
      questions: state.questions.length,
      statements: state.statements.length,
      triples: state.triples.length,
    },
  }));
