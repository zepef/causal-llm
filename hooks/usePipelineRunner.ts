// DEMOCRITUS - Pipeline Runner Hook
// Orchestrates the full LLM pipeline execution

import { useCallback, useState } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { TopicNode, CausalQuestion, CausalStatement, CausalTriple, RelationType } from '@/types/graph';

interface PipelineRunnerState {
  isRunning: boolean;
  currentStage: 'idle' | 'topics' | 'questions' | 'statements' | 'triples' | 'complete';
  progress: {
    current: number;
    total: number;
    message: string;
  } | null;
  error: string | null;
}

export function usePipelineRunner() {
  const [state, setState] = useState<PipelineRunnerState>({
    isRunning: false,
    currentStage: 'idle',
    progress: null,
    error: null,
  });

  // Pipeline store actions
  const addTopics = usePipelineStore((s) => s.addTopics);
  const addQuestions = usePipelineStore((s) => s.addQuestions);
  const addStatements = usePipelineStore((s) => s.addStatements);
  const addTriples = usePipelineStore((s) => s.addTriples);
  const resetPipeline = usePipelineStore((s) => s.resetPipeline);
  const startPipeline = usePipelineStore((s) => s.startPipeline);
  const setStage = usePipelineStore((s) => s.setStage);

  // Settings
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);
  const maxTopicDepth = useSettingsStore((s) => s.maxTopicDepth);
  const questionsPerTopic = useSettingsStore((s) => s.questionsPerTopic);
  const statementsPerQuestion = useSettingsStore((s) => s.statementsPerQuestion);

  const runFullPipeline = useCallback(async (rootTopic: string, projectId?: string) => {
    if (!rootTopic.trim()) {
      setState(s => ({ ...s, error: 'Please enter a root topic' }));
      return false;
    }

    setState({
      isRunning: true,
      currentStage: 'topics',
      progress: { current: 0, total: 4, message: 'Starting pipeline...' },
      error: null,
    });

    resetPipeline();
    startPipeline(projectId || `auto-${Date.now()}`, rootTopic);

    const allTopics: TopicNode[] = [];
    const allQuestions: CausalQuestion[] = [];
    const allStatements: CausalStatement[] = [];
    const allTriples: CausalTriple[] = [];

    try {
      // STAGE 1: Topic Expansion (BFS)
      setState(s => ({
        ...s,
        currentStage: 'topics',
        progress: { current: 1, total: 4, message: 'Expanding topics...' },
      }));
      setStage('topics');

      // Create root topic
      const rootNode: TopicNode = {
        id: `root-${Date.now()}`,
        name: rootTopic,
        description: 'Root topic for causal exploration',
        causalRelevance: '',
        depth: 0,
        parentId: undefined,
        children: [],
        expanded: true,
        questionCount: 0,
      };
      allTopics.push(rootNode);

      // BFS expansion
      const queue: TopicNode[] = [rootNode];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth >= maxTopicDepth) continue;

        try {
          const response = await fetch('/api/llm/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: current.name,
              depth: current.depth,
              maxDepth: maxTopicDepth,
              apiKey: anthropicApiKey || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const children: TopicNode[] = data.subtopics.map((st: {
              id: string;
              name: string;
              description: string;
              causalRelevance: string;
            }) => ({
              id: st.id,
              name: st.name,
              description: st.description,
              causalRelevance: st.causalRelevance,
              depth: current.depth + 1,
              parentId: current.id,
              children: [],
              expanded: false,
              questionCount: 0,
            }));

            current.children = children;
            allTopics.push(...children);

            // Only queue children if not at max depth - 1 (to limit expansion)
            if (current.depth < maxTopicDepth - 1) {
              queue.push(...children.slice(0, 3)); // Limit to 3 children per level
            }

            setState(s => ({
              ...s,
              progress: {
                ...s.progress!,
                message: `Expanded ${allTopics.length} topics...`,
              },
            }));
          }
        } catch (err) {
          console.error('Topic expansion error:', err);
        }
      }

      addTopics(allTopics);

      // STAGE 2: Question Generation
      setState(s => ({
        ...s,
        currentStage: 'questions',
        progress: { current: 2, total: 4, message: 'Generating questions...' },
      }));
      setStage('questions');

      // Generate questions for leaf topics (or all if few topics)
      const targetTopics = allTopics.length <= 5
        ? allTopics
        : allTopics.filter(t => t.children.length === 0).slice(0, 10);

      for (let i = 0; i < targetTopics.length; i++) {
        const topic = targetTopics[i];
        try {
          const response = await fetch('/api/llm/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: topic.name,
              topicId: topic.id,
              existingQuestions: allQuestions.map(q => q.text),
              apiKey: anthropicApiKey || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const questions: CausalQuestion[] = data.questions.slice(0, questionsPerTopic).map((q: {
              id: string;
              text: string;
              type: 'cause' | 'effect' | 'mechanism' | 'condition';
              variables: string[];
            }) => ({
              id: q.id,
              text: q.text,
              type: q.type,
              variables: q.variables,
              topicId: topic.id,
            }));

            allQuestions.push(...questions);

            setState(s => ({
              ...s,
              progress: {
                ...s.progress!,
                message: `Generated ${allQuestions.length} questions (${i + 1}/${targetTopics.length} topics)...`,
              },
            }));
          }
        } catch (err) {
          console.error('Question generation error:', err);
        }
      }

      addQuestions(allQuestions);

      // STAGE 3: Statement Generation
      setState(s => ({
        ...s,
        currentStage: 'statements',
        progress: { current: 3, total: 4, message: 'Generating statements...' },
      }));
      setStage('statements');

      const targetQuestions = allQuestions.slice(0, 20); // Limit for performance

      for (let i = 0; i < targetQuestions.length; i++) {
        const question = targetQuestions[i];
        try {
          const response = await fetch('/api/llm/statements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: question.text,
              questionId: question.id,
              apiKey: anthropicApiKey || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const statements: CausalStatement[] = data.statements.slice(0, statementsPerQuestion).map((s: {
              id: string;
              text: string;
              cause: string;
              effect: string;
              mechanism: string;
              confidence: number;
            }) => ({
              id: s.id,
              text: s.text,
              cause: s.cause,
              effect: s.effect,
              mechanism: s.mechanism,
              confidence: s.confidence,
              questionId: question.id,
              triples: [],
            }));

            allStatements.push(...statements);

            setState(s => ({
              ...s,
              progress: {
                ...s.progress!,
                message: `Generated ${allStatements.length} statements (${i + 1}/${targetQuestions.length} questions)...`,
              },
            }));
          }
        } catch (err) {
          console.error('Statement generation error:', err);
        }
      }

      addStatements(allStatements);

      // STAGE 4: Triple Extraction
      setState(s => ({
        ...s,
        currentStage: 'triples',
        progress: { current: 4, total: 4, message: 'Extracting triples...' },
      }));
      setStage('triples');

      const targetStatements = allStatements.slice(0, 30); // Limit for performance

      for (let i = 0; i < targetStatements.length; i++) {
        const statement = targetStatements[i];
        try {
          const response = await fetch('/api/llm/triples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              statement: statement.text,
              statementId: statement.id,
              apiKey: anthropicApiKey || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const triples: CausalTriple[] = data.triples.map((t: {
              source: string;
              relation: RelationType;
              target: string;
              confidence: number;
            }) => ({
              source: t.source,
              relation: t.relation,
              target: t.target,
              confidence: t.confidence,
            }));

            allTriples.push(...triples);

            setState(s => ({
              ...s,
              progress: {
                ...s.progress!,
                message: `Extracted ${allTriples.length} triples (${i + 1}/${targetStatements.length} statements)...`,
              },
            }));
          }
        } catch (err) {
          console.error('Triple extraction error:', err);
        }
      }

      addTriples(allTriples);

      // Complete
      setStage('complete');
      setState({
        isRunning: false,
        currentStage: 'complete',
        progress: {
          current: 4,
          total: 4,
          message: `Pipeline complete! ${allTopics.length} topics, ${allQuestions.length} questions, ${allStatements.length} statements, ${allTriples.length} triples`,
        },
        error: null,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Pipeline failed';
      setState(s => ({
        ...s,
        isRunning: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [
    anthropicApiKey,
    maxTopicDepth,
    questionsPerTopic,
    statementsPerQuestion,
    addTopics,
    addQuestions,
    addStatements,
    addTriples,
    resetPipeline,
    startPipeline,
    setStage,
  ]);

  const stopPipeline = useCallback(() => {
    setState(s => ({
      ...s,
      isRunning: false,
      progress: s.progress ? { ...s.progress, message: 'Pipeline stopped' } : null,
    }));
  }, []);

  const clearState = useCallback(() => {
    setState({
      isRunning: false,
      currentStage: 'idle',
      progress: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    runFullPipeline,
    stopPipeline,
    clearState,
  };
}
