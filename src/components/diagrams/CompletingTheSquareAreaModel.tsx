// CompletingTheSquareAreaModel.tsx
// Geometric area-model diagram for x^2 + bx: an x-by-x square plus two
// (b/2)-by-x rectangles, with the missing (b/2)-by-(b/2) corner square
// highlighted as the piece needed to "complete the square" to (x + b/2)^2.
// Used in learning content via diagram_component/diagram_params.

export interface CompletingTheSquareAreaModelParams {
  b: number; // coefficient of x in x^2 + bx (must be a positive even number for a clean diagram)
}

const X_SIZE = 150;
const STROKE = '#1C1917';
const X_FILL = '#FFFFFF';
const STRIP_FILL = '#FDE9C8';
const MISSING_FILL = '#FBEAE7';

const LABEL_FONT = {
  fontFamily: "'Georgia', serif",
  fontSize: '15',
  fontWeight: '600' as const,
  textAnchor: 'middle' as const,
  fill: '#1C1917',
};

export function CompletingTheSquareAreaModel({
  params,
}: {
  params: CompletingTheSquareAreaModelParams;
}) {
  if (!params || typeof params.b !== 'number' || params.b <= 0) {
    return null;
  }

  const half = params.b / 2;
  const halfLabel = Number.isInteger(half) ? `${half}` : `\\frac{${params.b}}{2}`;
  // Strip width drawn proportionally to the x-square, capped so the diagram stays readable
  const stripSize = Math.max(30, Math.min(90, X_SIZE * 0.5));

  const total = X_SIZE + stripSize;
  const margin = 40;
  const viewSize = total + margin * 2;

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 360 }}
      >
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          width="100%"
          style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* x^2 square (top-left) */}
          <rect
            x={margin}
            y={margin}
            width={X_SIZE}
            height={X_SIZE}
            fill={X_FILL}
            stroke={STROKE}
            strokeWidth="1.5"
          />
          <text x={margin + X_SIZE / 2} y={margin + X_SIZE / 2 + 5} {...LABEL_FONT} fontSize="20">
            x²
          </text>

          {/* right strip: (b/2) by x */}
          <rect
            x={margin + X_SIZE}
            y={margin}
            width={stripSize}
            height={X_SIZE}
            fill={STRIP_FILL}
            stroke={STROKE}
            strokeWidth="1.5"
          />

          {/* bottom strip: x by (b/2) */}
          <rect
            x={margin}
            y={margin + X_SIZE}
            width={X_SIZE}
            height={stripSize}
            fill={STRIP_FILL}
            stroke={STROKE}
            strokeWidth="1.5"
          />

          {/* missing corner square: (b/2) by (b/2) */}
          <rect
            x={margin + X_SIZE}
            y={margin + X_SIZE}
            width={stripSize}
            height={stripSize}
            fill={MISSING_FILL}
            stroke={STROKE}
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />

          {/* side length labels */}
          <text x={margin + X_SIZE / 2} y={margin - 12} {...LABEL_FONT} fontSize="14">
            x
          </text>
          <text x={margin + X_SIZE + stripSize / 2} y={margin - 12} {...LABEL_FONT} fontSize="13">
            {halfLabel}
          </text>
          <text x={margin - 14} y={margin + X_SIZE / 2 + 5} {...LABEL_FONT} fontSize="14" transform={`rotate(-90 ${margin - 14} ${margin + X_SIZE / 2 + 5})`}>
            x
          </text>
          <text x={margin - 14} y={margin + X_SIZE + stripSize / 2 + 5} {...LABEL_FONT} fontSize="12" transform={`rotate(-90 ${margin - 14} ${margin + X_SIZE + stripSize / 2 + 5})`}>
            {halfLabel}
          </text>

          {/* area labels inside strips */}
          <text x={margin + X_SIZE + stripSize / 2} y={margin + X_SIZE / 2 + 5} {...LABEL_FONT} fontSize="13">
            {`${halfLabel}x`}
          </text>
          <text x={margin + X_SIZE / 2} y={margin + X_SIZE + stripSize / 2 + 5} {...LABEL_FONT} fontSize="13">
            {`${halfLabel}x`}
          </text>

          {/* missing piece label */}
          <text
            x={margin + X_SIZE + stripSize / 2}
            y={margin + X_SIZE + stripSize / 2 + 5}
            {...LABEL_FONT}
            fontSize="12"
            fill="#E23D28"
          >
            ?
          </text>

          {/* total side length, below the diagram */}
          <text x={total / 2 + margin} y={viewSize - 8} {...LABEL_FONT} fontSize="13" fill="#78716C">
            {`(x + ${halfLabel})`}
          </text>
        </svg>
      </div>
    </div>
  );
}
