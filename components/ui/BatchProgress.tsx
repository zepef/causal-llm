'use client';

// DEMOCRITUS - Batch Progress Component
// Shows progress of batch operations

import type { BatchProgress as BatchProgressType } from '@/hooks/useBatchProcessor';

interface BatchProgressProps {
  progress: BatchProgressType;
  onCancel?: () => void;
}

export function BatchProgress({ progress, onCancel }: BatchProgressProps) {
  const { total, completed, current, isRunning, errors } = progress;

  if (total === 0 && !isRunning) {
    return null;
  }

  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="animate-spin text-blue-400">⟳</span>
          )}
          <span className="text-sm font-medium text-white">
            {isRunning ? 'Processing...' : 'Batch Complete'}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {completed}/{total}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            isRunning ? 'bg-blue-500' : errors.length > 0 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Current Item */}
      {current && (
        <p className="text-xs text-gray-400 truncate mb-2">
          {isRunning ? `Processing: ${current}` : current}
        </p>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto">
          <p className="text-xs text-red-400 mb-1">{errors.length} error(s):</p>
          {errors.slice(0, 3).map((error, i) => (
            <p key={i} className="text-xs text-red-300 truncate">
              • {error}
            </p>
          ))}
          {errors.length > 3 && (
            <p className="text-xs text-red-400">...and {errors.length - 3} more</p>
          )}
        </div>
      )}

      {/* Cancel Button */}
      {isRunning && onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 px-3 py-1 text-xs bg-red-600/30 text-red-400 rounded hover:bg-red-600/50 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
