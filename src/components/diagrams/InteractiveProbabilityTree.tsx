// src/components/diagrams/InteractiveProbabilityTree.tsx
//
// Wraps ProbabilityTree with HTML input overlays for hidden branches.
// Used in QuestionCard when diagramComponent === 'probability-tree' and
// the question has at least one hidden branch (a "complete the tree" question).

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ProbabilityTree, HiddenPosition } from './ProbabilityTree';
import type { ProbabilityTreeConfig } from './ProbabilityTree';

// --- Types ---

export type FractionValue = { num: string; den: string };
export type TreeAnswers = Record<string, FractionValue>;

interface InteractiveProbabilityTreeProps {
  config: ProbabilityTreeConfig;
  onChange: (values: TreeAnswers) => void;
  values: TreeAnswers;
  disabled?: boolean;
}

// --- Coordinate conversion ---

function parseViewBox(
  vb: string
): { minX: number; minY: number; w: number; h: number } | null {
  const parts = vb.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { minX: parts[0], minY: parts[1], w: parts[2], h: parts[3] };
}

/**
 * Convert SVG-space (cx, cy) to pixel offsets relative to the container div.
 * Accounts for preserveAspectRatio xMidYMid meet (SVG default).
 */
function svgToContainer(
  cx: number,
  cy: number,
  svgEl: SVGSVGElement,
  containerEl: HTMLDivElement
): { left: number; top: number } | null {
  const vbAttr = svgEl.getAttribute('data-vb');
  if (!vbAttr) return null;
  const vb = parseViewBox(vbAttr);
  if (!vb) return null;

  const svgRect = svgEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  const scaleX = svgRect.width / vb.w;
  const scaleY = svgRect.height / vb.h;
  const scale = Math.min(scaleX, scaleY);

  const renderedW = vb.w * scale;
  const renderedH = vb.h * scale;

  // xMidYMid centering offsets within the SVG element
  const offsetX = (svgRect.width - renderedW) / 2;
  const offsetY = (svgRect.height - renderedH) / 2;

  const pxInSvgX = (cx - vb.minX) * scale + offsetX;
  const pxInSvgY = (cy - vb.minY) * scale + offsetY;

  const svgOffsetLeft = svgRect.left - containerRect.left;
  const svgOffsetTop = svgRect.top - containerRect.top;

  return {
    left: svgOffsetLeft + pxInSvgX,
    top: svgOffsetTop + pxInSvgY,
  };
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
  const inputBase: React.CSSProperties = {
    width: 32,
    height: 22,
    fontSize: 13,
    textAlign: 'center',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
    color: '#222',
    padding: 0,
    lineHeight: 1,
    display: 'block',
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
        pointerEvents: disabled ? 'none' : 'auto',
        zIndex: 10,
        background: 'rgba(250,247,242,0.92)',
        borderRadius: 4,
        padding: '2px 4px',
        boxShadow: disabled
          ? 'none'
          : '0 0 0 1.5px #F5A623, 0 2px 6px rgba(245,166,35,0.2)',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={value.num}
        onChange={(e) => onChange(id, 'num', e.target.value)}
        disabled={disabled}
        aria-label={`Numerator for branch ${id}`}
        style={inputBase}
      />
      <div
        style={{ width: 28, height: 1, background: '#F5A623', margin: '1px 0' }}
      />
      <input
        type="text"
        inputMode="numeric"
        value={value.den}
        onChange={(e) => onChange(id, 'den', e.target.value)}
        disabled={disabled}
        aria-label={`Denominator for branch ${id}`}
        style={inputBase}
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

  // Hidden positions in SVG space — captured synchronously during ProbabilityTree render
  const hiddenPositionsRef = useRef<HiddenPosition[]>([]);

  // DOM positions — pixel coords relative to container, triggers re-render
  const [domPositions, setDomPositions] = useState<
    Record<string, { left: number; top: number }>
  >({});

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector('svg') as SVGSVGElement | null;
    if (!svgEl) return;
    const positions = hiddenPositionsRef.current;
    if (positions.length === 0) return;

    const next: Record<string, { left: number; top: number }> = {};
    for (const hp of positions) {
      const pos = svgToContainer(hp.cx, hp.cy, svgEl, container);
      if (pos) next[hp.id] = pos;
    }
    setDomPositions(next);
  }, []);

  // Capture hidden positions during ProbabilityTree render (called synchronously in render)
  const handleHiddenPositions = useCallback((positions: HiddenPosition[]) => {
    hiddenPositionsRef.current = positions;
  }, []);

  // Run after every commit to keep positions in sync (useLayoutEffect avoids flash)
  // Guard against infinite loop: only call setDomPositions when values actually change
  const prevPositionsRef = useRef<string>('');
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector('svg') as SVGSVGElement | null;
    if (!svgEl) return;
    const positions = hiddenPositionsRef.current;
    if (positions.length === 0) return;

    const next: Record<string, { left: number; top: number }> = {};
    for (const hp of positions) {
      const pos = svgToContainer(hp.cx, hp.cy, svgEl, container);
      if (pos) next[hp.id] = pos;
    }

    const serialised = JSON.stringify(next);
    if (serialised !== prevPositionsRef.current) {
      prevPositionsRef.current = serialised;
      setDomPositions(next);
    }
  });

  // Recompute on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recompute]);

  const handleChange = useCallback(
    (id: string, field: 'num' | 'den', val: string) => {
      const current = values[id] ?? { num: '', den: '' };
      onChange({ ...values, [id]: { ...current, [field]: val } });
    },
    [values, onChange]
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <ProbabilityTree
        config={config}
        onHiddenPositions={handleHiddenPositions}
      />

      {hiddenPositionsRef.current.map((hp) => {
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
