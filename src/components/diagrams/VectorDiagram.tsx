// VectorDiagram.tsx
// Grid-based vector arrows for AQA Physics scale drawings and Edexcel column
// vectors.
//
// Schema and conventions: DIAGRAMS.md Section 4.
// - Grid coordinates with y increasing UP (maths convention, matches column
//   vector notation); the component converts to SVG space internally.
// - `tipToTail: true` chains vectors automatically (the `from` of vectors
//   after the first is ignored).
// - Single lowercase letters render bold (Edexcel vector convention); free
//   text (e.g. "40 N") renders normal weight.
// - `showResultant` is a feedback-only layer — never rendered in question
//   mode. Drawn dashed in brand red from the tail of the first vector to the
//   tip of the last.

export interface VectorSpec {
  from: [number, number];
  dx: number;
  dy: number;
  label?: string;
  style?: 'solid' | 'dashed';
}

export interface VectorDiagramParams {
  grid?: boolean; // default true
  vectors: VectorSpec[]; // 1–4
  tipToTail?: boolean;
  showResultant?: boolean;
  resultantLabel?: string;
  axes?: boolean; // default false
}

const MARGIN = 24;
const STROKE = '#1C1917';
const GRID_COLOR = '#E2DDD3';
const AXIS_COLOR = '#78716C';
const RESULTANT_COLOR = '#E23D28';

const FONT = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fill: '#1C1917',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Edexcel convention: a standalone lowercase letter is a bold vector. */
function isVectorLetter(label: string): boolean {
  return /^[a-z]$/.test(label);
}

interface ResolvedVector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  dashed: boolean;
}

