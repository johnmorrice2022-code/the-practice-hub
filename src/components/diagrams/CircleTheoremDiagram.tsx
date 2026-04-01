// CircleTheoremDiagram.tsx
// React SVG component for circle theorem diagrams.
// Accepts theoremType and params — renders a unique diagram per question.

import { circlePoint, angleArc, arcLabel, outerLbl, rightAnglePoints, f } from "./geometry";

export type TheoremType =
  | "semicircle"
  | "same_segment"
  | "angle_at_centre"
  | "cyclic_quadrilateral";

// Params Claude generates per question — angle values and point positions
export interface DiagramParams {
  // semicircle
  cAngleDeg?: number;          // position of C on upper arc (60-150)
  givenAngle?: number;         // angle CAB given to student
  // same_segment
  dAngleDeg?: number;          // position of D on upper arc
  cAngleDeg2?: number;         // position of C on upper arc (different from D)
  knownAngle?: number;         // given angle at D
  aAngleDeg?: number;          // position of A on circle
  bAngleDeg?: number;          // position of B on circle
  // angle_at_centre
  pAngleDeg?: number;          // position of P on circumference
  centreAngle?: number;        // 2x value shown at centre
  circumAngle?: number;        // x value shown at circumference
  // cyclic_quadrilateral
  angleA?: number;             // given angle DAB
  angleB?: number;             // given angle ABC
  ptA?: number;                // position of A on circle
  ptB?: number;                // position of B on circle
  ptC?: number;                // position of C on circle
  ptD?: number;                // position of D on circle
}

const LABEL_FONT = {
  fontFamily: "'Georgia', serif",
  fontSize: "15",
  fontWeight: "600" as const,
  textAnchor: "middle" as const,
  dominantBaseline: "middle" as const,
  fill: "#1C1917",
};

const ARC_FONT = {
  fontFamily: "'system-ui', sans-serif",
  fontSize: "11",
  fontWeight: "700" as const,
  textAnchor: "middle" as const,
  dominantBaseline: "middle" as const,
};

interface Props {
  theoremType: TheoremType;
  params?: DiagramParams;
}

// ─── Theorem 1: Angle in a Semicircle ──────────────────────────────────────
function Semicircle({ params }: { params: DiagramParams }) {
  const cx = 150, cy = 148, r = 108;
  const cDeg = params.cAngleDeg ?? 118;
  const givenAngle = params.givenAngle ?? 38;

  const A = { x: cx - r, y: cy };
  const B = { x: cx + r, y: cy };
  const C = circlePoint(cx, cy, r, cDeg);
  const O = { x: cx, y: cy };

  const raPoints = rightAnglePoints(C, A, B, 10);
  const lA = outerLbl(cx, cy, A.x, A.y, 18);
  const lB = outerLbl(cx, cy, B.x, B.y, 18);
  const lC = outerLbl(cx, cy, C.x, C.y, 18);

  return (
    <svg viewBox="0 0 300 280" width="100%" style={{ maxWidth: 320 }} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1917" strokeWidth="1.6" />
      <line x1={f(A.x)} y1={f(A.y)} x2={f(B.x)} y2={f(B.y)} stroke="#1C1917" strokeWidth="1.8" />
      <circle cx={f(O.x)} cy={f(O.y)} r="3.5" fill="#1C1917" />
      <text x={f(cx + 7)} y={f(cy - 7)} {...LABEL_FONT} fontSize="13" fill="#44403C">O</text>
      <line x1={f(A.x)} y1={f(A.y)} x2={f(C.x)} y2={f(C.y)} stroke="#1C1917" strokeWidth="1.4" />
      <line x1={f(B.x)} y1={f(B.y)} x2={f(C.x)} y2={f(C.y)} stroke="#1C1917" strokeWidth="1.4" />
      <polyline points={raPoints} fill="none" stroke="#1C1917" strokeWidth="1.3" />
      <circle cx={f(A.x)} cy={f(A.y)} r="3" fill="#1C1917" />
      <circle cx={f(B.x)} cy={f(B.y)} r="3" fill="#1C1917" />
      <circle cx={f(C.x)} cy={f(C.y)} r="3" fill="#1C1917" />
      <text x={f(lA.x)} y={f(lA.y)} {...LABEL_FONT}>A</text>
      <text x={f(lB.x)} y={f(lB.y)} {...LABEL_FONT}>B</text>
      <text x={f(lC.x)} y={f(lC.y)} {...LABEL_FONT}>C</text>
      {/* Given angle label at A */}
      <text x={f(A.x + 22)} y={f(A.y - 12)} {...ARC_FONT} fill="#D97706">{givenAngle}°</text>
    </svg>
  );
}

