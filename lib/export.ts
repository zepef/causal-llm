// DEMOCRITUS - Export/Import Utilities
// Functions for exporting and importing pipeline data

import type { TopicNode, CausalQuestion, CausalStatement, CausalTriple } from '@/types/graph';

export interface ExportData {
  version: string;
  exportedAt: string;
  rootTopic?: string;
  topics: TopicNode[];
  questions: CausalQuestion[];
  statements: CausalStatement[];
  triples: CausalTriple[];
}

/**
 * Export pipeline data to JSON format
 */
export function exportToJson(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export triples to CSV format
 */
export function exportTriplesToCsv(triples: CausalTriple[]): string {
  const headers = ['source', 'relation', 'target', 'confidence'];
  const rows = triples.map((t) => [
    escapeCSV(t.source),
    escapeCSV(t.relation),
    escapeCSV(t.target),
    t.confidence?.toString() || '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export topics to CSV format
 */
export function exportTopicsToCsv(topics: TopicNode[]): string {
  const headers = ['id', 'name', 'description', 'causalRelevance', 'depth', 'parentId'];
  const rows = topics.map((t) => [
    escapeCSV(t.id),
    escapeCSV(t.name),
    escapeCSV(t.description || ''),
    escapeCSV(t.causalRelevance || ''),
    t.depth.toString(),
    escapeCSV(t.parentId || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export questions to CSV format
 */
export function exportQuestionsToCsv(questions: CausalQuestion[]): string {
  const headers = ['id', 'text', 'type', 'topicId', 'variables'];
  const rows = questions.map((q) => [
    escapeCSV(q.id),
    escapeCSV(q.text),
    escapeCSV(q.type),
    escapeCSV(q.topicId || ''),
    escapeCSV(q.variables.join('; ')),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export statements to CSV format
 */
export function exportStatementsToCsv(statements: CausalStatement[]): string {
  const headers = ['id', 'text', 'cause', 'effect', 'mechanism', 'confidence', 'questionId'];
  const rows = statements.map((s) => [
    escapeCSV(s.id),
    escapeCSV(s.text),
    escapeCSV(s.cause || ''),
    escapeCSV(s.effect || ''),
    escapeCSV(s.mechanism || ''),
    s.confidence.toString(),
    escapeCSV(s.questionId || ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Parse imported JSON data
 */
export function parseImportedJson(jsonString: string): ExportData | null {
  try {
    const data = JSON.parse(jsonString);

    // Validate basic structure
    if (!data.topics || !data.questions || !data.statements || !data.triples) {
      throw new Error('Invalid export format: missing required fields');
    }

    return {
      version: data.version || '1.0',
      exportedAt: data.exportedAt || new Date().toISOString(),
      rootTopic: data.rootTopic,
      topics: data.topics,
      questions: data.questions,
      statements: data.statements,
      triples: data.triples,
    };
  } catch (error) {
    console.error('Failed to parse import data:', error);
    return null;
  }
}

/**
 * Parse triples from CSV format
 */
export function parseTriplesCsv(csvString: string): CausalTriple[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const sourceIdx = headers.indexOf('source');
  const relationIdx = headers.indexOf('relation');
  const targetIdx = headers.indexOf('target');
  const confidenceIdx = headers.indexOf('confidence');

  if (sourceIdx === -1 || relationIdx === -1 || targetIdx === -1) {
    throw new Error('CSV must have source, relation, and target columns');
  }

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    return {
      source: values[sourceIdx] || '',
      relation: values[relationIdx] as CausalTriple['relation'],
      target: values[targetIdx] || '',
      confidence: confidenceIdx !== -1 ? parseFloat(values[confidenceIdx]) || undefined : undefined,
    };
  });
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
