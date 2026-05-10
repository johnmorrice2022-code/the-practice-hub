// src/components/diagrams/InteractiveProbabilityTree.tsx
//
// Wraps ProbabilityTree with HTML input overlays for hidden branches.
// Used in QuestionCard when diagramComponent === 'probability-tree' and
// the question has at least one hidden branch (a "complete the tree" question).
//
// Architecture:
// - Renders ProbabilityTree inside a relative-positioned container
// - ProbabilityTree fires onHiddenPositions with SVG-space coords of each
//   hidden placeholder during render
// - A ResizeObserver watches the SVG element's rendered size
// - On every render + resize, SVG coords are mapped to DOM coords using the
//   viewBox transform, and fraction inputs are absolutely positioned over
//   each placeholder
// - Student values bubble up via onChange

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProbabilityTree, HiddenPosition } from './ProbabilityTree';
import type { ProbabilityTreeConfig } from './ProbabilityTree';

// --- Types ---

export type FractionValue = { num: string; den: string };
export type TreeAnswers = Record<string, FractionValue>;

interface InteractiveProbabilityTreeProps {
  config: ProbabilityTreeConfig;
  /** Called whenever the student changes any input */
  onChange: (values: TreeAnswers) => void;
  /** Current answer values (controlled) */
  values: TreeAnswers;
  /** When true, inputs are disabled (review mode) */
  disabled?: boolean;
}

// --- Coordinate helpers ---

/**
 * Parse a viewBox string "minX minY width height" into its components.
 */
function parseViewBox(
  vb: string
): { minX: number; minY: number; w: number; h: number } | null {
  const parts = vb.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { minX: parts[0], minY: parts[1], w: parts[2], h: parts[3] };
}

/**
 * Convert an SVG-space point to a CSS absolute position within the SVG's
 * bounding box, accounting for the viewBox transform (preserveAspectRatio
 * xMidYMid meet, which is the SVG default).
 *
 * Returns { left, top } as percentage strings for use in style.
 */
function svgToDOM(
  cx: number,
  cy: number,
  svgEl: SVGSVGElement
): { left: number; top: number } | null {
  const vbAttr = svgEl.getAttribute('data-vb') || svgEl.getAttribute('viewBox');
  if (!vbAttr) return null;
  const vb = parseViewBox(vbAttr);
  if (!vb) return null;

  const rect = svgEl.getBoundingClientRect();
  const containerEl = svgEl.parentElement;
  if (!containerEl) return null;
  const containerRect = containerEl.getBoundingClientRect();

  // SVG renders with preserveAspectRatio xMidYMid meet by default.
  // Compute the scale and offset that maps viewBox coords to rendered pixels.
  const scaleX = rect.width / vb.w;
  const scaleY = rect.height / vb.h;
  const scale = Math.min(scaleX, scaleY);

  // The SVG element itself may be smaller than its bounding box due to meet.
  const renderedW = vb.w * scale;
  const renderedH = vb.h * scale;

  // Offset of rendered content within the SVG element (centred by xMidYMid)
  const offsetX = (rect.width - renderedW) / 2;
  const offsetY = (rect.height - renderedH) / 2;

  // Map SVG coords to pixels within the SVG element
  const pxX = (cx - vb.minX) * scale + offsetX;
  const pxY = (cy - vb.minY) * scale + offsetY;

  // Convert to pixels relative to the container (the relative-positioned div)
  const left = rect.left - containerRect.left + pxX;
  const top = rect.top - containerRect.top + pxY;

  return { left, top };
}

// --- FractionInput ---

interface FractionInputProps {
  id: string;
  value: FractionValue;
  onChange: (id: string, field: 'num' | 'den', val: string) => void;
  disabled: boolean;
  left: number;
  top: number;
}

function FractionInput({
  id,
  value,
  onChange,
  disabled,
  left,
  top,
}: FractionInputProps) {
  const inputStyle: React.CSSProperties = {
    width: 28,
    height: 20,
    fontSize: 12,
    textAlign: 'center',
    border: 'none',
    borderBottom: '1px solid #F5A623',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    color: '#222',
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        pointerEvents: disabled ? 'none' : 'auto',
        zIndex: 10,
      }}
    >
      {/* Numerator */}
      <input
        type="text"
        inputMode="numeric"
        value={value.num}
        onChange={(e) => onChange(id, 'num', e.target.value)}
        disabled={disabled}
        aria-label={`Numerator for branch ${id}`}
        style={inputStyle}
      />
      {/* Vinculum */}
      <div
        style={{
          width: 28,
          height: 1,
          background: '#F5A623',
          margin: '1px 0',
        }}
      />
      {/* Denominator */}
      <input
        type="text"
        inputMode="numeric"
        value={value.den}
        onChange={(e) => onChange(id, 'den', e.target.value)}
        disabled={disabled}
        aria-label={`Denominator for branch ${id}`}
        style={inputStyle}
      />
    </div>
  );
}

// --- Main component ---

export function InteractiveProbabilityTree({
  config,
  onChange,
  values,
  disabled = false,
}: InteractiveProbabilityTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Hidden positions in SVG space — set during ProbabilityTree render
  const [hiddenPositions, setHiddenPositions] = useState<HiddenPosition[]>([]);

  // DOM positions — recomputed on resize
  const [domPositions, setDomPositions] = useState<
    Record<string, { left: number; top: number }>
  >({});

  // Recompute DOM positions from SVG-space positions
  const recompute = useCallback(() => {
    if (!svgRef.current || hiddenPositions.length === 0) return;
    const next: Record<string, { left: number; top: number }> = {};
    for (const hp of hiddenPositions) {
      const pos = svgToDOM(hp.cx, hp.cy, svgRef.current);
      if (pos) next[hp.id] = pos;
    }
    setDomPositions(next);
  }, [hiddenPositions]);

  // Watch container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    recompute();
    return () => ro.disconnect();
  }, [recompute]);

  // Also recompute when hidden positions change (new question loaded)
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Find the SVG element after first render
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (svg) svgRef.current = svg as SVGSVGElement;
    recompute();
  });

  const handlePositions = useCallback((positions: HiddenPosition[]) => {
    setHiddenPositions(positions);
  }, []);

  const handleChange = useCallback(
    (id: string, field: 'num' | 'den', val: string) => {
      const current = values[id] ?? { num: '', den: '' };
      onChange({ ...values, [id]: { ...current, [field]: val } });
    },
    [values, onChange]
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <ProbabilityTree config={config} onHiddenPositions={handlePositions} />

      {/* Overlay inputs for each hidden branch */}
      {hiddenPositions.map((hp) => {
        const pos = domPositions[hp.id];
        if (!pos) return null;
        return (
          <FractionInput
            key={hp.id}
            id={hp.id}
            value={values[hp.id] ?? { num: '', den: '' }}
            onChange={handleChange}
            disabled={disabled}
            left={pos.left}
            top={pos.top}
          />
        );
      })}
    </div>
  );
}

export default InteractiveProbabilityTree;
