// src/components/diagrams/ProbabilityTree.tsx
//
// GCSE-style probability tree diagram.
// Renders a 2-stage tree from a config object passed via diagram_params.
//
// Visual conventions (locked with John, session 03/05/2026):
// - Single root point on the left, lines fan out diagonally to stage-1 endpoints
// - Stage-2 fans hang off each stage-1 endpoint (no nodes/dots drawn)
// - Probability labels sit ABOVE upper-half branches, BELOW lower-half branches
//   (clear of the line, never on it)
// - Outcome labels sit just past the line endpoint, at the bend for stage 1
// - Path probabilities (optional) shown at far right as full multiplication:
//   5/8 × 4/7 = 20/56
// - Highlighting (optional): one or more paths drawn in brand red (#E23D28)
//
// Currently implemented: 2-branch symmetric, 2-stage trees, with optional
// highlighting and optional path probabilities. The schema accepts richer
// configs (3+ branches, asymmetric trees, hidden labels, alternative path
// formats) but rendering for those will be added when first needed.

import React from 'react';

// --- Types ---

export type Probability = {
  num: number;
  den: number;
};

export type Branch = {
  outcome: string;
  probability: Probability;
  /** stage 2+ only — which stage-1 outcome this branch hangs off */
  fromOutcome?: string;
  /** render the probability label as blank (for "complete the tree" questions) */
  hidden?: boolean;
  /** highlight this branch in brand red */
  highlight?: boolean;
};

export type Stage = {
  label?: string;
  branches: Branch[];
};

export type PathProbability = {
  /** the sequence of outcomes, e.g. ["Red", "Red"] */
  path: string[];
  probability: Probability;
  /** if true, this path's row is drawn in brand red */
  highlight?: boolean;
};

export type ProbabilityTreeConfig = {
  stages: Stage[];
  showPathProbabilities?: boolean;
  pathProbabilities?: PathProbability[];
};

// --- Constants ---

const ROOT_X = 60;
const ROOT_Y = 230;
const STAGE_1_LEN = 200;
const STAGE_2_LEN = 150;
const STAGE_1_ANGLE_DEG = 25; // ±25° from horizontal for 2 branches
const STAGE_2_ANGLE_DEG = 15; // ±15° from horizontal
const PROB_LABEL_PERP_OFFSET = 26; // perpendicular distance from line midpoint
const OUTCOME_LABEL_GAP = 12; // horizontal gap from line end to outcome label
// The crucial constant: stage-2 lines start this many px to the right of the
// stage-1 endpoint, leaving a clear gap for the bend label (the stage-1
// outcome) to sit in. The line "interrupts" at the word.
const STAGE_GAP_X = 57;
const PATH_PROB_X = 548; // far-right column for path probabilities

const COLOUR_DEFAULT = '#222';
const COLOUR_HIGHLIGHT = '#E23D28';
const STROKE_DEFAULT = 1.2;
const STROKE_HIGHLIGHT = 1.6;
const FONT_FAMILY = 'Helvetica Neue, Helvetica, Arial, sans-serif';

// --- Layout helpers ---

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Compute the angles (in degrees from horizontal) for each branch in a fan.
 * For 2 branches: [-spread, +spread] (positive = upward in screen coords means -y).
 * For 3 branches: [-spread, 0, +spread].
 * For N branches: evenly distributed across [-spread, +spread].
 *
 * Note: in SVG, +y points DOWN. We use the convention that angle > 0 means
 * the branch points UP (toward smaller y). Caller subtracts y when applying.
 */
function fanAngles(count: number, spreadDeg: number): number[] {
  if (count === 1) return [0];
  if (count === 2) return [spreadDeg, -spreadDeg];
  // For N >= 3: evenly distribute from +spread (top) to -spread (bottom)
  const step = (2 * spreadDeg) / (count - 1);
  return Array.from({ length: count }, (_, i) => spreadDeg - i * step);
}

/**
 * Compute endpoint of a line given start, length, and angle (degrees from horizontal).
 * Positive angle = UP (smaller y).
 */
function lineEnd(
  startX: number,
  startY: number,
  length: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = deg2rad(angleDeg);
  return {
    x: startX + length * Math.cos(rad),
    y: startY - length * Math.sin(rad),
  };
}

/**
 * Compute label position for a probability label.
 * Sits at the line's midpoint, offset perpendicular to the line direction.
 * Upper-half branches (angle > 0) get labels ABOVE the line.
 * Lower-half branches (angle < 0) get labels BELOW the line.
 * Horizontal branches (angle == 0) get labels above by convention.
 */
function probLabelPosition(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  angleDeg: number
): { x: number; y: number } {
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  // Perpendicular direction: rotate the line's direction by 90°.
  // Line direction unit vector: (cos a, -sin a) (since +angle = up = -y)
  // Perpendicular "up" (toward smaller y) unit vector: (-sin a, -cos a)
  const rad = deg2rad(angleDeg);
  const perpX = -Math.sin(rad);
  const perpY = -Math.cos(rad);
  // For upper branches (angle >= 0) move along perp (up). For lower branches
  // (angle < 0) move opposite (down).
  const sign = angleDeg >= 0 ? 1 : -1;
  return {
    x: midX + sign * perpX * PROB_LABEL_PERP_OFFSET,
    y: midY + sign * perpY * PROB_LABEL_PERP_OFFSET,
  };
}

