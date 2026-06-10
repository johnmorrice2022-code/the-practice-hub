// QuadraticInequalityGraph.tsx
// Sketch of a quadratic curve with the solution region of an inequality
// highlighted on the x-axis. Used in learning content (and, via the same
// diagram_component/diagram_params pattern, worked solutions) wherever a
// quadratic inequality needs a supporting graph.

export interface QuadraticInequalityGraphParams {
  roots: [number, number];        // smaller root first
  a?: number;                     // sign of leading coefficient (default +1)
  inequality?: '<' | '>' | '<=' | '>='; // determines shading + open/closed circles
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

export function QuadraticInequalityGraph({
  params,
}: {
  params: QuadraticInequalityGraphParams;
}) {
  if (!params || !Array.isArray(params.roots) || params.roots.length !== 2) {
    return null;
  }

  const [r1, r2] = [...params.roots].sort((a, b) => a - b);
  const a = params.a ?? 1;
  const inequality = params.inequality ?? '<';

  const span = r2 - r1;
  const pad = Math.max(span * 0.6, 1);
  const xMin = r1 - pad;
  const xMax = r2 + pad;

  const xToPx = (x: number) =>
    PLOT_LEFT + ((x - xMin) / (xMax - xMin)) * (PLOT_RIGHT - PLOT_LEFT);

  const fx = (x: number) => a * (x - r1) * (x - r2);

  // Sample the curve to find the y-domain
  const samples = 40;
  let yMin = 0;
  let yMax = 0;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + (i / samples) * (xMax - xMin);
    const y = fx(x);
    points.push({ x, y });
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad;
  yMax += yPad;

  const yToPx = (y: number) =>
    PLOT_BOTTOM - ((y - yMin) / (yMax - yMin)) * (PLOT_BOTTOM - PLOT_TOP);

  const zeroY = yToPx(0);

  const curvePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(xToPx(p.x))} ${f(yToPx(p.y))}`)
    .join(' ');

  // Solution region: between roots if (a>0 and "< 0") or (a<0 and "> 0")
  const isLess = inequality === '<' || inequality === '<=';
  const betweenRoots = (a > 0 && isLess) || (a < 0 && !isLess);
  const isStrict = inequality === '<' || inequality === '>';

  const r1Px = xToPx(r1);
  const r2Px = xToPx(r2);

  const rootCircle = (cx: number) => (
    <circle
      cx={f(cx)}
      cy={f(zeroY)}
      r="4"
      fill={isStrict ? '#FFFFFF' : HIGHLIGHT_COLOR}
      stroke={HIGHLIGHT_COLOR}
      strokeWidth="2"
    />
  );

  // Highlighted curve segment(s) over the solution region
  const highlightSegments: string[] = [];
  if (betweenRoots) {
    const seg = points.filter((p) => p.x >= r1 && p.x <= r2);
    highlightSegments.push(
      seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(xToPx(p.x))} ${f(yToPx(p.y))}`).join(' ')
    );
  } else {
    const left = points.filter((p) => p.x <= r1);
    const right = points.filter((p) => p.x >= r2);
    highlightSegments.push(
      left.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(xToPx(p.x))} ${f(yToPx(p.y))}`).join(' ')
    );
    highlightSegments.push(
      right.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(xToPx(p.x))} ${f(yToPx(p.y))}`).join(' ')
    );
  }

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
          {/* x-axis */}
          <line
            x1={PLOT_LEFT}
            y1={f(zeroY)}
            x2={PLOT_RIGHT}
            y2={f(zeroY)}
            stroke={AXIS_COLOR}
            strokeWidth="1.4"
          />
          <text x={PLOT_RIGHT + 6} y={f(zeroY + 4)} {...LABEL_FONT} fontSize="12" fill={AXIS_COLOR}>x</text>

          {/* y-axis (if 0 is within view) */}
          {xMin < 0 && xMax > 0 && (
            <line
              x1={f(xToPx(0))}
              y1={PLOT_TOP}
              x2={f(xToPx(0))}
              y2={PLOT_BOTTOM}
              stroke={AXIS_COLOR}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

          {/* curve */}
          <path d={curvePath} fill="none" stroke={CURVE_COLOR} strokeWidth="2" />

          {/* highlighted solution segment(s) of the curve */}
          {highlightSegments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={HIGHLIGHT_COLOR} strokeWidth="3" />
          ))}

          {/* highlighted solution interval on the x-axis */}
          {betweenRoots ? (
            <line
              x1={f(r1Px)}
              y1={f(zeroY)}
              x2={f(r2Px)}
              y2={f(zeroY)}
              stroke={HIGHLIGHT_COLOR}
              strokeWidth="3"
            />
          ) : (
            <>
              <line x1={PLOT_LEFT} y1={f(zeroY)} x2={f(r1Px)} y2={f(zeroY)} stroke={HIGHLIGHT_COLOR} strokeWidth="3" />
              <line x1={f(r2Px)} y1={f(zeroY)} x2={PLOT_RIGHT} y2={f(zeroY)} stroke={HIGHLIGHT_COLOR} strokeWidth="3" />
            </>
          )}

          {/* root markers + labels */}
          {rootCircle(r1Px)}
          {rootCircle(r2Px)}
          <text x={f(r1Px)} y={f(zeroY + 20)} {...LABEL_FONT}>{f(r1)}</text>
          <text x={f(r2Px)} y={f(zeroY + 20)} {...LABEL_FONT}>{f(r2)}</text>
        </svg>
      </div>
    </div>
  );
}