// ─── Theorem 2: Angles in the Same Segment ─────────────────────────────────
function SameSegment({ params }: { params: DiagramParams }) {
  const cx = 150, cy = 150, r = 108;
  const aDeg = params.aAngleDeg ?? 205;
  const bDeg = params.bAngleDeg ?? 335;
  const cDeg = params.cAngleDeg2 ?? 100;
  const dDeg = params.dAngleDeg ?? 55;
  const knownAngle = params.knownAngle ?? 42;

  const A = circlePoint(cx, cy, r, aDeg);
  const B = circlePoint(cx, cy, r, bDeg);
  const C = circlePoint(cx, cy, r, cDeg);
  const D = circlePoint(cx, cy, r, dDeg);

  const arcD = angleArc(D, A, B, 18);
  const lblD = arcLabel(D, A, B, 18, 1.9);
  const arcC = angleArc(C, A, B, 18);
  const lblC = arcLabel(C, A, B, 18, 1.9);

  const off = 18;
  const lA = outerLbl(cx, cy, A.x, A.y, off);
  const lB = outerLbl(cx, cy, B.x, B.y, off);
  const lC = outerLbl(cx, cy, C.x, C.y, off);
  const lD = outerLbl(cx, cy, D.x, D.y, off);

  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 320 }} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1917" strokeWidth="1.6" />
      <line x1={f(A.x)} y1={f(A.y)} x2={f(B.x)} y2={f(B.y)} stroke="#1C1917" strokeWidth="1.8" />
      <line x1={f(D.x)} y1={f(D.y)} x2={f(A.x)} y2={f(A.y)} stroke="#D97706" strokeWidth="1.4" />
      <line x1={f(D.x)} y1={f(D.y)} x2={f(B.x)} y2={f(B.y)} stroke="#D97706" strokeWidth="1.4" />
      <line x1={f(C.x)} y1={f(C.y)} x2={f(A.x)} y2={f(A.y)} stroke="#1C1917" strokeWidth="1.4" />
      <line x1={f(C.x)} y1={f(C.y)} x2={f(B.x)} y2={f(B.y)} stroke="#1C1917" strokeWidth="1.4" />
      {[A, B, C, D].map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r="3" fill="#1C1917" />)}
      <path d={arcD.pathD} fill="none" stroke="#D97706" strokeWidth="1.7" />
      <text x={f(lblD.x)} y={f(lblD.y)} {...ARC_FONT} fill="#D97706">{knownAngle}°</text>
      <path d={arcC.pathD} fill="none" stroke="#1C1917" strokeWidth="1.7" />
      <text x={f(lblC.x)} y={f(lblC.y)} {...ARC_FONT} fill="#1C1917">?</text>
      <text x={f(lA.x)} y={f(lA.y)} {...LABEL_FONT}>A</text>
      <text x={f(lB.x)} y={f(lB.y)} {...LABEL_FONT}>B</text>
      <text x={f(lC.x)} y={f(lC.y)} {...LABEL_FONT}>C</text>
      <text x={f(lD.x)} y={f(lD.y)} {...LABEL_FONT}>D</text>
    </svg>
  );
}

// ─── Theorem 3: Angle at the Centre ────────────────────────────────────────
function AngleAtCentre({ params }: { params: DiagramParams }) {
  const cx = 150, cy = 158, r = 108;
  const pDeg = params.pAngleDeg ?? 92;
  const aDeg = params.aAngleDeg ?? 215;
  const bDeg = params.bAngleDeg ?? 325;
  const circumAngle = params.circumAngle ?? 34;
  const centreAngle = params.centreAngle ?? circumAngle * 2;

  const A = circlePoint(cx, cy, r, aDeg);
  const B = circlePoint(cx, cy, r, bDeg);
  const P = circlePoint(cx, cy, r, pDeg);
  const O = { x: cx, y: cy };

  const arcO = angleArc(O, A, B, 20);
  const lblO = arcLabel(O, A, B, 20, 1.9);
  const arcP = angleArc(P, A, B, 18);
  const lblP = arcLabel(P, A, B, 18, 2.0);

  const off = 18;
  const lA = outerLbl(cx, cy, A.x, A.y, off);
  const lB = outerLbl(cx, cy, B.x, B.y, off);
  const lP = outerLbl(cx, cy, P.x, P.y, off);

  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 320 }} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1917" strokeWidth="1.6" />
      <circle cx={f(O.x)} cy={f(O.y)} r="3.5" fill="#1C1917" />
      <line x1={f(A.x)} y1={f(A.y)} x2={f(B.x)} y2={f(B.y)} stroke="#78716C" strokeWidth="1.2" strokeDasharray="4,3" />
      <line x1={f(O.x)} y1={f(O.y)} x2={f(A.x)} y2={f(A.y)} stroke="#D97706" strokeWidth="1.8" />
      <line x1={f(O.x)} y1={f(O.y)} x2={f(B.x)} y2={f(B.y)} stroke="#D97706" strokeWidth="1.8" />
      <line x1={f(P.x)} y1={f(P.y)} x2={f(A.x)} y2={f(A.y)} stroke="#1C1917" strokeWidth="1.4" />
      <line x1={f(P.x)} y1={f(P.y)} x2={f(B.x)} y2={f(B.y)} stroke="#1C1917" strokeWidth="1.4" />
      {[A, B, P].map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r="3" fill="#1C1917" />)}
      <path d={arcO.pathD} fill="none" stroke="#D97706" strokeWidth="1.8" />
      <text x={f(lblO.x)} y={f(lblO.y)} {...ARC_FONT} fill="#D97706">{centreAngle}°</text>
      <path d={arcP.pathD} fill="none" stroke="#1C1917" strokeWidth="1.6" />
      <text x={f(lblP.x)} y={f(lblP.y)} {...ARC_FONT} fill="#1C1917">{circumAngle}°</text>
      <text x={f(cx + 8)} y={f(cy - 8)} {...LABEL_FONT} fontSize="13" fill="#44403C">O</text>
      <text x={f(lA.x)} y={f(lA.y)} {...LABEL_FONT}>A</text>
      <text x={f(lB.x)} y={f(lB.y)} {...LABEL_FONT}>B</text>
      <text x={f(lP.x)} y={f(lP.y)} {...LABEL_FONT}>P</text>
    </svg>
  );
}

