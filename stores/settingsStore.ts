// DEMOCRITUS - Settings state management
// Stores user preferences and API configuration

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // API Configuration
  anthropicApiKey: string;

  // LLM Settings
  llmModel: 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-20240229';
  maxTokens: number;
  temperature: number;

  // Pipeline Settings
  maxTopicDepth: number;
  questionsPerTopic: number;
  statementsPerQuestion: number;

  // Visualization Settings
  graphDimensions: 2 | 3;
  showEdgeLabels: boolean;
  nodeSize: number;

  // Actions
  setAnthropicApiKey: (key: string) => void;
  setLlmModel: (model: SettingsState['llmModel']) => void;
  setMaxTokens: (tokens: number) => void;
  setTemperature: (temp: number) => void;
  setMaxTopicDepth: (depth: number) => void;
  setQuestionsPerTopic: (count: number) => void;
  setStatementsPerQuestion: (count: number) => void;
  setGraphDimensions: (dims: 2 | 3) => void;
  setShowEdgeLabels: (show: boolean) => void;
  setNodeSize: (size: number) => void;
  resetToDefaults: () => void;
}

const defaultSettings = {
  anthropicApiKey: '',
  llmModel: 'claude-sonnet-4-20250514' as const,
  maxTokens: 4096,
  temperature: 0.7,
  maxTopicDepth: 3,
  questionsPerTopic: 5,
  statementsPerQuestion: 3,
  graphDimensions: 3 as const,
  showEdgeLabels: true,
  nodeSize: 5,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
      setLlmModel: (model) => set({ llmModel: model }),
      setMaxTokens: (tokens) => set({ maxTokens: tokens }),
      setTemperature: (temp) => set({ temperature: temp }),
      setMaxTopicDepth: (depth) => set({ maxTopicDepth: depth }),
      setQuestionsPerTopic: (count) => set({ questionsPerTopic: count }),
      setStatementsPerQuestion: (count) => set({ statementsPerQuestion: count }),
      setGraphDimensions: (dims) => set({ graphDimensions: dims }),
      setShowEdgeLabels: (show) => set({ showEdgeLabels: show }),
      setNodeSize: (size) => set({ nodeSize: size }),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'democritus-settings',
    }
  )
);

// Selector for API key availability
export const useHasApiKey = () => useSettingsStore((state) => !!state.anthropicApiKey);
