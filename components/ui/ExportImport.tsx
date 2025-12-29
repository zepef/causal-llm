'use client';

// DEMOCRITUS - Export/Import Component
// UI for exporting and importing pipeline data

import { useState, useRef } from 'react';
import { usePipelineStore } from '@/stores/pipelineStore';
import {
  exportToJson,
  exportTriplesToCsv,
  exportTopicsToCsv,
  exportQuestionsToCsv,
  exportStatementsToCsv,
  parseImportedJson,
  parseTriplesCsv,
  downloadFile,
  type ExportData,
} from '@/lib/export';

export function ExportImport() {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline store
  const topics = usePipelineStore((s) => s.topics);
  const questions = usePipelineStore((s) => s.questions);
  const statements = usePipelineStore((s) => s.statements);
  const triples = usePipelineStore((s) => s.triples);
  const addTopics = usePipelineStore((s) => s.addTopics);
  const addQuestions = usePipelineStore((s) => s.addQuestions);
  const addStatements = usePipelineStore((s) => s.addStatements);
  const addTriples = usePipelineStore((s) => s.addTriples);
  const resetPipeline = usePipelineStore((s) => s.resetPipeline);

  const hasData = topics.length > 0 || questions.length > 0 || statements.length > 0 || triples.length > 0;

  // Export all data as JSON
  const handleExportJson = () => {
    const data: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      rootTopic: topics.find((t) => t.depth === 0)?.name,
      topics,
      questions,
      statements,
      triples,
    };

    const json = exportToJson(data);
    const filename = `democritus-export-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
  };

  // Export individual data types as CSV
  const handleExportTopicsCsv = () => {
    const csv = exportTopicsToCsv(topics);
    downloadFile(csv, 'democritus-topics.csv', 'text/csv');
  };

  const handleExportQuestionsCsv = () => {
    const csv = exportQuestionsToCsv(questions);
    downloadFile(csv, 'democritus-questions.csv', 'text/csv');
  };

  const handleExportStatementsCsv = () => {
    const csv = exportStatementsToCsv(statements);
    downloadFile(csv, 'democritus-statements.csv', 'text/csv');
  };

  const handleExportTriplesCsv = () => {
    const csv = exportTriplesToCsv(triples);
    downloadFile(csv, 'democritus-triples.csv', 'text/csv');
  };

  // Import data
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();

      if (file.name.endsWith('.json')) {
        const data = parseImportedJson(content);
        if (!data) {
          throw new Error('Invalid JSON format');
        }

        // Reset and import
        resetPipeline();

        if (data.topics.length > 0) addTopics(data.topics);
        if (data.questions.length > 0) addQuestions(data.questions);
        if (data.statements.length > 0) addStatements(data.statements);
        if (data.triples.length > 0) addTriples(data.triples);

        setImportStatus('success');
        setImportMessage(
          `Imported ${data.topics.length} topics, ${data.questions.length} questions, ${data.statements.length} statements, ${data.triples.length} triples`
        );
      } else if (file.name.endsWith('.csv')) {
        // Try to parse as triples CSV
        const importedTriples = parseTriplesCsv(content);
        if (importedTriples.length > 0) {
          addTriples(importedTriples);
          setImportStatus('success');
          setImportMessage(`Imported ${importedTriples.length} triples from CSV`);
        } else {
          throw new Error('No valid triples found in CSV');
        }
      } else {
        throw new Error('Unsupported file format. Use .json or .csv');
      }
    } catch (error) {
      setImportStatus('error');
      setImportMessage(error instanceof Error ? error.message : 'Failed to import file');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setImportStatus('idle');
      setImportMessage('');
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <div>
        <h3 className="text-md font-medium mb-3 flex items-center gap-2">
          <span className="text-lg">📤</span>
          Export Data
        </h3>

        {!hasData ? (
          <p className="text-sm text-gray-500">
            No data to export. Run the pipeline first to generate data.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Full Export */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium">Full Export (JSON)</p>
                <p className="text-xs text-gray-500">
                  All topics, questions, statements, and triples
                </p>
              </div>
              <button
                onClick={handleExportJson}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Export JSON
              </button>
            </div>

            {/* Individual Exports */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportTopicsCsv}
                disabled={topics.length === 0}
                className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-left transition-colors"
              >
                <span className="text-sm font-medium">Topics CSV</span>
                <span className="block text-xs text-gray-500">{topics.length} items</span>
              </button>
              <button
                onClick={handleExportQuestionsCsv}
                disabled={questions.length === 0}
                className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-left transition-colors"
              >
                <span className="text-sm font-medium">Questions CSV</span>
                <span className="block text-xs text-gray-500">{questions.length} items</span>
              </button>
              <button
                onClick={handleExportStatementsCsv}
                disabled={statements.length === 0}
                className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-left transition-colors"
              >
                <span className="text-sm font-medium">Statements CSV</span>
                <span className="block text-xs text-gray-500">{statements.length} items</span>
              </button>
              <button
                onClick={handleExportTriplesCsv}
                disabled={triples.length === 0}
                className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-left transition-colors"
              >
                <span className="text-sm font-medium">Triples CSV</span>
                <span className="block text-xs text-gray-500">{triples.length} items</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-md font-medium mb-3 flex items-center gap-2">
          <span className="text-lg">📥</span>
          Import Data
        </h3>

        <div className="p-4 bg-gray-800 rounded-lg border-2 border-dashed border-gray-700">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="text-center">
            <button
              onClick={handleImport}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Choose File to Import
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Supports .json (full export) or .csv (triples only)
            </p>
          </div>
        </div>

        {/* Import Status */}
        {importStatus !== 'idle' && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              importStatus === 'success'
                ? 'bg-green-900/30 border border-green-800 text-green-400'
                : 'bg-red-900/30 border border-red-800 text-red-400'
            }`}
          >
            {importMessage}
          </div>
        )}
      </div>

      {/* Data Summary */}
      <div className="p-4 bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Current Pipeline Data</h4>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <div className="text-xl font-bold text-white">{topics.length}</div>
            <div className="text-xs text-gray-500">Topics</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">{questions.length}</div>
            <div className="text-xs text-gray-500">Questions</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">{statements.length}</div>
            <div className="text-xs text-gray-500">Statements</div>
          </div>
          <div>
            <div className="text-xl font-bold text-white">{triples.length}</div>
            <div className="text-xs text-gray-500">Triples</div>
          </div>
        </div>
      </div>
    </div>
  );
}