// --- Sub-components ---

type FractionProps = {
  num: number;
  den: number;
  cx: number;
  cy: number;
  colour?: string;
  fontSize?: number;
  hidden?: boolean;
};

/**
 * Draws a stacked fraction (numerator over vinculum over denominator) centred
 * at (cx, cy). Drawn in raw SVG (not KaTeX) so positioning and sizing are
 * fully under our control.
 *
 * If hidden is true, renders a dashed placeholder instead of the digits.
 */
function Fraction({
  num,
  den,
  cx,
  cy,
  colour = COLOUR_DEFAULT,
  fontSize = 15,
  hidden = false,
}: FractionProps) {
  const halfWidth = Math.max(
    7,
    4 + 4 * Math.max(String(num).length, String(den).length)
  );

  if (hidden) {
    return (
      <g transform={`translate(${cx}, ${cy})`}>
        <rect
          x={-halfWidth - 3}
          y={-12}
          width={(halfWidth + 3) * 2}
          height={24}
          rx={3}
          fill="none"
          stroke={colour}
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />
      </g>
    );
  }

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <text
        x={0}
        y={-2}
        fontFamily={FONT_FAMILY}
        fontSize={fontSize}
        textAnchor="middle"
        fill={colour}
      >
        <tspan dy={-3}>{num}</tspan>
      </text>
      <line
        x1={-halfWidth}
        y1={0}
        x2={halfWidth}
        y2={0}
        stroke={colour}
        strokeWidth={1}
      />
      <text
        x={0}
        y={13}
        fontFamily={FONT_FAMILY}
        fontSize={fontSize}
        textAnchor="middle"
        fill={colour}
      >
        {den}
      </text>
    </g>
  );
}

// --- Main component ---

