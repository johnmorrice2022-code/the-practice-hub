// src/components/diagrams/questionDiagramRegistry.tsx
//
// Registry for parametric question diagrams rendered inside QuestionCard,
// FeedbackCard and LearningContent.
//
// This is intentionally separate from the InteractiveSection registry
// (used for learning_content) — this one is for diagrams that accompany
// a seeded_questions / questions row, driven by the
// (diagram_component, diagram_params) columns.
//
// Rendering contexts (see DIAGRAMS.md, Section 2):
// - `mode` prop: components may carry feedback-only layers (e.g. a resultant
//   arrow, answer labels, drawn-in hidden histogram bars) that render only
//   when mode === 'feedback'. Default is 'question' so an unknown caller can
//   never leak an answer. Components without feedback layers ignore the prop.
// - `questionSafe`: whether the diagram may appear in QuestionCard at all.
//   `false` marks diagrams whose entire purpose is to show the answer
//   (worked-solution only). May be a predicate of params where safety
//   depends on the specific params. FeedbackCard ignores this flag.
//
// To register a new diagram component:
//   1. Build the component in src/components/diagrams/ (schema in DIAGRAMS.md)
//   2. Add an entry to QUESTION_DIAGRAM_REGISTRY below with a questionSafe flag
//   3. Author question rows with diagram_component = the registry key
//      and diagram_params = the config the component expects.

import React from 'react';
import { ProbabilityTree } from './ProbabilityTree';
import { QuadraticInequalityGraph } from './QuadraticInequalityGraph';
import { CompletingTheSquareAreaModel } from './CompletingTheSquareAreaModel';
import { ParabolaVertexGraph } from './ParabolaVertexGraph';
import { FreeBodyDiagram } from './FreeBodyDiagram';
import { VectorDiagram } from './VectorDiagram';
import { WaveDiagram } from './WaveDiagram';
import { WaveDiagramEditor } from './editors/WaveDiagramEditor';

export type DiagramMode = 'question' | 'feedback';

// Each registered component receives `params: any` (the JSONB from
// diagram_params) and an optional rendering context. The component is
// responsible for validating the shape of its own params and rendering
// nothing if the params are invalid.
export type QuestionDiagramComponent = React.FC<{
  params: any;
  mode?: DiagramMode;
}>;

// Touch-first structured params editor for the Seeded Question Composer.
// Builds diagram_params from form controls — no JSON. Optional per registry
// entry; families without one are not yet authorable in the composer.
export type DiagramEditorComponent = React.FC<{
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}>;

export interface QuestionDiagramRegistryEntry {
  component: QuestionDiagramComponent;
  /** May this diagram appear in QuestionCard? Predicate form for diagrams
      whose safety depends on their params. FeedbackCard renders everything. */
  questionSafe: boolean | ((params: any) => boolean);
  /** Touch-first params editor for the Seeded Question Composer. */
  editor?: DiagramEditorComponent;
  /** Sensible starting params when this family is picked in the composer. */
  editorDefaults?: Record<string, unknown>;
  /** Human label for the composer family picker. */
  label?: string;
}

// Wrappers adapt component signatures to the common (params, mode) shape.
const ProbabilityTreeWrapper: QuestionDiagramComponent = ({ params }) => (
  <ProbabilityTree config={params} />
);

const QuadraticInequalityGraphWrapper: QuestionDiagramComponent = ({ params }) => (
  <QuadraticInequalityGraph params={params} />
);

const CompletingTheSquareAreaModelWrapper: QuestionDiagramComponent = ({ params }) => (
  <CompletingTheSquareAreaModel params={params} />
);

const ParabolaVertexGraphWrapper: QuestionDiagramComponent = ({ params }) => (
  <ParabolaVertexGraph params={params} />
);

const FreeBodyDiagramWrapper: QuestionDiagramComponent = ({ params, mode }) => (
  <FreeBodyDiagram params={params} mode={mode} />
);

const VectorDiagramWrapper: QuestionDiagramComponent = ({ params, mode }) => (
  <VectorDiagram params={params} mode={mode} />
);

const WaveDiagramWrapper: QuestionDiagramComponent = ({ params, mode }) => (
  <WaveDiagram params={params} mode={mode} />
);

export const QUESTION_DIAGRAM_REGISTRY: Record<
  string,
  QuestionDiagramRegistryEntry
> = {
  'probability-tree': {
    component: ProbabilityTreeWrapper,
    questionSafe: true,
  },
  // Shows the highlighted answer region — worked-solution only.
  'quadratic-inequality-graph': {
    component: QuadraticInequalityGraphWrapper,
    questionSafe: false,
  },
  'completing-the-square-area-model': {
    component: CompletingTheSquareAreaModelWrapper,
    questionSafe: true,
  },
  // Draws the vertex coordinates, which is usually the answer —
  // worked-solution only (decision 11/06/2026, DIAGRAMS.md Q4).
  'parabola-vertex-graph': {
    component: ParabolaVertexGraphWrapper,
    questionSafe: false,
  },
  // AQA Physics force diagram. The resultant arrow is a feedback-only layer
  // gated by `mode`, so the diagram itself is question-safe.
  'free-body-diagram': {
    component: FreeBodyDiagramWrapper,
    questionSafe: true,
  },
  // Physics scale drawings + Edexcel column vectors. The resultant is a
  // feedback-only layer gated by `mode`, so the diagram is question-safe.
  'vector-diagram': {
    component: VectorDiagramWrapper,
    questionSafe: true,
  },
  // AQA Physics waves. `answerLabels` is a feedback-only layer gated by
  // `mode` ("label the wavelength" questions), so the diagram is question-safe.
  'wave-diagram': {
    component: WaveDiagramWrapper,
    questionSafe: true,
    editor: WaveDiagramEditor,
    editorDefaults: { type: 'transverse', cycles: 3 },
    label: 'Wave',
  },
  // Future entries (DIAGRAMS.md): 'histogram', 'vector-geometry-diagram',
  // 'circuit-diagram'.
};

/**
 * Look up a registered question diagram component by key.
 * Returns null if the key is not registered (so callers can fall back
 * to diagram_url or render no diagram).
 */
export function getQuestionDiagram(
  key: string | null | undefined
): QuestionDiagramComponent | null {
  if (!key) return null;
  return QUESTION_DIAGRAM_REGISTRY[key]?.component ?? null;
}

/**
 * May this diagram be rendered in QuestionCard with these params?
 * Unknown keys return false (QuestionCard has nothing to render anyway).
 * A predicate that throws on malformed params counts as unsafe.
 */
export function isQuestionSafe(
  key: string | null | undefined,
  params: unknown
): boolean {
  if (!key) return false;
  const entry = QUESTION_DIAGRAM_REGISTRY[key];
  if (!entry) return false;
  if (typeof entry.questionSafe === 'function') {
    try {
      return entry.questionSafe(params);
    } catch {
      return false;
    }
  }
  return entry.questionSafe;
}
