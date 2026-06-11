// FreeBodyDiagram.tsx
// AQA Physics free body diagram: an object (box, dot, or a simple recognisable
// car/rocket drawing) with force arrows acting along lines through the centre
// of the object.
//
// Schema and conventions: DIAGRAMS.md Section 3.
// - Angle convention: degrees anticlockwise from "right" (0 = right, 90 = up),
//   or the named directions 'up' | 'down' | 'left' | 'right'.
// - Arrows start just outside the object's edge (so they never cross the
//   drawing) and their SHAFT length carries the magnitude information.
//   Magnitudes are normalised per axis (horizontal forces against each other,
//   vertical against each other) so opposing pairs compare correctly: equal
//   magnitudes always render equal shafts, and a small friction force stays
//   visibly smaller than a large driving force.
// - `balanced: true` forces all shafts to equal length.
// - `showResultant` is a feedback-only layer — never rendered in question mode.

export interface FreeBodyForce {
  label: string;
  angle: number | 'up' | 'down' | 'left' | 'right';
  magnitude?: number;
  relativeLength?: number; // 0.3–1.3, overrides magnitude scaling
}

export type FreeBodyObject = 'box' | 'dot' | 'car' | 'rocket';

export interface FreeBodyDiagramParams {
  object?: FreeBodyObject;
  objectLabel?: string;
  forces: FreeBodyForce[]; // 1–6
  showResultant?: {
    angle: number | 'up' | 'down' | 'left' | 'right';
    label: string;
    magnitude?: number;
  };
  balanced?: boolean;
}

const VIEW = 400;
const CX = VIEW / 2;
const CY = VIEW / 2;
const SHAFT_BASE = 25; // minimum visible shaft
const SHAFT_SCALE = 80; // shaft length added at relative length 1
const EDGE_GAP = 6; // gap between object edge and arrow start
const MAX_TIP = 178; // keep tips + labels inside the viewBox

const STROKE = '#1C1917';
const RESULTANT_COLOR = '#E23D28';

const FONT = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: '13',
  fontWeight: 600 as const,
  fill: '#1C1917',
};

// Half-extents of each object shape from the centre, per direction.
const SHAPE_EXTENTS: Record<
  FreeBodyObject,
  { left: number; right: number; up: number; down: number }
> = {
  box: { left: 35, right: 35, up: 25, down: 25 },
  dot: { left: 8, right: 8, up: 8, down: 8 },
  car: { left: 58, right: 58, up: 28, down: 29 },
  rocket: { left: 32, right: 32, up: 64, down: 32 },
};

const NAMED_ANGLES: Record<string, number> = {
  right: 0,
  up: 90,
  left: 180,
  down: 270,
};

