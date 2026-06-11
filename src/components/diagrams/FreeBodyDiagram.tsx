// FreeBodyDiagram.tsx
// AQA Physics free body diagram: an object (box or dot) with force arrows
// drawn from the centre of the object outward (AQA convention).
//
// Schema and conventions: DIAGRAMS.md Section 3.
// - Angle convention: degrees anticlockwise from "right" (0 = right, 90 = up),
//   or the named directions 'up' | 'down' | 'left' | 'right'.
// - Arrow lengths scale with magnitude (equal magnitudes always render equal
//   lengths); `balanced: true` forces all arrows to equal length.
// - `showResultant` is a feedback-only layer — never rendered in question mode.

export interface FreeBodyForce {
  label: string;
  angle: number | 'up' | 'down' | 'left' | 'right';
  magnitude?: number;
  relativeLength?: number; // 0.3–1.5, overrides magnitude scaling
}

export interface FreeBodyDiagramParams {
  object?: 'box' | 'dot';
  objectLabel?: string;
  forces: FreeBodyForce[]; // 1–6
  showResultant?: {
    angle: number | 'up' | 'down' | 'left' | 'right';
    label: string;
    magnitude?: number;
  };
  balanced?: boolean;
}

const VIEW = 340;
const CX = VIEW / 2;
const CY = VIEW / 2;
const MAX_LEN = 95;
const BOX_W = 70;
const BOX_H = 50;

const STROKE = '#1C1917';
const RESULTANT_COLOR = '#E23D28';

const FONT = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: '13',
  fontWeight: 600 as const,
  fill: '#1C1917',
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

interface ResolvedArrow {
  deg: number;
  length: number; // px
  text: string;
}

/** Shaft, arrowhead and label geometry for one arrow from the centre. */
function arrowParts(arrow: ResolvedArrow, color: string, dashed: boolean, key: string) {
  const rad = (arrow.deg * Math.PI) / 180;
  // SVG y runs down; maths angle has y up.
  const ux = Math.cos(rad);
  const uy = -Math.sin(rad);
  // Perpendicular (used to offset the dashed resultant off any force arrow
  // pointing the same way).
  const px = -uy;
  const py = ux;
  const offset = dashed ? 16 : 0;
  const sx = CX + px * offset;
  const sy = CY + py * offset;

  const tipX = sx + ux * arrow.length;
  const tipY = sy + uy * arrow.length;
  const baseX = tipX - ux * 11;
  const baseY = tipY - uy * 11;

  const head = [
    `${f(tipX)},${f(tipY)}`,
    `${f(baseX + px * 5.5)},${f(baseY + py * 5.5)}`,
    `${f(baseX - px * 5.5)},${f(baseY - py * 5.5)}`,
  ].join(' ');

  // Label placement: horizontal arrows get the label above the shaft (long
  // labels would run off the edge if placed beyond the tip); vertical arrows
  // get it beyond the tip, centred; diagonals beyond the tip, anchored by side.
  const isHorizontal = Math.abs(uy) <= 0.35;
  const isVertical = Math.abs(ux) <= 0.35;
  let labelX: number;
  let labelY: number;
  let anchor: 'start' | 'middle' | 'end';
  if (isHorizontal) {
    labelX = sx + ux * arrow.length * 0.65;
    labelY = sy - 10;
    anchor = 'middle';
  } else if (isVertical) {
    labelX = tipX;
    labelY = uy < 0 ? tipY - 10 : tipY + 20;
    anchor = 'middle';
  } else {
    labelX = sx + ux * (arrow.length + 14);
    labelY = sy + uy * (arrow.length + 14) + 4;
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
        strokeDasharray={dashed ? '5,4' : undefined}
      />
      <polygon points={head} fill={color} />
      <text {...FONT} x={f(labelX)} y={f(labelY)} textAnchor={anchor} fill={color}>
        {arrow.text}
      </text>
    </g>
  );
}

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

  const magnitudes = resolved
    .map(({ force }) => force.magnitude)
    .filter((m): m is number => typeof m === 'number' && m > 0);
  const maxMagnitude = magnitudes.length > 0 ? Math.max(...magnitudes) : 0;

  const relativeLength = (force: FreeBodyForce): number => {
    if (params.balanced) return 1;
    if (typeof force.relativeLength === 'number') {
      return clamp(force.relativeLength, 0.3, 1.5);
    }
    if (typeof force.magnitude === 'number' && force.magnitude > 0 && maxMagnitude > 0) {
      return clamp(force.magnitude / maxMagnitude, 0.4, 1);
    }
    return 1;
  };

  const labelText = (label: string, magnitude?: number): string =>
    typeof magnitude === 'number' ? `${label} ${magnitude} N` : label;

  const arrows: ResolvedArrow[] = resolved.map(({ force, deg }) => ({
    deg,
    length: MAX_LEN * relativeLength(force),
    text: labelText(force.label, force.magnitude),
  }));

  // Resultant — feedback-only layer.
  const resultantDeg =
    mode === 'feedback' && params.showResultant
      ? resolveAngle(params.showResultant.angle)
      : null;
  const resultant: ResolvedArrow | null =
    resultantDeg !== null && params.showResultant
      ? {
          deg: resultantDeg,
          length:
            MAX_LEN *
            (typeof params.showResultant.magnitude === 'number' &&
            params.showResultant.magnitude > 0 &&
            maxMagnitude > 0
              ? clamp(params.showResultant.magnitude / maxMagnitude, 0.4, 1)
              : 0.85),
          text: params.showResultant.label,
        }
      : null;

  const object = params.object === 'dot' ? 'dot' : 'box';
  const desc =
    `Free body diagram of a ${object}` +
    (params.objectLabel ? ` representing ${params.objectLabel}` : '') +
    ` with ${resolved.length} force${resolved.length === 1 ? '' : 's'}: ` +
    resolved
      .map(
        ({ force }) =>
          `${labelText(force.label, force.magnitude)} ${directionWord(force.angle)}`
      )
      .join('; ') +
    (resultant ? `; resultant ${params.showResultant!.label}` : '') +
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
          {object === 'box' ? (
            <>
              <rect
                x={CX - BOX_W / 2}
                y={CY - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
                fill="#FFFFFF"
                stroke={STROKE}
                strokeWidth="1.5"
              />
              {params.objectLabel && (
                <text
                  {...FONT}
                  x={CX}
                  y={CY + 4}
                  textAnchor="middle"
                  fontWeight={400}
                  fontSize="12"
                >
                  {params.objectLabel}
                </text>
              )}
            </>
          ) : (
            <>
              <circle cx={CX} cy={CY} r="5" fill={STROKE} />
              {params.objectLabel && (
                <text
                  {...FONT}
                  x={CX + 12}
                  y={CY + 18}
                  textAnchor="start"
                  fontWeight={400}
                  fontSize="12"
                >
                  {params.objectLabel}
                </text>
              )}
            </>
          )}

          {/* force arrows from the centre outward */}
          {arrows.map((arrow, i) => arrowParts(arrow, STROKE, false, `force-${i}`))}

          {/* resultant (worked solutions only) */}
          {resultant && arrowParts(resultant, RESULTANT_COLOR, true, 'resultant')}
        </svg>
      </div>
    </div>
  );
}
