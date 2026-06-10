// ParabolaVertexGraph.tsx
// Simple sketch of a quadratic curve y = a(x + p)^2 + q with its vertex
// (minimum point) marked, plus dashed guide lines to the axes showing the
// vertex coordinates (-p, q). Used in learning content to show how
// completed square form gives the minimum point of a curve directly.

export interface ParabolaVertexGraphParams {
  p: number; // completed square form is (x + p)^2 + q -> vertex at x = -p
  q: number; // vertex y-coordinate
  a?: number; // leading coefficient (default 1, should be positive)
}

const AXIS_COLOR = '#78716C';
const CURVE_COLOR = '#1C1917';
const HIGHLIGHT_COLOR = '#E23D28';

const PLOT_LEFT = 30;
const PLOT_RIGHT = 270;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 190;

const LABEL_FONT = {
  fontFamily: "'Georgia', serif",
  fontSize: '13',
  fontWeight: '600' as const,
  textAnchor: 'middle' as const,
  fill: '#1C1917',
};

function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function ParabolaVertexGraph({
  params,
}: {
  params: ParabolaVertexGraphParams;
}) {
  if (!params || typeof params.p !== 'number' || typeof params.q !== 'number') {
    return null;
  }

  const a = params.a ?? 1;
  const vx = -params.p;
  const vy = params.q;

  // Plot a window centred on the vertex, wide enough to show its shape
  const span = 4;
  let xMin = vx - span;
  let xMax = vx + span;
  // Always include the y-axis (x = 0)
  xMin = Math.min(xMin, 0);
  xMax = Math.max(xMax, 0);

  const fx = (x: number) => a * (x - vx) * (x - vx) + vy;

  const samples = 40;
  let yMin = vy;
  let yMax = vy;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    const y = fx(x);
    points.push({ x, y });
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  // Always include the x-axis (y = 0)
  yMin = Math.min(yMin, 0);
  yMax = Math.max(yMax, 0);
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad;
  yMax += yPad;

  const xToPx = (x: number) =>
    PLOT_LEFT + ((x - xMin) / (xMax - xMin)) * (PLOT_RIGHT - PLOT_LEFT);
  const yToPx = (y: number) =>
    PLOT_BOTTOM - ((y - yMin) / (yMax - yMin)) * (PLOT_BOTTOM - PLOT_TOP);

  const curvePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(xToPx(p.x))} ${f(yToPx(p.y))}`)
    .join(' ');

  const vxPx = xToPx(vx);
  const vyPx = yToPx(vy);
  const zeroXPx = xToPx(0);
  const zeroYPx = yToPx(0);

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 360 }}
      >
        <svg
          viewBox="0 0 300 220"
          width="100%"
          style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* axes */}
          <line x1={PLOT_LEFT} y1={f(zeroYPx)} x2={PLOT_RIGHT} y2={f(zeroYPx)} stroke={AXIS_COLOR} strokeWidth="1.4" />
          <text x={PLOT_RIGHT + 6} y={f(zeroYPx + 4)} {...LABEL_FONT} fontSize="12" fill={AXIS_COLOR}>x</text>

          <line x1={f(zeroXPx)} y1={PLOT_TOP} x2={f(zeroXPx)} y2={PLOT_BOTTOM} stroke={AXIS_COLOR} strokeWidth="1.4" />
          <text x={f(zeroXPx)} y={PLOT_TOP - 6} {...LABEL_FONT} fontSize="12" fill={AXIS_COLOR}>y</text>

          {/* dashed guide lines to vertex */}
          <line x1={f(vxPx)} y1={f(vyPx)} x2={f(vxPx)} y2={f(zeroYPx)} stroke={HIGHLIGHT_COLOR} strokeWidth="1" strokeDasharray="3,3" />
          <line x1={f(vxPx)} y1={f(vyPx)} x2={f(zeroXPx)} y2={f(vyPx)} stroke={HIGHLIGHT_COLOR} strokeWidth="1" strokeDasharray="3,3" />

          {/* curve */}
          <path d={curvePath} fill="none" stroke={CURVE_COLOR} strokeWidth="2" />

          {/* vertex marker + label */}
          <circle cx={f(vxPx)} cy={f(vyPx)} r="4" fill={HIGHLIGHT_COLOR} stroke={HIGHLIGHT_COLOR} strokeWidth="2" />
          <text x={f(vxPx)} y={f(vyPx - 12)} {...LABEL_FONT} fontSize="13" fill={HIGHLIGHT_COLOR}>
            {`(${f(vx)}, ${f(vy)})`}
          </text>
        </svg>
      </div>
    </div>
  );
}
