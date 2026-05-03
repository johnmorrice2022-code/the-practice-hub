// src/components/diagrams/questionDiagramRegistry.tsx
//
// Registry for parametric question diagrams rendered inside QuestionCard.
//
// This is intentionally separate from the InteractiveSection registry
// (used for learning_content) — this one is for diagrams that accompany
// a seeded_questions row, driven by the (diagram_component, diagram_params)
// columns added in the 2026_05_03 schema migration.
//
// To register a new diagram component:
//   1. Build the component in src/components/diagrams/
//   2. Add an entry to QUESTION_DIAGRAM_REGISTRY below
//   3. Author seeded_questions rows with diagram_component = the registry key
//      and diagram_params = the config the component expects.

import React from 'react';
import { ProbabilityTree } from './ProbabilityTree';

// Each registered component receives `params: any` (the JSONB from
// diagram_params). The component is responsible for validating the shape
// of its own params and rendering nothing if the params are invalid.
type QuestionDiagramComponent = React.FC<{ params: any }>;

// Wrappers adapt component signatures to the common (params) shape.
const ProbabilityTreeWrapper: QuestionDiagramComponent = ({ params }) => (
  <ProbabilityTree config={params} />
);

export const QUESTION_DIAGRAM_REGISTRY: Record<
  string,
  QuestionDiagramComponent
> = {
  'probability-tree': ProbabilityTreeWrapper,
  // Future entries: 'venn-diagram', 'two-way-table', 'frequency-tree', etc.
};

/**
 * Look up a registered question diagram component by key.
 * Returns null if the key is not registered (so QuestionCard can fall back
 * to diagram_url or render no diagram).
 */
export function getQuestionDiagram(
  key: string | null | undefined
): QuestionDiagramComponent | null {
  if (!key) return null;
  return QUESTION_DIAGRAM_REGISTRY[key] ?? null;
}