// ─── Theorem 4: Cyclic Quadrilateral ───────────────────────────────────────
function CyclicQuadrilateral({ params }: { params: DiagramParams }) {
  const cx = 150, cy = 150, r = 108;
  const ptA = params.ptA ?? 200;
  const ptB = params.ptB ?? 310;
  const ptC = params.ptC ?? 30;
  const ptD = params.ptD ?? 118;
  const angleA = params.angleA ?? 110;
  const angleB = params.angleB ?? 85;

  const A = circlePoint(cx, cy, r, ptA);
  const B = circlePoint(cx, cy, r, ptB);
  const C = circlePoint(cx, cy, r, ptC);
  const D = circlePoint(cx, cy, r, ptD);

  const pts = [A, B, C, D].map(p => `${f(p.x)},${f(p.y)}`).join(' ');

  const aA = angleArc(A, D, B, 19);
  const aB = angleArc(B, A, C, 19);
  const aC = angleArc(C, B, D, 19);
  const aD = angleArc(D, C, A, 19);

  const off = 18;
  const lA = outerLbl(cx, cy, A.x, A.y, off);
  const lB = outerLbl(cx, cy, B.x, B.y, off);
  const lC = outerLbl(cx, cy, C.x, C.y, off);
  const lD = outerLbl(cx, cy, D.x, D.y, off);

  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 320 }} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1C1917" strokeWidth="1.6" />
      <polygon points={pts} fill="none" stroke="#1C1917" strokeWidth="1.5" />
      {[A, B, C, D].map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r="3" fill="#1C1917" />)}
      <path d={aA.pathD} fill="none" stroke="#D97706" strokeWidth="1.7" />
      <text x={f(arcLabel(A, D, B, 19, 2.0).x)} y={f(arcLabel(A, D, B, 19, 2.0).y)} {...ARC_FONT} fill="#D97706">{angleA}°</text>
      <path d={aB.pathD} fill="none" stroke="#D97706" strokeWidth="1.7" />
      <text x={f(arcLabel(B, A, C, 19, 2.0).x)} y={f(arcLabel(B, A, C, 19, 2.0).y)} {...ARC_FONT} fill="#D97706">{angleB}°</text>
      <path d={aC.pathD} fill="none" stroke="#1C1917" strokeWidth="1.7" />
      <text x={f(arcLabel(C, B, D, 19, 2.0).x)} y={f(arcLabel(C, B, D, 19, 2.0).y)} {...ARC_FONT} fill="#1C1917">?</text>
      <path d={aD.pathD} fill="none" stroke="#1C1917" strokeWidth="1.7" />
      <text x={f(arcLabel(D, C, A, 19, 2.0).x)} y={f(arcLabel(D, C, A, 19, 2.0).y)} {...ARC_FONT} fill="#1C1917">?</text>
      <text x={f(lA.x)} y={f(lA.y)} {...LABEL_FONT}>A</text>
      <text x={f(lB.x)} y={f(lB.y)} {...LABEL_FONT}>B</text>
      <text x={f(lC.x)} y={f(lC.y)} {...LABEL_FONT}>C</text>
      <text x={f(lD.x)} y={f(lD.y)} {...LABEL_FONT}>D</text>
    </svg>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────
export function CircleTheoremDiagram({ theoremType, params = {} }: Props) {
  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 360 }}
      >
        {theoremType === "semicircle" && <Semicircle params={params} />}
        {theoremType === "same_segment" && <SameSegment params={params} />}
        {theoremType === "angle_at_centre" && <AngleAtCentre params={params} />}
        {theoremType === "cyclic_quadrilateral" && <CyclicQuadrilateral params={params} />}
      </div>
    </div>
  );
}