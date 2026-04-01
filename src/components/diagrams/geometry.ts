// geometry.ts — Pure TypeScript port of the circle theorem geometry engine
// Converted from the HTML prototype's vanilla JS

export interface Point { x: number; y: number }

export function rad(d: number): number {
  return d * Math.PI / 180;
}

/** Point on circle. angleDeg: standard math (0=right, CCW positive). SVG y-axis flipped. */
export function circlePoint(cx: number, cy: number, r: number, angleDeg: number): Point {
  return {
    x: cx + r * Math.cos(rad(angleDeg)),
    y: cy - r * Math.sin(rad(angleDeg)),
  };
}

export function norm(vx: number, vy: number): Point {
  const m = Math.sqrt(vx * vx + vy * vy);
  return { x: vx / m, y: vy / m };
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export interface AngleArcResult {
  pathD: string;
  mid: Point;
}

/** SVG arc path between the two arms of an angle at vertex */
export function angleArc(vertex: Point, p1: Point, p2: Point, arcR: number): AngleArcResult {
  const d1 = norm(p1.x - vertex.x, p1.y - vertex.y);
  const d2 = norm(p2.x - vertex.x, p2.y - vertex.y);
  const s = { x: vertex.x + arcR * d1.x, y: vertex.y + arcR * d1.y };
  const e = { x: vertex.x + arcR * d2.x, y: vertex.y + arcR * d2.y };
  const sweep = cross(d1.x, d1.y, d2.x, d2.y) > 0 ? 1 : 0;
  const pathD = `M ${f(s.x)},${f(s.y)} A ${arcR},${arcR} 0 0,${sweep} ${f(e.x)},${f(e.y)}`;
  const mid = norm(d1.x + d2.x, d1.y + d2.y);
  return { pathD, mid };
}

/** Position for an angle arc label */
export function arcLabel(vertex: Point, p1: Point, p2: Point, arcR: number, scale: number): Point {
  const { mid } = angleArc(vertex, p1, p2, arcR);
  return { x: vertex.x + arcR * scale * mid.x, y: vertex.y + arcR * scale * mid.y };
}

/** Push a point label outward from the circle centre */
export function outerLbl(cx: number, cy: number, px: number, py: number, offset: number): Point {
  const d = norm(px - cx, py - cy);
  return { x: px + offset * d.x, y: py + offset * d.y };
}

/** Right-angle square marker at vertex with arms toward p1 and p2 */
export function rightAnglePoints(vertex: Point, p1: Point, p2: Point, s = 9): string {
  const d1 = norm(p1.x - vertex.x, p1.y - vertex.y);
  const d2 = norm(p2.x - vertex.x, p2.y - vertex.y);
  const q1 = { x: vertex.x + s * d1.x, y: vertex.y + s * d1.y };
  const q2 = { x: vertex.x + s * d2.x, y: vertex.y + s * d2.y };
  const q3 = { x: q1.x + s * d2.x, y: q1.y + s * d2.y };
  return `${f(q1.x)},${f(q1.y)} ${f(q3.x)},${f(q3.y)} ${f(q2.x)},${f(q2.y)}`;
}

export function f(n: number): string {
  return n.toFixed(2);
}