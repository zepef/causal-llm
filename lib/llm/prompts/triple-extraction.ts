// DEMOCRITUS - Relational Triple Extraction Prompt
// Module 4: Extract structured (source, relation, target) triples

import type { RelationType } from '@/types/graph';

/**
 * System prompt for triple extraction
 */
export const TRIPLE_EXTRACTION_SYSTEM = `You are an expert at extracting structured causal relationships from natural language.
Your goal is to convert causal statements into precise relational triples of the form:
(source_concept, relation_type, target_concept)

Focus on:
1. Normalizing concept names (consistent, lowercase-friendly)
2. Choosing the most precise relation type
3. Preserving the directionality of causation
4. Maintaining atomic relationships`;

/**
 * Relation type descriptions for the prompt
 */
export const RELATION_DESCRIPTIONS: Record<RelationType, string> = {
  causes: 'Direct causation (X causes Y)',
  enables: 'Necessary condition (X enables Y, but may not be sufficient)',
  prevents: 'Inhibitory effect (X prevents or blocks Y)',
  increases: 'Positive quantitative effect (X increases Y)',
  decreases: 'Negative quantitative effect (X decreases Y)',
  correlates_with: 'Statistical association without clear causation',
  requires: 'Prerequisite (Y requires X)',
  produces: 'Generates as output (X produces Y)',
  inhibits: 'Suppresses or reduces (X inhibits Y)',
  modulates: 'Adjusts intensity (X modulates Y)',
  triggers: 'Initiates (X triggers Y)',
  amplifies: 'Strengthens effect (X amplifies Y)',
  mediates: 'Intermediate mechanism (X mediates between A and B)',
};

/**
 * Generate the triple extraction prompt
 */
export function tripleExtractionPrompt(statement: string): string {
  const relationTypesList = Object.entries(RELATION_DESCRIPTIONS)
    .map(([type, desc]) => `- ${type}: ${desc}`)
    .join('\n');

  return `Extract causal triples from this statement:

"${statement}"

A causal triple has the form: (source_concept, relation_type, target_concept)

Available relation types:
${relationTypesList}

Format as JSON:
{
  "triples": [
    {
      "source": "concept name (normalized, lowercase-friendly)",
      "relation": "relation_type",
      "target": "concept name (normalized, lowercase-friendly)",
      "confidence": 0.95
    }
  ]
}

Guidelines:
1. Normalize concept names: use consistent naming (e.g., "river discharge" not "discharge of rivers")
2. Extract ALL causal relationships, even implicit ones
3. Choose the most specific relation type
4. Maintain causation direction (source → target)
5. For complex statements, extract multiple triples

Example:
Statement: "Reduced monsoon rainfall decreases Indus river discharge, which in turn affects agricultural productivity"

Output:
{
  "triples": [
    {
      "source": "monsoon rainfall",
      "relation": "increases",
      "target": "river discharge",
      "confidence": 0.95
    },
    {
      "source": "river discharge",
      "relation": "increases",
      "target": "agricultural productivity",
      "confidence": 0.85
    }
  ]
}`;
}

/**
 * Type for parsed triple extraction response
 */
export interface TripleExtractionResponse {
  triples: Array<{
    source: string;
    relation: RelationType;
    target: string;
    confidence: number;
  }>;
}

/**
 * Batch extraction prompt for multiple statements
 */
export function batchTripleExtractionPrompt(statements: string[]): string {
  const statementsText = statements
    .map((s, i) => `${i + 1}. "${s}"`)
    .join('\n');

  return `Extract causal triples from these statements:

${statementsText}

For each statement, extract all causal relationships.

Format as JSON:
{
  "results": [
    {
      "statementIndex": 0,
      "triples": [
        {
          "source": "concept name",
          "relation": "relation_type",
          "target": "concept name",
          "confidence": 0.95
        }
      ]
    }
  ]
}

Relation types: causes, enables, prevents, increases, decreases, correlates_with, requires, produces, inhibits, modulates, triggers, amplifies, mediates`;
}

/**
 * Type for batch extraction response
 */
export interface BatchTripleExtractionResponse {
  results: Array<{
    statementIndex: number;
    triples: Array<{
      source: string;
      relation: RelationType;
      target: string;
      confidence: number;
    }>;
  }>;
}
