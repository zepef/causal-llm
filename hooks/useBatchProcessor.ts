// DEMOCRITUS - Batch Processing Hook
// Run LLM operations on multiple items in sequence with progress tracking

import { useState, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

export interface BatchProgress {
  total: number;
  completed: number;
  current: string;
  isRunning: boolean;
  errors: string[];
}

interface BatchProcessorOptions<T, R> {
  items: T[];
  processor: (item: T, apiKey?: string) => Promise<R>;
  onItemComplete?: (item: T, result: R, index: number) => void;
  onComplete?: (results: R[]) => void;
  onError?: (item: T, error: Error, index: number) => void;
  getItemLabel?: (item: T) => string;
  delayBetweenItems?: number;
}

export function useBatchProcessor<T, R>() {
  const [progress, setProgress] = useState<BatchProgress>({
    total: 0,
    completed: 0,
    current: '',
    isRunning: false,
    errors: [],
  });

  const abortRef = useRef(false);
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);

  const processBatch = useCallback(async (options: BatchProcessorOptions<T, R>) => {
    const {
      items,
      processor,
      onItemComplete,
      onComplete,
      onError,
      getItemLabel = () => 'item',
      delayBetweenItems = 500,
    } = options;

    if (items.length === 0) {
      return [];
    }

    abortRef.current = false;
    const results: R[] = [];
    const errors: string[] = [];

    setProgress({
      total: items.length,
      completed: 0,
      current: getItemLabel(items[0]),
      isRunning: true,
      errors: [],
    });

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) {
        setProgress((p) => ({ ...p, isRunning: false, current: 'Cancelled' }));
        break;
      }

      const item = items[i];
      const label = getItemLabel(item);

      setProgress((p) => ({
        ...p,
        current: label,
      }));

      try {
        const result = await processor(item, anthropicApiKey || undefined);
        results.push(result);
        onItemComplete?.(item, result, i);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${label}: ${errorMessage}`);
        onError?.(item, error as Error, i);
      }

      setProgress((p) => ({
        ...p,
        completed: i + 1,
        errors,
      }));

      // Delay between items to avoid rate limiting
      if (i < items.length - 1 && delayBetweenItems > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenItems));
      }
    }

    setProgress((p) => ({
      ...p,
      isRunning: false,
      current: 'Complete',
    }));

    onComplete?.(results);
    return results;
  }, [anthropicApiKey]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setProgress({
      total: 0,
      completed: 0,
      current: '',
      isRunning: false,
      errors: [],
    });
  }, []);

  return {
    progress,
    processBatch,
    abort,
    reset,
    isRunning: progress.isRunning,
  };
}
