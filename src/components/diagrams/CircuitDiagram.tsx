// CircuitDiagram.tsx
// AQA GCSE Physics — Electricity. Parametric circuit diagrams built from the
// AQA 8463 symbol set on a constrained topology (see DIAGRAMS.md Section 8):
//   - one series loop (supply on the top edge, series components on the bottom)
//   - plus an optional parallel section of up to 3 branches (≤3 components each)
//
// Rendering engine ported from the signed-off circuit prototype. Params follow
// the approved schema: kebab-case component types, ammeters/voltmeters live in
// `meters[]` keyed by `position` (never inline in `series`).
//
// Circuit diagrams show the SETUP only — the answer (a reading, a calculated
// resistance) is always stated in the question/solution TEXT, never drawn. So
// the diagram is identical in question and feedback mode (no `mode` gate) and
// `questionSafe: true`. The component is a pure function of its params: any
// structural problem renders null + one console.warn and never throws.

import React from 'react';

// ─── Schema ───────────────────────────────────────────────────────────────────

export type CircuitComponentType =
  | 'cell'
  | 'battery'
  | 'switch-open'
  | 'switch-closed'
  | 'lamp'
  | 'fuse'
  | 'resistor'
  | 'variable-resistor'
  | 'thermistor'
  | 'ldr'
  | 'diode'
  | 'led';

export interface CircuitComponentSpec {
  type: CircuitComponentType;
  /** Unique within the diagram. Target of a voltmeter's `across`. */
  id: string;
  /** Rendered beside the symbol, e.g. "R₁ = 4 Ω", "6 V". Answer values do not
      belong in the diagram — state them in the question/solution text. */
  label?: string;
}

export type CircuitMeterPosition =
  | 'main'
  | { branch: number }
  | { across: string };

export interface CircuitMeterSpec {
  type: 'ammeter' | 'voltmeter';
  label?: string;
  position: CircuitMeterPosition;
}

export interface CircuitDiagramParams {
  supply: { type: 'cell' | 'battery'; label?: string };
  /** Main-loop components, in order, after the supply. May be empty. */
  series?: CircuitComponentSpec[];
  /** 1–3 branches, each 1–3 components. Omit for a pure series circuit. */
  parallelBranches?: CircuitComponentSpec[][];
  meters?: CircuitMeterSpec[];
  /** Parallel branch layout (default 'inline'):
      - 'inline': branches sit as a compact block in line on the bottom edge
        alongside the series components (the original layout).
      - 'ladder': supply + series components on the top edge, then equal-width
        branches drawn as full-width rungs stacked between the two side rails —
        the conventional AQA "stacked equal-length branches" parallel diagram.
        Main-loop ammeters sit on the side rails (e.g. A₁ left, A₅ right).
      Only affects circuits that have `parallelBranches`. */
  parallelStyle?: 'inline' | 'ladder';
}

// ─── Drawing constants ──────────────────────────────────────────────────────

const INK = '#1C1917';
const PAPER = '#ffffff';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const SW = 2;

const VALID_TYPES = new Set<string>([
  'cell',
  'battery',
  'switch-open',
  'switch-closed',
  'lamp',
  'fuse',
  'resistor',
  'variable-resistor',
  'thermistor',
  'ldr',
  'diode',
  'led',
]);

// ─── Symbol library (AQA 8463) ──────────────────────────────────────────────
// Each symbol is centred on (0,0) and spans exactly `w` horizontally, including
// its own lead wires out to ±w/2.

interface SymbolDef {
  w: number;
  name: string;
  labelDy?: number;
  body: () => React.ReactNode;
}

const wire = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line
    key={key}
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={INK}
    strokeWidth={SW}
    strokeLinecap="square"
  />
);