export function VectorDiagram({
  params,
  mode = 'question',
}: {
  params: VectorDiagramParams;
  mode?: 'question' | 'feedback';
}) {
  if (!params || !Array.isArray(params.vectors) || params.vectors.length === 0) {
    console.warn('[VectorDiagram] invalid params', params);
    return null;
  }

  if (params.vectors.length > 4) {
    console.warn('[VectorDiagram] more than 4 vectors — rendering the first 4');
  }

  // Resolve vectors in grid space, chaining tip-to-tail if requested.
  // Rogue values are clamped so one bad number can't produce an unreadable grid.
  const resolved: ResolvedVector[] = [];
  let cursor: [number, number] | null = null;
  for (const v of params.vectors.slice(0, 4)) {
    const fromOk =
      Array.isArray(v?.from) &&
      v.from.length === 2 &&
      v.from.every((n) => typeof n === 'number' && Number.isFinite(n));
    const deltaOk =
      typeof v?.dx === 'number' &&
      Number.isFinite(v.dx) &&
      typeof v?.dy === 'number' &&
      Number.isFinite(v.dy);
    if (!deltaOk || (!fromOk && !(params.tipToTail && cursor))) {
      console.warn('[VectorDiagram] skipping vector with invalid coordinates', v);
      continue;
    }
    const tail: [number, number] =
      params.tipToTail && cursor
        ? cursor
        : [clamp(v.from[0], -14, 14), clamp(v.from[1], -14, 14)];
    const dx = clamp(v.dx, -14, 14);
    const dy = clamp(v.dy, -14, 14);
    const tip: [number, number] = [tail[0] + dx, tail[1] + dy];
    resolved.push({
      x1: tail[0],
      y1: tail[1],
      x2: tip[0],
      y2: tip[1],
      label: typeof v.label === 'string' ? v.label : undefined,
      dashed: v.style === 'dashed',
    });
    cursor = tip;
  }

  if (resolved.length === 0) {
    console.warn('[VectorDiagram] no valid vectors', params);
    return null;
  }

  const showResultant =
    mode === 'feedback' && params.showResultant === true;
  if (params.showResultant === true && resolved.length < 2) {
    console.warn('[VectorDiagram] showResultant ignored — needs at least 2 vectors');
  }
  const resultant: ResolvedVector | null =
    showResultant && resolved.length >= 2
      ? {
          x1: resolved[0].x1,
          y1: resolved[0].y1,
          x2: resolved[resolved.length - 1].x2,
          y2: resolved[resolved.length - 1].y2,
          label: params.resultantLabel,
          dashed: true,
        }
      : null;

  // Grid bounds: every tail and tip, plus 1 unit of padding.
  const xs = resolved.flatMap((v) => [v.x1, v.x2]);
  const ys = resolved.flatMap((v) => [v.y1, v.y2]);
  if (params.axes) {
    xs.push(0);
    ys.push(0);
  }
  const minX = Math.floor(Math.min(...xs)) - 1;
  const maxX = Math.ceil(Math.max(...xs)) + 1;
  const minY = Math.floor(Math.min(...ys)) - 1;
  const maxY = Math.ceil(Math.max(...ys)) + 1;
  const cols = maxX - minX;
  const rows = maxY - minY;

  const cell = clamp(Math.min(300 / cols, 260 / rows), 13, 34);
  const width = cols * cell + MARGIN * 2;
  const height = rows * cell + MARGIN * 2;

  const toX = (x: number) => MARGIN + (x - minX) * cell;
  const toY = (y: number) => MARGIN + (maxY - y) * cell; // grid y up → SVG y down

  const showGrid = params.grid !== false;

  const desc =
    `Vector diagram with ${resolved.length} vector${resolved.length === 1 ? '' : 's'}: ` +
    resolved
      .map(
        (v) =>
          `${v.label ? `${v.label} ` : ''}from (${f(v.x1)}, ${f(v.y1)}) to (${f(v.x2)}, ${f(v.y2)})`
      )
      .join('; ') +
    (resultant
      ? `; resultant${resultant.label ? ` ${resultant.label}` : ''} from (${f(resultant.x1)}, ${f(resultant.y1)}) to (${f(resultant.x2)}, ${f(resultant.y2)})`
      : '') +
    '.';

  const renderVector = (v: ResolvedVector, color: string, key: string) => {
    const x1 = toX(v.x1);
    const y1 = toY(v.y1);
    const x2 = toX(v.x2);
    const y2 = toY(v.y2);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return null;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const px = -uy;
    const py = ux;
    const baseX = x2 - ux * 10;
    const baseY = y2 - uy * 10;
    const head = [
      `${f(x2)},${f(y2)}`,
      `${f(baseX + px * 5)},${f(baseY + py * 5)}`,
      `${f(baseX - px * 5)},${f(baseY - py * 5)}`,
    ].join(' ');

    const bold = v.label ? isVectorLetter(v.label) : false;
    const labelX = (x1 + x2) / 2 + px * 14;
    const labelY = (y1 + y2) / 2 + py * 14 + 4;

    return (
      <g key={key}>
        <line
          x1={f(x1)}
          y1={f(y1)}
          x2={f(baseX)}
          y2={f(baseY)}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={v.dashed ? '5,4' : undefined}
        />
        <polygon points={head} fill={color} />
        {v.label && (
          <text
            {...FONT}
            x={f(labelX)}
            y={f(labelY)}
            textAnchor="middle"
            fontSize={bold ? '16' : '13'}
            fontWeight={bold ? 700 : 600}
            fill={color}
          >
            {v.label}
          </text>
        )}
      </g>
    );
  };

  // Grid line coordinate lists
  const gridXs: number[] = [];
  for (let x = minX; x <= maxX; x++) gridXs.push(x);
  const gridYs: number[] = [];
  for (let y = minY; y <= maxY; y++) gridYs.push(y);

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 380 }}
      >
        <svg
          viewBox={`0 0 ${f(width)} ${f(height)}`}
          width="100%"
          style={{ maxWidth: 340, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>Vector diagram</title>
          <desc>{desc}</desc>

          {/* grid */}
          {showGrid &&
            gridXs.map((x) => (
              <line
                key={`gx-${x}`}
                x1={f(toX(x))}
                y1={f(toY(maxY))}
                x2={f(toX(x))}
                y2={f(toY(minY))}
                stroke={GRID_COLOR}
                strokeWidth="1"
              />
            ))}
          {showGrid &&
            gridYs.map((y) => (
              <line
                key={`gy-${y}`}
                x1={f(toX(minX))}
                y1={f(toY(y))}
                x2={f(toX(maxX))}
                y2={f(toY(y))}
                stroke={GRID_COLOR}
                strokeWidth="1"
              />
            ))}

          {/* axes through the origin */}
          {params.axes && minX <= 0 && maxX >= 0 && (
            <line
              x1={f(toX(0))}
              y1={f(toY(maxY))}
              x2={f(toX(0))}
              y2={f(toY(minY))}
              stroke={AXIS_COLOR}
              strokeWidth="1.5"
            />
          )}
          {params.axes && minY <= 0 && maxY >= 0 && (
            <line
              x1={f(toX(minX))}
              y1={f(toY(0))}
              x2={f(toX(maxX))}
              y2={f(toY(0))}
              stroke={AXIS_COLOR}
              strokeWidth="1.5"
            />
          )}

          {/* vectors */}
          {resolved.map((v, i) => renderVector(v, STROKE, `v-${i}`))}

          {/* resultant (worked solutions only) */}
          {resultant && renderVector(resultant, RESULTANT_COLOR, 'resultant')}
        </svg>
      </div>
    </div>
  );
}