export function ProbabilityTree({ config }: { config: ProbabilityTreeConfig }) {
  if (!config?.stages || config.stages.length === 0) {
    return null;
  }

  const stage1 = config.stages[0];
  const stage2 = config.stages[1];
  const stage1Branches = stage1.branches;

  // --- Stage 1 layout ---
  const stage1Angles = fanAngles(stage1Branches.length, STAGE_1_ANGLE_DEG);
  const stage1Endpoints = stage1Branches.map((_, i) =>
    lineEnd(ROOT_X, ROOT_Y, STAGE_1_LEN, stage1Angles[i])
  );

  // --- Stage 2 layout ---
  // For each stage-1 branch, find the stage-2 branches that hang off it.
  // stage 2 branches are matched by their fromOutcome === stage-1 outcome.
  // If no stage-2 branches exist, the tree is 1-stage (still valid).
  //
  // GCSE convention: stage-2 lines do NOT start at the stage-1 line endpoint.
  // They start STAGE_GAP_X to the right of it, leaving a clear gap for the
  // bend label (stage-1 outcome) to sit in. The lines visually "interrupt"
  // at the word — this is what a GCSE student expects to see.
  type Stage2Layout = {
    branch: Branch;
    parentIndex: number;
    angleDeg: number;
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  const stage2Layouts: Stage2Layout[] = [];

  if (stage2) {
    stage1Branches.forEach((s1Branch, parentIndex) => {
      const childBranches = stage2.branches.filter(
        (b) => b.fromOutcome === s1Branch.outcome
      );
      const childAngles = fanAngles(childBranches.length, STAGE_2_ANGLE_DEG);
      const parentEnd = stage1Endpoints[parentIndex];
      // Stage 2 fan starts at parentEnd shifted right by STAGE_GAP_X (same y).
      const fanStart = { x: parentEnd.x + STAGE_GAP_X, y: parentEnd.y };
      childBranches.forEach((b, i) => {
        const end = lineEnd(
          fanStart.x,
          fanStart.y,
          STAGE_2_LEN,
          childAngles[i]
        );
        stage2Layouts.push({
          branch: b,
          parentIndex,
          angleDeg: childAngles[i],
          start: fanStart,
          end,
        });
      });
    });
  }

  // --- Render ---

  // Compute viewBox height dynamically: find max y across all endpoints + buffer.
  const allYs = [
    ROOT_Y,
    ...stage1Endpoints.map((p) => p.y),
    ...stage2Layouts.map((l) => l.end.y),
  ];
  const minY = Math.min(...allYs);
  const maxY = Math.max(...allYs);
  // Add 50px top buffer (for outcome labels above lines) and 50px bottom buffer.
  const vbY = minY - 50;
  const vbHeight = maxY - minY + 100;

  // For path probability rendering, we need to find the y-coordinate of each
  // terminal (stage-2) branch endpoint, or stage-1 endpoint if 1-stage.
  const terminalLayouts = stage2Layouts.length > 0 ? stage2Layouts : null;

  return (
    <svg
      width="100%"
      viewBox={`0 ${vbY} 680 ${vbHeight}`}
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Probability tree diagram</title>
      <desc>
        {config.stages.length}-stage probability tree showing outcomes and
        probabilities.
      </desc>

      {/* Stage 1 lines */}
      {stage1Branches.map((b, i) => {
        const end = stage1Endpoints[i];
        const colour = b.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        const stroke = b.highlight ? STROKE_HIGHLIGHT : STROKE_DEFAULT;
        return (
          <line
            key={`s1-line-${i}`}
            x1={ROOT_X}
            y1={ROOT_Y}
            x2={end.x}
            y2={end.y}
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        );
      })}

      {/* Stage 1 probability labels */}
      {stage1Branches.map((b, i) => {
        const end = stage1Endpoints[i];
        const labelPos = probLabelPosition(
          ROOT_X,
          ROOT_Y,
          end.x,
          end.y,
          stage1Angles[i]
        );
        const colour = b.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        return (
          <Fraction
            key={`s1-prob-${i}`}
            num={b.probability.num}
            den={b.probability.den}
            cx={labelPos.x}
            cy={labelPos.y}
            colour={colour}
            hidden={b.hidden}
          />
        );
      })}

      {/* Stage 1 outcome labels (at the bend / line endpoint) */}
      {stage1Branches.map((b, i) => {
        const end = stage1Endpoints[i];
        const colour = b.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        return (
          <text
            key={`s1-outcome-${i}`}
            x={end.x + OUTCOME_LABEL_GAP}
            y={end.y + 4}
            fontFamily={FONT_FAMILY}
            fontSize={15}
            fontWeight={500}
            fill={colour}
          >
            {b.outcome}
          </text>
        );
      })}

      {/* Stage 2 lines */}
      {stage2Layouts.map((l, i) => {
        const colour = l.branch.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        const stroke = l.branch.highlight ? STROKE_HIGHLIGHT : STROKE_DEFAULT;
        return (
          <line
            key={`s2-line-${i}`}
            x1={l.start.x}
            y1={l.start.y}
            x2={l.end.x}
            y2={l.end.y}
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        );
      })}

      {/* Stage 2 probability labels */}
      {stage2Layouts.map((l, i) => {
        const labelPos = probLabelPosition(
          l.start.x,
          l.start.y,
          l.end.x,
          l.end.y,
          l.angleDeg
        );
        const colour = l.branch.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        return (
          <Fraction
            key={`s2-prob-${i}`}
            num={l.branch.probability.num}
            den={l.branch.probability.den}
            cx={labelPos.x}
            cy={labelPos.y}
            colour={colour}
            hidden={l.branch.hidden}
          />
        );
      })}

      {/* Stage 2 outcome labels */}
      {stage2Layouts.map((l, i) => {
        const colour = l.branch.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
        return (
          <text
            key={`s2-outcome-${i}`}
            x={l.end.x + OUTCOME_LABEL_GAP}
            y={l.end.y + 4}
            fontFamily={FONT_FAMILY}
            fontSize={15}
            fontWeight={500}
            fill={colour}
          >
            {l.branch.outcome}
          </text>
        );
      })}

      {/* Path probabilities at far right (optional) */}
      {config.showPathProbabilities &&
        config.pathProbabilities &&
        terminalLayouts &&
        config.pathProbabilities.map((pp, i) => {
          // Find the matching terminal endpoint by walking the path.
          // We match: stage1 outcome === path[0], stage2 fromOutcome === path[0]
          // and stage2 outcome === path[1].
          const terminal = terminalLayouts.find((l) => {
            const s1 = stage1Branches[l.parentIndex];
            return s1.outcome === pp.path[0] && l.branch.outcome === pp.path[1];
          });
          if (!terminal) return null;

          // Get the stage-1 and stage-2 probabilities for this path.
          const s1Branch = stage1Branches[terminal.parentIndex];
          const s2Branch = terminal.branch;

          const colour = pp.highlight ? COLOUR_HIGHLIGHT : COLOUR_DEFAULT;
          const y = terminal.end.y;

          return (
            <g key={`pp-${i}`} transform={`translate(${PATH_PROB_X}, ${y})`}>
              {/* First fraction (stage 1) */}
              <Fraction
                num={s1Branch.probability.num}
                den={s1Branch.probability.den}
                cx={0}
                cy={4}
                colour={colour}
                fontSize={14}
              />
              {/* × symbol */}
              <text
                x={20}
                y={9}
                fontFamily={FONT_FAMILY}
                fontSize={14}
                fill={colour}
              >
                ×
              </text>
              {/* Second fraction (stage 2) */}
              <Fraction
                num={s2Branch.probability.num}
                den={s2Branch.probability.den}
                cx={40}
                cy={4}
                colour={colour}
                fontSize={14}
              />
              {/* = symbol */}
              <text
                x={60}
                y={9}
                fontFamily={FONT_FAMILY}
                fontSize={14}
                fill={colour}
              >
                =
              </text>
              {/* Result fraction */}
              <Fraction
                num={pp.probability.num}
                den={pp.probability.den}
                cx={86}
                cy={4}
                colour={colour}
                fontSize={14}
              />
            </g>
          );
        })}
    </svg>
  );
}

export default ProbabilityTree;