const SYMBOLS: Record<CircuitComponentType, SymbolDef> = {
  'switch-open': {
    w: 64,
    name: 'open switch',
    body: () => (
      <g>
        {wire(-32, 0, -16, 0)}
        {wire(16, 0, 32, 0)}
        <circle cx={-16} cy={0} r={3} fill={INK} />
        <circle cx={16} cy={0} r={3} fill={INK} />
        {wire(-16, 0, 13, -16)}
      </g>
    ),
  },
  'switch-closed': {
    w: 64,
    name: 'closed switch',
    body: () => (
      <g>
        {wire(-32, 0, 32, 0)}
        <circle cx={-16} cy={0} r={3} fill={INK} />
        <circle cx={16} cy={0} r={3} fill={INK} />
      </g>
    ),
  },
  cell: {
    w: 56,
    name: 'cell',
    body: () => (
      <g>
        {wire(-28, 0, -5, 0)}
        {wire(5, 0, 28, 0)}
        {/* long thin line = positive terminal */}
        <line x1={-5} y1={-15} x2={-5} y2={15} stroke={INK} strokeWidth={SW} />
        {/* short thick line = negative terminal */}
        <line x1={5} y1={-8} x2={5} y2={8} stroke={INK} strokeWidth={5} />
      </g>
    ),
  },
  battery: {
    w: 92,
    name: 'battery',
    body: () => (
      <g>
        {wire(-46, 0, -15, 0)}
        {wire(15, 0, 46, 0)}
        <line x1={-15} y1={-15} x2={-15} y2={15} stroke={INK} strokeWidth={SW} />
        <line x1={-7} y1={-8} x2={-7} y2={8} stroke={INK} strokeWidth={5} />
        <line x1={7} y1={-15} x2={7} y2={15} stroke={INK} strokeWidth={SW} />
        <line x1={15} y1={-8} x2={15} y2={8} stroke={INK} strokeWidth={5} />
      </g>
    ),
  },
  diode: {
    w: 72,
    name: 'diode',
    labelDy: 38,
    body: () => (
      <g>
        {wire(-36, 0, -8, 0)}
        {wire(8, 0, 36, 0)}
        <path d="M -8 -8 L -8 8 L 8 0 Z" fill={INK} />
        <line x1={8} y1={-8} x2={8} y2={8} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  resistor: {
    w: 64,
    name: 'resistor',
    body: () => (
      <g>
        {wire(-32, 0, -22, 0)}
        {wire(22, 0, 32, 0)}
        <rect
          x={-22}
          y={-9}
          width={44}
          height={18}
          fill={PAPER}
          stroke={INK}
          strokeWidth={SW}
        />
      </g>
    ),
  },
  'variable-resistor': {
    w: 78,
    name: 'variable resistor',
    labelDy: 40,
    body: () => (
      <g>
        {wire(-39, 0, -22, 0)}
        {wire(22, 0, 39, 0)}
        <rect
          x={-22}
          y={-9}
          width={44}
          height={18}
          fill={PAPER}
          stroke={INK}
          strokeWidth={SW}
        />
        <line
          x1={-27}
          y1={16}
          x2={24}
          y2={-16}
          stroke={INK}
          strokeWidth={SW}
          markerEnd="url(#circ-arr)"
        />
      </g>
    ),
  },
  ldr: {
    w: 86,
    name: 'LDR',
    labelDy: 42,
    body: () => (
      <g>
        {wire(-43, 0, -19, 0)}
        {wire(19, 0, 43, 0)}
        {/* AQA LDR: resistor enclosed in a circle, two arrows pointing IN */}
        <circle cx={0} cy={0} r={19} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <rect
          x={-13}
          y={-7}
          width={26}
          height={14}
          fill={PAPER}
          stroke={INK}
          strokeWidth={SW}
        />
        <line
          x1={-34}
          y1={-32}
          x2={-19}
          y2={-17}
          stroke={INK}
          strokeWidth={SW}
          markerEnd="url(#circ-arr)"
        />
        <line
          x1={-22}
          y1={-35}
          x2={-7}
          y2={-20}
          stroke={INK}
          strokeWidth={SW}
          markerEnd="url(#circ-arr)"
        />
      </g>
    ),
  },
  thermistor: {
    w: 78,
    name: 'thermistor',
    labelDy: 42,
    body: () => (
      <g>
        {wire(-39, 0, -22, 0)}
        {wire(22, 0, 39, 0)}
        <rect
          x={-22}
          y={-9}
          width={44}
          height={18}
          fill={PAPER}
          stroke={INK}
          strokeWidth={SW}
        />
        <path
          d="M -33 20 L -20 20 L 23 -16"
          fill="none"
          stroke={INK}
          strokeWidth={SW}
        />
      </g>
    ),
  },
  lamp: {
    w: 60,
    name: 'lamp',
    labelDy: 36,
    body: () => (
      <g>
        {wire(-30, 0, -14, 0)}
        {wire(14, 0, 30, 0)}
        <circle cx={0} cy={0} r={14} fill={PAPER} stroke={INK} strokeWidth={SW} />
        <line x1={-9.9} y1={-9.9} x2={9.9} y2={9.9} stroke={INK} strokeWidth={SW} />
        <line x1={-9.9} y1={9.9} x2={9.9} y2={-9.9} stroke={INK} strokeWidth={SW} />
      </g>
    ),
  },
  fuse: {
    w: 64,
    name: 'fuse',
    body: () => (
      <g>
        {wire(-32, 0, 32, 0)}
        <rect
          x={-18}
          y={-8}
          width={36}
          height={16}
          fill="none"
          stroke={INK}
          strokeWidth={SW}
        />
      </g>
    ),
  },
  led: {
    w: 84,
    name: 'LED',
    labelDy: 40,
    body: () => (
      <g>
        {wire(-42, 0, -17, 0)}
        {wire(17, 0, 42, 0)}
        <circle cx={0} cy={0} r={17} fill={PAPER} stroke={INK} strokeWidth={SW} />
        {wire(-17, 0, -8, 0)}
        {wire(8, 0, 17, 0)}
        <path d="M -8 -8 L -8 8 L 8 0 Z" fill={INK} />
        <line x1={8} y1={-8} x2={8} y2={8} stroke={INK} strokeWidth={SW} />
        {/* two arrows pointing OUT (emitting light) */}
        <line
          x1={11}
          y1={-14}
          x2={21}
          y2={-25}
          stroke={INK}
          strokeWidth={SW}
          markerEnd="url(#circ-arr)"
        />
        <line
          x1={18}
          y1={-9}
          x2={28}
          y2={-20}
          stroke={INK}
          strokeWidth={SW}
          markerEnd="url(#circ-arr)"
        />
      </g>
    ),
  },
};

// Meters share a common circle-with-letter glyph (width 64, lead wires ±32).
const METER_W = 64;
const METER_R = 15;

const Defs = () => (
  <defs>
    <marker
      id="circ-arr"
      markerWidth="9"
      markerHeight="8"
      refX="6.5"
      refY="3"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path d="M0,0 L7.5,3 L0,6 Z" fill={INK} />
    </marker>
  </defs>
);

function slotW(type: string): number {
  if (type === 'ammeter' || type === 'voltmeter') return METER_W;
  return SYMBOLS[type as CircuitComponentType]?.w ?? 64;
}

// One placed renderable symbol (component or in-line ammeter).
const Sym = ({
  type,
  label,
  x,
  y,
  labelAbove,
}: {
  type: string;
  label?: string;
  x: number;
  y: number;
  labelAbove?: boolean;
}) => {
  const isMeter = type === 'ammeter' || type === 'voltmeter';
  const def = isMeter ? null : SYMBOLS[type as CircuitComponentType];
  const dy = labelAbove ? -26 : def?.labelDy ?? 34;
  return (
    <g transform={`translate(${x},${y})`}>
      {isMeter ? (
        <g>
          {wire(-METER_W / 2, 0, -METER_R, 0)}
          {wire(METER_R, 0, METER_W / 2, 0)}
          <circle cx={0} cy={0} r={METER_R} fill={PAPER} stroke={INK} strokeWidth={SW} />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fontFamily={FONT}
            fill={INK}
          >
            {type === 'ammeter' ? 'A' : 'V'}
          </text>
        </g>
      ) : (
        def?.body()
      )}
      {label && (
        <text
          x={0}
          y={dy}
          textAnchor="middle"
          fontSize={13}
          fontFamily={FONT}
          fill={INK}
        >
          {label}
        </text>
      )}
    </g>
  );
};

// ─── Validation + layout engine ─────────────────────────────────────────────

interface BuildResult {
  el: React.ReactNode[];
  width: number;
  height: number;
  desc: string;
}

// Internal item placed on an edge: a component or an in-line ammeter.
interface InlineItem {
  type: string;
  id?: string;
  label?: string;
}

function buildCircuit(
  params: CircuitDiagramParams,
  width: number
): BuildResult | null {
  const warn = (msg: string) => console.warn(`[CircuitDiagram] ${msg}`, params);

  if (!params || typeof params !== 'object') {
    warn('missing params');
    return null;
  }
  const supply = params.supply;
  if (!supply || (supply.type !== 'cell' && supply.type !== 'battery')) {
    warn('missing or invalid supply');
    return null;
  }

  const series: CircuitComponentSpec[] = Array.isArray(params.series)
    ? params.series
    : [];
  const branchesRaw: CircuitComponentSpec[][] = Array.isArray(params.parallelBranches)
    ? params.parallelBranches.filter((b) => Array.isArray(b))
    : [];
  const meters: CircuitMeterSpec[] = Array.isArray(params.meters)
    ? params.meters
    : [];

  if (branchesRaw.length > 3) {
    warn('more than 3 parallel branches');
    return null;
  }
  const branches = branchesRaw;
  for (const b of branches) {
    if (b.length > 3) {
      warn('more than 3 components in a branch');
      return null;
    }
  }

  // Validate component types + collect ids.
  const ids = new Set<string>();
  const allComps = [...series, ...branches.flat()];
  for (const c of allComps) {
    if (!c || !VALID_TYPES.has(c.type)) {
      warn(`unknown component type "${c?.type}"`);
      return null;
    }
    if (c.id) {
      if (ids.has(c.id)) {
        warn(`duplicate component id "${c.id}"`);
        return null;
      }
      ids.add(c.id);
    }
  }

  // Distribute meters: ammeters go in-line (main loop or a branch); voltmeters
  // are drawn across a named component.
  const seriesInline: InlineItem[] = series.map((c) => ({
    type: c.type,
    id: c.id,
    label: c.label,
  }));
  const branchInline: InlineItem[][] = branches.map((b) =>
    b.map((c) => ({ type: c.type, id: c.id, label: c.label }))
  );
  const voltmeters: { label?: string; across: string }[] = [];

  for (const m of meters) {
    if (!m || (m.type !== 'ammeter' && m.type !== 'voltmeter')) {
      warn('invalid meter');
      return null;
    }
    const pos = m.position;
    if (m.type === 'voltmeter') {
      if (!pos || typeof pos !== 'object' || !('across' in pos)) {
        warn('voltmeter needs position { across: id }');
        return null;
      }
      if (!ids.has(pos.across)) {
        warn(`voltmeter across unknown id "${pos.across}"`);
        return null;
      }
      voltmeters.push({ label: m.label, across: pos.across });
    } else {
      // ammeter
      if (pos === 'main') {
        seriesInline.unshift({ type: 'ammeter', label: m.label });
      } else if (pos && typeof pos === 'object' && 'branch' in pos) {
        const bi = pos.branch;
        if (typeof bi !== 'number' || bi < 0 || bi >= branchInline.length) {
          warn(`ammeter branch index ${bi} out of range`);
          return null;
        }
        branchInline[bi].push({ type: 'ammeter', label: m.label });
      } else {
        warn("ammeter needs position 'main' or { branch: n }");
        return null;
      }
    }
  }

  // ── Geometry ──
  const L = 70;
  const R = width - 70;
  const yTop = 56;
  const yBot = 252;
  const railGap = 70;

  const n = branchInline.length;
  const railYs = branchInline.map(
    (_, i) => yBot + (i - (n - 1) / 2) * railGap
  );

  // Parallel block width: widest branch + breathing room.
  let pw = 0;
  if (n) {
    pw = Math.max(
      210,
      ...branchInline.map(
        (b) => b.reduce((s, c) => s + slotW(c.type), 0) + 26 * (b.length + 1) + 40
      )
    );
  }

  // Bottom-edge items: series components, then the parallel block.
  type Item = { kind: 'comp'; c: InlineItem; w: number } | { kind: 'par'; w: number };
  const items: Item[] = seriesInline.map((c) => ({
    kind: 'comp' as const,
    c,
    w: slotW(c.type),
  }));
  if (n) items.push({ kind: 'par', w: pw });

  const span = R - L;
  const totW = items.reduce((s, it) => s + it.w, 0);
  const gap = items.length ? (span - totW) / (items.length + 1) : span;

  let x = L + gap;
  interface Placed extends InlineItem {
    w: number;
    cx: number;
    cy: number;
    where: 'top' | 'bottom' | 'rail';
    rail?: number;
    nRails?: number;
  }
  const placed: Placed[] = [];
  const occupied: [number, number][] = [];
  let parX0 = 0;
  let parX1 = 0;

  for (const it of items) {
    if (it.kind === 'comp') {
      placed.push({
        ...it.c,
        w: it.w,
        cx: x + it.w / 2,
        cy: yBot,
        where: 'bottom',
      });
      occupied.push([x, x + it.w]);
    } else {
      parX0 = x + 20;
      parX1 = x + it.w - 20;
      occupied.push([parX0, parX1]);
    }
    x += it.w + gap;
  }

  // Branch components within the parallel block.
  branchInline.forEach((b, i) => {
    const y = railYs[i];
    const tot = b.reduce((s, c) => s + slotW(c.type), 0);
    const g2 = (parX1 - parX0 - tot) / (b.length + 1);
    let bx = parX0 + g2;
    b.forEach((c) => {
      const w = slotW(c.type);
      placed.push({
        ...c,
        w,
        cx: bx + w / 2,
        cy: y,
        where: 'rail',
        rail: i,
        nRails: n,
      });
      bx += w + g2;
    });
  });

  // Supply on the top edge.
  const sw = slotW(supply.type);
  const supplyPlaced: Placed = {
    type: supply.type,
    label: supply.label,
    w: sw,
    cx: (L + R) / 2,
    cy: yTop,
    where: 'top',
  };

  const el: React.ReactNode[] = [];
  let k = 0;

  // Top edge + side wires.
  el.push(wire(L, yTop, supplyPlaced.cx - sw / 2, yTop, `w${k++}`));
  el.push(wire(supplyPlaced.cx + sw / 2, yTop, R, yTop, `w${k++}`));
  el.push(wire(L, yTop, L, yBot, `w${k++}`));
  el.push(wire(R, yTop, R, yBot, `w${k++}`));

  // Bottom edge, skipping component slots and the parallel block.
  let cursor = L;
  for (const [s, e] of occupied) {
    if (s > cursor) el.push(wire(cursor, yBot, s, yBot, `w${k++}`));
    cursor = e;
  }
  if (cursor < R) el.push(wire(cursor, yBot, R, yBot, `w${k++}`));

  // Parallel block frame + rails.
  if (n) {
    const topRail = railYs[0];
    const botRail = railYs[n - 1];
    el.push(
      wire(parX0, Math.min(topRail, yBot), parX0, Math.max(botRail, yBot), `w${k++}`)
    );
    el.push(
      wire(parX1, Math.min(topRail, yBot), parX1, Math.max(botRail, yBot), `w${k++}`)
    );
    branchInline.forEach((b, i) => {
      const y = railYs[i];
      const slots = placed
        .filter((p) => p.where === 'rail' && p.rail === i)
        .map((p) => [p.cx - p.w / 2, p.cx + p.w / 2] as [number, number])
        .sort((a, bb) => a[0] - bb[0]);
      let cx = parX0;
      for (const [s, e] of slots) {
        if (s > cx) el.push(wire(cx, y, s, y, `w${k++}`));
        cx = e;
      }
      if (cx < parX1) el.push(wire(cx, y, parX1, y, `w${k++}`));
    });
    // Junction dots where rails meet the verticals.
    const dots: [number, number][] = [
      [parX0, yBot],
      [parX1, yBot],
    ];
    railYs.forEach((y, i) => {
      if (i > 0 && i < n - 1 && Math.abs(y - yBot) > 1) {
        dots.push([parX0, y], [parX1, y]);
      }
    });
    dots.forEach(([dx, dy]) =>
      el.push(<circle key={`d${k++}`} cx={dx} cy={dy} r={3} fill={INK} />)
    );
  }

  // Symbols.
  el.push(
    <Sym
      key={`s${k++}`}
      type={supplyPlaced.type}
      label={supplyPlaced.label}
      x={supplyPlaced.cx}
      y={yTop}
      labelAbove
    />
  );
  placed.forEach((p) =>
    el.push(
      <Sym key={`s${k++}`} type={p.type} label={p.label} x={p.cx} y={p.cy} />
    )
  );

  // Voltmeters across components.
  let maxY = Math.max(yBot, ...(railYs.length ? railYs : [yBot]));
  for (const v of voltmeters) {
    const target =
      placed.find((p) => p.id === v.across) ??
      (supplyPlaced.id === v.across ? supplyPlaced : null);
    if (!target) continue;
    const above =
      target.where === 'top' ||
      (target.where === 'rail' && target.rail === 0 && (target.nRails ?? 1) > 1);
    const yv = above ? target.cy - 60 : target.cy + 60;
    const sx1 = target.cx - target.w / 2;
    const sx2 = target.cx + target.w / 2;
    el.push(wire(sx1, target.cy, sx1, yv, `w${k++}`));
    el.push(wire(sx2, target.cy, sx2, yv, `w${k++}`));
    el.push(wire(sx1, yv, target.cx - METER_R, yv, `w${k++}`));
    el.push(wire(target.cx + METER_R, yv, sx2, yv, `w${k++}`));
    el.push(
      <circle
        key={`v${k++}`}
        cx={target.cx}
        cy={yv}
        r={METER_R}
        fill={PAPER}
        stroke={INK}
        strokeWidth={SW}
      />
    );
    el.push(
      <text
        key={`v${k++}`}
        x={target.cx}
        y={yv}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={15}
        fontFamily={FONT}
        fill={INK}
      >
        V
      </text>
    );
    if (v.label) {
      el.push(
        <text
          key={`v${k++}`}
          x={target.cx + METER_R + 6}
          y={yv + 4}
          textAnchor="start"
          fontSize={13}
          fontFamily={FONT}
          fill={INK}
        >
          {v.label}
        </text>
      );
    }
    el.push(<circle key={`v${k++}`} cx={sx1} cy={target.cy} r={3} fill={INK} />);
    el.push(<circle key={`v${k++}`} cx={sx2} cy={target.cy} r={3} fill={INK} />);
    maxY = Math.max(maxY, yv + METER_R);
  }

  const height = maxY + 56;

  // Accessible description.
  const describe = (type: string, label?: string) => {
    const base =
      type === 'ammeter'
        ? 'ammeter'
        : type === 'voltmeter'
        ? 'voltmeter'
        : SYMBOLS[type as CircuitComponentType]?.name ?? type;
    return base + (label ? ` (${label})` : '');
  };
  let desc = `Circuit diagram with a ${describe(supply.type, supply.label)}`;
  if (series.length)
    desc += `; in series: ${series.map((c) => describe(c.type, c.label)).join(', ')}`;
  if (n)
    desc += `; ${n} parallel branch${n > 1 ? 'es' : ''}: ${branches
      .map((b) => b.map((c) => describe(c.type, c.label)).join(' and '))
      .join(' | ')}`;
  for (const m of meters) {
    if (m.type === 'voltmeter' && typeof m.position === 'object' && 'across' in m.position)
      desc += `; voltmeter across ${m.position.across}`;
    if (m.type === 'ammeter') desc += `; ammeter in series`;
  }
  desc += '.';

  return { el, width, height, desc };
}

// ─── Ladder layout (full-width stacked branches) ────────────────────────────
// Supply + series components on the top edge; each parallel branch is a
// full-width rung between the two side rails, stacked vertically. Main-loop
// ammeters sit on the rails. Used when params.parallelStyle === 'ladder'.

interface LadderPlaced extends InlineItem {
  w: number;
  cx: number;
  cy: number;
  where: 'top' | 'rung';
  rail?: number;
  nRails?: number;
}

function buildLadder(
  params: CircuitDiagramParams,
  width: number
): BuildResult | null {
  const warn = (msg: string) => console.warn(`[CircuitDiagram] ${msg}`, params);

  if (!params || typeof params !== 'object') {
    warn('missing params');
    return null;
  }
  const supply = params.supply;
  if (!supply || (supply.type !== 'cell' && supply.type !== 'battery')) {
    warn('missing or invalid supply');
    return null;
  }

  const series: CircuitComponentSpec[] = Array.isArray(params.series) ? params.series : [];
  const branches: CircuitComponentSpec[][] = Array.isArray(params.parallelBranches)
    ? params.parallelBranches.filter((b) => Array.isArray(b))
    : [];
  const meters: CircuitMeterSpec[] = Array.isArray(params.meters) ? params.meters : [];

  if (branches.length === 0) {
    warn('ladder layout needs at least one parallel branch');
    return null;
  }
  if (branches.length > 3) {
    warn('more than 3 parallel branches');
    return null;
  }
  for (const b of branches) {
    if (b.length > 3) {
      warn('more than 3 components in a branch');
      return null;
    }
  }

  // Validate component types + collect ids.
  const ids = new Set<string>();
  for (const c of [...series, ...branches.flat()]) {
    if (!c || !VALID_TYPES.has(c.type)) {
      warn(`unknown component type "${c?.type}"`);
      return null;
    }
    if (c.id) {
      if (ids.has(c.id)) {
        warn(`duplicate component id "${c.id}"`);
        return null;
      }
      ids.add(c.id);
    }
  }

  // Distribute meters.
  const branchInline: InlineItem[][] = branches.map((b) =>
    b.map((c) => ({ type: c.type, id: c.id, label: c.label }))
  );
  const voltmeters: { label?: string; across: string }[] = [];
  const mainAmmeters: { label?: string }[] = [];
  for (const m of meters) {
    if (!m || (m.type !== 'ammeter' && m.type !== 'voltmeter')) {
      warn('invalid meter');
      return null;
    }
    const pos = m.position;
    if (m.type === 'voltmeter') {
      if (!pos || typeof pos !== 'object' || !('across' in pos)) {
        warn('voltmeter needs position { across: id }');
        return null;
      }
      if (!ids.has(pos.across)) {
        warn(`voltmeter across unknown id "${pos.across}"`);
        return null;
      }
      voltmeters.push({ label: m.label, across: pos.across });
    } else if (pos === 'main') {
      mainAmmeters.push({ label: m.label });
    } else if (pos && typeof pos === 'object' && 'branch' in pos) {
      const bi = pos.branch;
      if (typeof bi !== 'number' || bi < 0 || bi >= branchInline.length) {
        warn(`ammeter branch index ${bi} out of range`);
        return null;
      }
      // Conventional placement: the branch ammeter sits before its component
      // (nearer the junction), e.g. "A₂ ─ ⊗" in the AQA stacked-branch diagram.
      branchInline[bi].unshift({ type: 'ammeter', label: m.label });
    } else {
      warn("ammeter needs position 'main' or { branch: n }");
      return null;
    }
  }

  // ── Geometry ──
  const L = 70;
  const R = width - 70;
  const topY = 56;
  const rungGap = 86;
  const n = branchInline.length;
  const rungY = branchInline.map((_, i) => topY + (i + 1) * rungGap);
  const bottomY = rungY[n - 1];

  const el: React.ReactNode[] = [];
  let k = 0;
  const placed: LadderPlaced[] = [];

  // Helper: lay items out across [x0, x1] at height y, returning placed slots.
  const layRow = (
    items: InlineItem[],
    y: number,
    x0: number,
    x1: number,
    where: 'top' | 'rung',
    rail?: number
  ) => {
    const tot = items.reduce((s, c) => s + slotW(c.type), 0);
    const gap = (x1 - x0 - tot) / (items.length + 1);
    let x = x0 + gap;
    const occ: [number, number][] = [];
    for (const c of items) {
      const w = slotW(c.type);
      placed.push({ ...c, w, cx: x + w / 2, cy: y, where, rail, nRails: n });
      occ.push([x, x + w]);
      x += w + gap;
    }
    // Wire segments along the row, skipping component slots.
    let cur = x0;
    for (const [s, e] of occ) {
      if (s > cur) el.push(wire(cur, y, s, y, `w${k++}`));
      cur = e;
    }
    if (cur < x1) el.push(wire(cur, y, x1, y, `w${k++}`));
  };

  // Top edge: series components (left) then supply (right).
  const topItems: InlineItem[] = [
    ...series.map((c) => ({ type: c.type, id: c.id, label: c.label })),
    { type: supply.type, label: supply.label },
  ];
  layRow(topItems, topY, L, R, 'top');

  // Main-loop ammeters on the side rails, between the top edge and first rung.
  const railGaps: { x: number; lo: number; hi: number }[] = [];
  const sideCount = { left: 0, right: 0 };
  const railMidY = topY + (rungY[0] - topY) * 0.5;
  mainAmmeters.forEach((am) => {
    const onLeft = sideCount.left <= sideCount.right;
    const rx = onLeft ? L : R;
    const stack = onLeft ? sideCount.left++ : sideCount.right++;
    const y = railMidY + stack * (2 * METER_R + 10);
    railGaps.push({ x: rx, lo: y - METER_R, hi: y + METER_R });
    el.push(
      <circle key={`m${k++}`} cx={rx} cy={y} r={METER_R} fill={PAPER} stroke={INK} strokeWidth={SW} />
    );
    el.push(
      <text
        key={`m${k++}`}
        x={rx}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={15}
        fontFamily={FONT}
        fill={INK}
      >
        A
      </text>
    );
    if (am.label) {
      el.push(
        <text
          key={`m${k++}`}
          x={onLeft ? rx - METER_R - 6 : rx + METER_R + 6}
          y={y + 4}
          textAnchor={onLeft ? 'end' : 'start'}
          fontSize={13}
          fontFamily={FONT}
          fill={INK}
        >
          {am.label}
        </text>
      );
    }
  });

  // Side rails from the top edge to the bottom rung, skipping meter gaps.
  const drawRail = (x: number) => {
    const gaps = railGaps
      .filter((g) => g.x === x)
      .sort((a, b) => a.lo - b.lo);
    let cur = topY;
    for (const g of gaps) {
      if (g.lo > cur) el.push(wire(x, cur, x, g.lo, `w${k++}`));
      cur = Math.max(cur, g.hi);
    }
    if (cur < bottomY) el.push(wire(x, cur, x, bottomY, `w${k++}`));
  };
  drawRail(L);
  drawRail(R);

  // Rungs: each branch full-width between the rails.
  branchInline.forEach((b, i) => {
    const y = rungY[i];
    layRow(b, y, L, R, 'rung', i);
    // T-junction dots where the rail continues past this rung (all but last).
    if (i < n - 1) {
      el.push(<circle key={`j${k++}`} cx={L} cy={y} r={3} fill={INK} />);
      el.push(<circle key={`j${k++}`} cx={R} cy={y} r={3} fill={INK} />);
    }
  });

  // Symbols (labels above on the top edge, below on rungs).
  placed.forEach((p) =>
    el.push(
      <Sym
        key={`s${k++}`}
        type={p.type}
        label={p.label}
        x={p.cx}
        y={p.cy}
        labelAbove={p.where === 'top'}
      />
    )
  );

  // Voltmeters across a named component.
  let maxY = bottomY;
  for (const v of voltmeters) {
    const target = placed.find((p) => p.id === v.across);
    if (!target) continue;
    const above = target.where === 'top';
    const yv = above ? target.cy - 60 : target.cy + 44;
    const sx1 = target.cx - target.w / 2;
    const sx2 = target.cx + target.w / 2;
    el.push(wire(sx1, target.cy, sx1, yv, `w${k++}`));
    el.push(wire(sx2, target.cy, sx2, yv, `w${k++}`));
    el.push(wire(sx1, yv, target.cx - METER_R, yv, `w${k++}`));
    el.push(wire(target.cx + METER_R, yv, sx2, yv, `w${k++}`));
    el.push(
      <circle key={`v${k++}`} cx={target.cx} cy={yv} r={METER_R} fill={PAPER} stroke={INK} strokeWidth={SW} />
    );
    el.push(
      <text
        key={`v${k++}`}
        x={target.cx}
        y={yv}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={15}
        fontFamily={FONT}
        fill={INK}
      >
        V
      </text>
    );
    el.push(<circle key={`v${k++}`} cx={sx1} cy={target.cy} r={3} fill={INK} />);
    el.push(<circle key={`v${k++}`} cx={sx2} cy={target.cy} r={3} fill={INK} />);
    maxY = Math.max(maxY, yv + METER_R);
  }

  const height = maxY + 56;

  // Accessible description.
  const describe = (type: string, label?: string) => {
    const base =
      type === 'ammeter'
        ? 'ammeter'
        : SYMBOLS[type as CircuitComponentType]?.name ?? type;
    return base + (label ? ` (${label})` : '');
  };
  let desc = `Parallel circuit (stacked full-width branches) with a ${describe(supply.type, supply.label)}`;
  if (series.length)
    desc += `; in series: ${series.map((c) => describe(c.type, c.label)).join(', ')}`;
  desc += `; ${n} parallel branch${n > 1 ? 'es' : ''}: ${branches
    .map((b) => b.map((c) => describe(c.type, c.label)).join(' and '))
    .join(' | ')}`;
  if (mainAmmeters.length) desc += `; ${mainAmmeters.length} ammeter(s) in the main loop`;
  desc += '.';

  return { el, width, height, desc };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CircuitDiagram({
  params,
}: {
  params: CircuitDiagramParams;
  // Accepts but ignores `mode` — circuit diagrams never carry a feedback layer.
  mode?: 'question' | 'feedback';
}) {
  const VIEW_W = 660;
  const useLadder =
    params?.parallelStyle === 'ladder' &&
    Array.isArray(params.parallelBranches) &&
    params.parallelBranches.length > 0;
  let built: BuildResult | null = null;
  try {
    built = useLadder ? buildLadder(params, VIEW_W) : buildCircuit(params, VIEW_W);
  } catch (e) {
    console.warn('[CircuitDiagram] failed to render', e, params);
    return null;
  }
  if (!built) return null;

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 480 }}
      >
        <svg
          viewBox={`0 0 ${built.width} ${built.height}`}
          width="100%"
          style={{ maxWidth: 460, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>Circuit diagram</title>
          <desc>{built.desc}</desc>
          <Defs />
          {built.el}
        </svg>
      </div>
    </div>
  );
}