function resolveAngle(angle: unknown): number | null {
  if (typeof angle === 'number' && Number.isFinite(angle)) return angle;
  if (typeof angle === 'string' && angle in NAMED_ANGLES) {
    return NAMED_ANGLES[angle];
  }
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function directionWord(angle: number | string): string {
  if (typeof angle === 'string') return angle;
  return `at ${angle} degrees`;
}

// Magnitude normalisation groups: opposing pairs share an axis, and relative
// length only needs to be truthful within an axis.
function axisOf(deg: number): 'h' | 'v' | 'other' {
  const d = ((deg % 360) + 360) % 360;
  const near = (target: number) => Math.abs(d - target) <= 25;
  if (near(0) || near(180) || near(360)) return 'h';
  if (near(90) || near(270)) return 'v';
  return 'other';
}

/** Extent of the object from its centre in the direction (ux, uySvg). */
function extentIn(
  shape: FreeBodyObject,
  ux: number,
  uySvg: number
): number {
  const e = SHAPE_EXTENTS[shape];
  const h = ux > 0 ? e.right : e.left;
  const v = uySvg < 0 ? e.up : e.down;
  return Math.hypot(h * ux, v * uySvg);
}

interface ResolvedArrow {
  deg: number;
  startDist: number; // from centre to shaft start (object edge + gap)
  tipDist: number; // from centre to arrowhead tip
  text: string;
}

function renderArrow(
  arrow: ResolvedArrow,
  color: string,
  resultant: boolean,
  key: string
) {
  const rad = (arrow.deg * Math.PI) / 180;
  // SVG y runs down; maths angle has y up.
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  const px = -uy;
  const py = ux;
  // The dashed resultant is offset sideways so it never sits on top of a
  // force arrow pointing the same way.
  const off = resultant ? 20 : 0;
  const ox = px * off;
  const oy = py * off;

  const sx = CX + ux * arrow.startDist + ox;
  const sy = CY + uy * arrow.startDist + oy;
  const tipX = CX + ux * arrow.tipDist + ox;
  const tipY = CY + uy * arrow.tipDist + oy;
  const baseX = tipX - ux * 11;
  const baseY = tipY - uy * 11;

  const head = [
    `${f(tipX)},${f(tipY)}`,
    `${f(baseX + px * 5.5)},${f(baseY + py * 5.5)}`,
    `${f(baseX - px * 5.5)},${f(baseY - py * 5.5)}`,
  ].join(' ');

  const isHorizontal = Math.abs(uy) <= 0.35;
  const isVertical = Math.abs(ux) <= 0.35;
  const midDist = (arrow.startDist + arrow.tipDist) / 2;

  let labelX: number;
  let labelY: number;
  let anchor: 'start' | 'middle' | 'end';
  if (resultant && isVertical) {
    // Beside the offset shaft, on its outer side.
    labelX = CX + ox + (ox >= 0 ? 10 : -10);
    labelY = CY + uy * midDist + 4;
    anchor = ox >= 0 ? 'start' : 'end';
  } else if (resultant && isHorizontal) {
    // Below/above the offset shaft (force labels take the near side).
    labelX = CX + ux * midDist;
    labelY = CY + oy + (oy >= 0 ? 20 : -12);
    anchor = 'middle';
  } else if (isHorizontal) {
    // Above the visible shaft — beyond-the-tip labels would run off the edge.
    labelX = CX + ux * midDist;
    labelY = CY - 12;
    anchor = 'middle';
  } else if (isVertical) {
    labelX = tipX;
    labelY = uy < 0 ? tipY - 10 : tipY + 20;
    anchor = 'middle';
  } else {
    labelX = CX + ux * (arrow.tipDist + 14) + ox;
    labelY = CY + uy * (arrow.tipDist + 14) + oy + 4;
    anchor = ux > 0 ? 'start' : 'end';
  }
  labelY = clamp(labelY, 12, VIEW - 6);

  return (
    <g key={key}>
      <line
        x1={f(sx)}
        y1={f(sy)}
        x2={f(baseX)}
        y2={f(baseY)}
        stroke={color}
        strokeWidth="2"
        strokeDasharray={resultant ? '5,4' : undefined}
      />
      <polygon points={head} fill={color} />
      <text {...FONT} x={f(labelX)} y={f(labelY)} textAnchor={anchor} fill={color}>
        {arrow.text}
      </text>
    </g>
  );
}

// ─── Object drawings ──────────────────────────────────────────────────────────
// Deliberately simple, single-stroke-weight line drawings: recognisable enough
// to engage students, plain enough to still read as an exam diagram.

function CarShape() {
  return (
    <g stroke={STROKE} strokeWidth="1.5" fill="#FFFFFF">
      {/* cabin */}
      <path
        d={`M ${CX - 28} ${CY - 8} L ${CX - 20} ${CY - 26} L ${CX + 18} ${CY - 26} L ${CX + 28} ${CY - 8} Z`}
      />
      {/* body */}
      <rect x={CX - 55} y={CY - 8} width="110" height="26" rx="6" />
      {/* wheels */}
      <circle cx={CX - 30} cy={CY + 18} r="9" />
      <circle cx={CX + 30} cy={CY + 18} r="9" />
      <circle cx={CX - 30} cy={CY + 18} r="2.5" fill={STROKE} />
      <circle cx={CX + 30} cy={CY + 18} r="2.5" fill={STROKE} />
    </g>
  );
}

function RocketShape() {
  return (
    <g stroke={STROKE} strokeWidth="1.5" fill="#FFFFFF">
      {/* fins */}
      <path d={`M ${CX - 13} ${CY + 6} L ${CX - 30} ${CY + 30} L ${CX - 13} ${CY + 30} Z`} />
      <path d={`M ${CX + 13} ${CY + 6} L ${CX + 30} ${CY + 30} L ${CX + 13} ${CY + 30} Z`} />
      {/* body */}
      <rect x={CX - 13} y={CY - 36} width="26" height="64" rx="8" />
      {/* nose cone */}
      <path
        d={`M ${CX - 13} ${CY - 36} C ${CX - 6} ${CY - 60}, ${CX + 6} ${CY - 60}, ${CX + 13} ${CY - 36} Z`}
      />
      {/* window */}
      <circle cx={CX} cy={CY - 22} r="5" />
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FreeBodyDiagram({
  params,
  mode = 'question',
}: {
  params: FreeBodyDiagramParams;
  mode?: 'question' | 'feedback';
}) {
  if (!params || !Array.isArray(params.forces) || params.forces.length === 0) {
    console.warn('[FreeBodyDiagram] invalid params', params);
    return null;
  }

  if (params.forces.length > 6) {
    console.warn('[FreeBodyDiagram] more than 6 forces — rendering the first 6');
  }

  const resolved = params.forces
    .slice(0, 6)
    .map((force) => {
      const deg = resolveAngle(force?.angle);
      if (deg === null || typeof force?.label !== 'string') {
        console.warn('[FreeBodyDiagram] skipping force with invalid angle/label', force);
        return null;
      }
      return { force, deg };
    })
    .filter((x): x is { force: FreeBodyForce; deg: number } => x !== null);

  if (resolved.length === 0) {
    console.warn('[FreeBodyDiagram] no valid forces', params);
    return null;
  }

  const shape: FreeBodyObject =
    params.object && params.object in SHAPE_EXTENTS ? params.object : 'box';

  // Per-axis maximum magnitudes for normalisation.
  const axisMax: Record<'h' | 'v' | 'other', number> = { h: 0, v: 0, other: 0 };
  for (const { force, deg } of resolved) {
    if (typeof force.magnitude === 'number' && force.magnitude > 0) {
      const axis = axisOf(deg);
      axisMax[axis] = Math.max(axisMax[axis], force.magnitude);
    }
  }

  const relativeLength = (force: FreeBodyForce, deg: number): number => {
    if (params.balanced) return 1;
    if (typeof force.relativeLength === 'number') {
      return clamp(force.relativeLength, 0.3, 1.3);
    }
    const max = axisMax[axisOf(deg)];
    if (typeof force.magnitude === 'number' && force.magnitude > 0 && max > 0) {
      return clamp(force.magnitude / max, 0.45, 1);
    }
    return 1;
  };

  const labelText = (label: string, magnitude?: number): string =>
    typeof magnitude === 'number' ? `${label} ${magnitude} N` : label;

  const toArrow = (
    deg: number,
    rel: number,
    text: string
  ): ResolvedArrow => {
    const rad = (deg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = -Math.sin(rad);
    const startDist = extentIn(shape, ux, uy) + EDGE_GAP;
    const tipDist = Math.min(startDist + SHAFT_BASE + rel * SHAFT_SCALE, MAX_TIP);
    return { deg, startDist, tipDist, text };
  };

  const arrows = resolved.map(({ force, deg }) =>
    toArrow(deg, relativeLength(force, deg), labelText(force.label, force.magnitude))
  );

  // Resultant — feedback-only layer.
  const resultantDeg =
    mode === 'feedback' && params.showResultant
      ? resolveAngle(params.showResultant.angle)
      : null;
  let resultantArrow: ResolvedArrow | null = null;
  if (resultantDeg !== null && params.showResultant) {
    const max = axisMax[axisOf(resultantDeg)];
    const mag = params.showResultant.magnitude;
    const rel =
      typeof mag === 'number' && mag > 0 && max > 0
        ? clamp(mag / max, 0.4, 1)
        : 0.85;
    resultantArrow = toArrow(resultantDeg, rel, params.showResultant.label);
  }

  const desc =
    `Free body diagram of a ${shape}` +
    (params.objectLabel ? ` representing ${params.objectLabel}` : '') +
    ` with ${resolved.length} force${resolved.length === 1 ? '' : 's'}: ` +
    resolved
      .map(
        ({ force }) =>
          `${labelText(force.label, force.magnitude)} ${directionWord(force.angle)}`
      )
      .join('; ') +
    (resultantArrow ? `; resultant ${params.showResultant!.label}` : '') +
    '.';

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 360 }}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          width="100%"
          style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>Free body diagram</title>
          <desc>{desc}</desc>

          {/* object */}
          {shape === 'car' ? (
            <CarShape />
          ) : shape === 'rocket' ? (
            <RocketShape />
          ) : shape === 'dot' ? (
            <circle cx={CX} cy={CY} r="5" fill={STROKE} />
          ) : (
            <rect
              x={CX - 35}
              y={CY - 25}
              width="70"
              height="50"
              fill="#FFFFFF"
              stroke={STROKE}
              strokeWidth="1.5"
            />
          )}

          {/* object label: inside the box, beside the dot, in the corner for
              car/rocket (the drawing identifies itself) */}
          {params.objectLabel &&
            (shape === 'box' ? (
              <text {...FONT} x={CX} y={CY + 4} textAnchor="middle" fontWeight={400} fontSize="12">
                {params.objectLabel}
              </text>
            ) : shape === 'dot' ? (
              <text {...FONT} x={CX + 12} y={CY + 18} textAnchor="start" fontWeight={400} fontSize="12">
                {params.objectLabel}
              </text>
            ) : (
              <text
                {...FONT}
                x={12}
                y={VIEW - 10}
                textAnchor="start"
                fontWeight={400}
                fontSize="12"
                fill="#78716C"
              >
                {params.objectLabel}
              </text>
            ))}

          {/* force arrows — start at the object edge, act through the centre */}
          {arrows.map((arrow, i) => renderArrow(arrow, STROKE, false, `force-${i}`))}

          {/* resultant (worked solutions only) */}
          {resultantArrow && renderArrow(resultantArrow, RESULTANT_COLOR, true, 'resultant')}
        </svg>
      </div>
    </div>
  );
}
