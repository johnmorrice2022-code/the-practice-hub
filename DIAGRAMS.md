# DIAGRAMS.md — Parametric Diagram Component Library Specification

**Status: APPROVED by John 11/06/2026 (all open questions resolved — see Section 10). Build phases in progress.**

This document is the single source of truth for the param schema of every parametric
question diagram. Schemas are contracts: once questions exist in the database carrying
`diagram_params` in a given shape, changing that shape is expensive. Get it right here.

---

## 1. Shared conventions (all components)

These rules apply to every component in this document and follow the pattern proven by
`CompletingTheSquareAreaModel` and `QuadraticInequalityGraph`.

### Rendering
- Inline SVG with a `viewBox`, no external charting libraries, no canvas.
- Each component wraps its SVG in the established container:
  outer `<div className="flex justify-center py-4 px-2">`, inner
  `bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full` with `maxWidth: 360`
  (wider — `maxWidth: 480` — permitted for CircuitDiagram and Histogram where the
  content is intrinsically landscape).
- Must render legibly at ~340 px width. Labels must not collide at that size.

### Visual style
- Diagram line work: near-black `#1C1917`, axes/secondary lines grey `#78716C`.
- Brand red `#E23D28` and orange `#F5A623` as **accent only** (highlights, answer
  layers, "the bar you needed to draw"). Exam diagrams should look like exam diagrams.
- Soft fills from the existing palette where needed: `#FDE9C8` (warm), `#FBEAE7` (red tint).
- Label font: **Helvetica Neue** (decided 11/06/2026) for all new components.
  The four pre-existing components keep their Georgia serif labels for now;
  retrofitting them is a separate decision.
- Mathematical notation in labels (x², ½, bold vectors) via SVG `<tspan>` styling
  (`baseline-shift`, `font-weight`), never KaTeX.

### Accessibility
- Every SVG carries `<title>` and `<desc>` as its first children. `<desc>` is generated
  from params (e.g. "Free body diagram of a box with 2 forces: weight 600 N downward,
  normal contact force 600 N upward").

### Validation and graceful degradation
- Components are pure functions of params: no state, no fetching.
- Each component validates its own params at the top. A malformed params object
  (AI-generated params can be malformed) renders `null` and emits one
  `console.warn('[DiagramName] invalid params', params)` — it must never throw and
  never break QuestionCard.
- Missing optional fields fall back to sensible defaults listed per component.
- Out-of-range numeric values are clamped, not rejected, where a reasonable clamp exists.

### Registry
- Keys are kebab-case strings in `QUESTION_DIAGRAM_REGISTRY`
  (`src/components/diagrams/questionDiagramRegistry.tsx`).
- Components are stored behind thin wrapper functions adapting to the common
  `({ params, mode })` signature, exactly as the existing wrappers do.

---

## 2. Rendering contexts: `mode` prop + `questionSafe` registry flag

### The problem
QuestionCard and FeedbackCard both render the same registered component with the
same `diagram_params` (one JSONB object per question row). But several requirements
in this library need the **question rendering and the worked-solution rendering of
the same diagram to differ**:

| Component | Question shows… | Worked solution shows… |
|---|---|---|
| Histogram ("complete the histogram") | partial histogram (hidden class empty) | completed histogram, drawn bar highlighted |
| WaveDiagram ("label the wavelength") | unlabelled wave | wave with the answer label |
| FreeBodyDiagram ("find the resultant") | forces only | forces + resultant arrow |
| VectorDiagram ("find the resultant") | component vectors | vectors + resultant |
| VectorGeometryDiagram ("find vector MN") | skeleton | skeleton + highlighted route/answer edge |

A `questionSafe` predicate alone cannot do this: it can only hide the whole diagram
from the question, which would also hide the partial histogram the student needs.

### Approved design (11/06/2026)
Two complementary mechanisms, both living in the registry refactor (Phase 3):

**1. `mode` prop.** The registry component signature becomes:

```ts
type DiagramMode = 'question' | 'feedback';
type QuestionDiagramComponent = React.FC<{ params: any; mode?: DiagramMode }>;
```

QuestionCard passes `mode="question"`, FeedbackCard passes `mode="feedback"`,
default is `'question'` (fail safe: an unknown caller never leaks an answer).
Each component's schema marks specific fields as **feedback-only layers** — the
component simply does not render those layers in question mode. Existing components
ignore the prop (backwards compatible).

This is defence in depth: even if the generation pipeline attaches answer-revealing
params to a question, the question rendering cannot leak them.

**2. `questionSafe` registry metadata.** Registry entries become:

```ts
interface DiagramRegistryEntry {
  component: QuestionDiagramComponent;
  /** May this diagram appear in QuestionCard at all? */
  questionSafe: boolean | ((params: any) => boolean);
}
```

`questionSafe: false` replaces the hardcoded `quadratic-inequality-graph` exclusion
in `QuestionCard.tsx` — for diagrams whose entire purpose is to show the answer.
FeedbackCard ignores the flag and renders everything.

### Flags for existing components (approved 11/06/2026)

| Key | questionSafe |
|---|---|
| `probability-tree` | `true` |
| `quadratic-inequality-graph` | `false` (unchanged behaviour) |
| `completing-the-square-area-model` | `true` |
| `parabola-vertex-graph` | **`false` (confirmed)** — it draws the vertex coordinates, which is usually the answer. Currently it is *not* excluded in QuestionCard (it has only ever been used in learning content, so this has never bitten). Phase 3 closes this gap. |

All six new components below are `questionSafe: true` — their answer layers are
gated by `mode` instead.

---

## 3. `FreeBodyDiagram` — registry key `free-body-diagram`

**AQA Physics — Forces.** Object drawn as a box (default) or dot, with force arrows
drawn **from the centre of the object outward** (AQA convention).

### Schema

```ts
type NamedDirection = 'up' | 'down' | 'left' | 'right';

interface FreeBodyForce {
  /** AQA terminology only: weight, normal contact force, friction, air resistance,
      tension, thrust, upthrust, driving force. Free text allowed but generators
      are instructed to use this vocabulary. */
  label: string;
  /** Direction: named, or degrees anticlockwise from "right" (0 = right, 90 = up,
      180 = left, 270 = down). Convention approved 11/06/2026. */
  angle: number | NamedDirection;
  /** Value in newtons. Shown in the label as e.g. "weight 600 N" and used to
      scale arrow length. */
  magnitude?: number;
  /** Manual length override, 0.3–1.5 relative to the standard arrow length.
      Takes precedence over magnitude scaling. */
  relativeLength?: number;
}

interface FreeBodyDiagramParams {
  /** Default 'box'. */
  object?: 'box' | 'dot';
  /** Optional label inside/under the object, e.g. "car", "skydiver". */
  objectLabel?: string;
  forces: FreeBodyForce[];           // 1–6 forces
  /** FEEDBACK-ONLY LAYER: resultant force arrow, drawn dashed in brand red.
      Never rendered in question mode. */
  showResultant?: {
    angle: number | NamedDirection;
    label: string;                   // e.g. "resultant force 200 N"
    magnitude?: number;
  };
  /** When true, all arrows render at equal length regardless of magnitudes —
      for balanced-forces questions where lengths must visibly match. */
  balanced?: boolean;
}
```

### Arrow length rules (critical for AQA accuracy)
- If any force carries `magnitude`, lengths scale linearly with magnitude across
  the diagram (clamped to a 0.4–1.0 band of the maximum length so small forces
  stay visible). **Equal magnitudes therefore always render equal lengths.**
- Forces with neither `magnitude` nor `relativeLength` default to equal full length.
- `balanced: true` forces all arrows to equal length, overriding magnitudes.
- Arrowheads at the tip; label placed just beyond the tip, with collision nudging
  for near-vertical/near-horizontal pairs.

### Defaults & validation
- `forces` missing/empty/not an array → render null + warn.
- Unknown `angle` string → warn, skip that force.
- `magnitude` values render in labels as `${label} ${magnitude} N`.

### Examples

**A. Skydiver at terminal velocity (balanced — question-safe)**
```json
{
  "object": "dot",
  "objectLabel": "skydiver",
  "balanced": true,
  "forces": [
    { "label": "weight", "angle": "down", "magnitude": 700 },
    { "label": "air resistance", "angle": "up", "magnitude": 700 }
  ]
}
```

**B. Car accelerating (unbalanced horizontal forces)**
```json
{
  "object": "box",
  "objectLabel": "car",
  "forces": [
    { "label": "driving force", "angle": "right", "magnitude": 2000 },
    { "label": "friction", "angle": "left", "magnitude": 500 },
    { "label": "weight", "angle": "down", "magnitude": 12000, "relativeLength": 0.8 },
    { "label": "normal contact force", "angle": "up", "magnitude": 12000, "relativeLength": 0.8 }
  ]
}
```

**C. Worked solution with resultant (feedback layer)**
```json
{
  "object": "box",
  "forces": [
    { "label": "thrust", "angle": "up", "magnitude": 8000 },
    { "label": "weight", "angle": "down", "magnitude": 6000 }
  ],
  "showResultant": { "angle": "up", "label": "resultant force 2000 N", "magnitude": 2000 }
}
```

### Question-safe vs answer-revealing
- **Question-safe:** everything except `showResultant`.
- **Answer-revealing:** `showResultant` — rendered only when `mode === 'feedback'`.
- Registry: `questionSafe: true` (the mode gate handles the resultant).

---

## 4. `VectorDiagram` — registry key `vector-diagram`

**AQA Physics scale drawings + Edexcel column vectors.** Grid-based arrows.

### Schema

```ts
interface VectorSpec {
  /** Tail position in grid coordinates. Origin bottom-left, y increases UP
      (maths convention — matches column vector notation). */
  from: [number, number];
  dx: number;                        // grid units, positive = right
  dy: number;                        // grid units, positive = up
  /** Single bold letters render in Edexcel bold-vector style; free text allowed
      for physics (e.g. "40 N"). */
  label?: string;
  style?: 'solid' | 'dashed';        // default 'solid'
}

interface VectorDiagramParams {
  /** Default true. Square grid auto-sized to fit all vectors with 1-unit padding. */
  grid?: boolean;
  vectors: VectorSpec[];             // 1–4 vectors
  /** When true, vectors after the first are chained tip-to-tail automatically;
      their `from` values are ignored. */
  tipToTail?: boolean;
  /** FEEDBACK-ONLY LAYER: resultant from the tail of the first vector to the tip
      of the last, dashed, brand red, double-arrowhead omitted (single head). */
  showResultant?: boolean;
  /** Label for the resultant, e.g. "a + b" or "resultant 50 N". */
  resultantLabel?: string;
  /** Draw x/y axes through the origin (column-vector questions). Default false. */
  axes?: boolean;
}
```

### Defaults & validation
- `vectors` missing/empty → null + warn. `from`/`dx`/`dy` non-numeric → skip vector + warn.
- Grid bounds auto-computed; all coordinates clamped into a maximum 14×14 grid
  so one rogue value cannot produce an unreadable diagram.
- `showResultant` with fewer than 2 vectors → ignored with a warning.

### Examples

**A. Column vector addition (Edexcel — question shows the two vectors)**
```json
{
  "grid": true,
  "axes": false,
  "tipToTail": true,
  "vectors": [
    { "from": [1, 1], "dx": 3, "dy": 2, "label": "a" },
    { "from": [0, 0], "dx": 1, "dy": -4, "label": "b" }
  ]
}
```
*(Question: "Work out **a** + **b** as a column vector." Worked solution uses the
same params plus `"showResultant": true, "resultantLabel": "a + b"`.)*

**B. Physics scale drawing — perpendicular forces, worked solution**
```json
{
  "grid": true,
  "tipToTail": true,
  "vectors": [
    { "from": [1, 1], "dx": 8, "dy": 0, "label": "40 N" },
    { "from": [0, 0], "dx": 0, "dy": 6, "label": "30 N" }
  ],
  "showResultant": true,
  "resultantLabel": "resultant 50 N"
}
```

**C. Single column vector, with axes ("write down the column vector")**
```json
{
  "grid": true,
  "axes": true,
  "vectors": [
    { "from": [0, 0], "dx": 4, "dy": -3, "label": "v" }
  ]
}
```

### Question-safe vs answer-revealing
- **Question-safe:** vectors, grid, axes, tip-to-tail chaining.
- **Answer-revealing:** `showResultant` (+ `resultantLabel`) when the question asks
  for the resultant — rendered only when `mode === 'feedback'`.
- Registry: `questionSafe: true`.

---

## 5. `WaveDiagram` — registry key `wave-diagram`

**AQA Physics — Waves.** Transverse = smooth sine curve with horizontal axis.
Longitudinal = vertical line bands showing compressions and rarefactions.

### Schema

```ts
type WaveLabel =
  | 'amplitude'      // transverse only — bracket from axis to crest
  | 'wavelength'     // both — bracket spanning one full cycle
  | 'crest'          // transverse only
  | 'trough'         // transverse only
  | 'compression'    // longitudinal only
  | 'rarefaction';   // longitudinal only

interface WaveDiagramParams {
  type: 'transverse' | 'longitudinal';
  /** Number of full cycles. Default 3. Clamped 1–6. */
  cycles?: number;
  /** Relative amplitude 0.2–1.0 of the available half-height. Default 1.
      Transverse only. */
  amplitude?: number;
  /** Labels ALWAYS shown (question and feedback) — for learning content and for
      questions where the label is given, not asked for. */
  labels?: WaveLabel[];
  /** FEEDBACK-ONLY LAYER: labels shown only in worked solutions — use when the
      label IS the answer ("On the diagram, label the wavelength"). */
  answerLabels?: WaveLabel[];
  /** Axis captions, e.g. { "x": "Distance (m)", "y": "Displacement (cm)" }.
      Transverse only. Default: unlabelled plain axes. */
  axisLabels?: { x?: string; y?: string };
  /** Caption above the main wave, e.g. "Wave A" — for comparison questions. */
  mainWaveLabel?: string;
  /** Second wave drawn below the first, for comparison questions. */
  secondWave?: {
    amplitudeRatio?: number;    // relative to main wave amplitude, default 1
    wavelengthRatio?: number;   // relative to main wavelength, default 1
    /** Phase shift as a fraction of one wavelength (0–1), e.g. 0.5 = antiphase. */
    phaseShift?: number;
    label?: string;             // e.g. "Wave B"
  };
}
```

### Defaults & validation
- Labels invalid for the wave type (e.g. `crest` on longitudinal) → ignored + warn.
- `secondWave` on `longitudinal` → ignored + warn (comparison questions are
  transverse at GCSE; revisit if needed).
- Longitudinal rendering: vertical line bands with smoothly varying spacing;
  compression = tight band, rarefaction = sparse band, at least 2 of each across
  the default width.

### Examples

**A. "Label the amplitude and wavelength" (labels are the answer)**
```json
{
  "type": "transverse",
  "cycles": 3,
  "answerLabels": ["amplitude", "wavelength"]
}
```
*(Question mode: clean unlabelled wave. Feedback mode: brackets + labels appear.)*

**B. Longitudinal wave with given labels (learning content / "explain" questions)**
```json
{
  "type": "longitudinal",
  "cycles": 3,
  "labels": ["compression", "rarefaction", "wavelength"]
}
```

**C. Comparison: which wave has the higher frequency?**
```json
{
  "type": "transverse",
  "cycles": 2,
  "mainWaveLabel": "Wave A",
  "secondWave": { "wavelengthRatio": 0.5, "label": "Wave B" }
}
```

### Question-safe vs answer-revealing
- **Question-safe:** the wave itself, `labels`, `secondWave`, axis captions.
- **Answer-revealing:** `answerLabels` — rendered only when `mode === 'feedback'`.
  The generator decides which list a label belongs in based on what the question asks.
- Registry: `questionSafe: true`.

---

## 6. `Histogram` — registry key `histogram`

**Edexcel Higher Maths.** Frequency density on the y-axis, unequal class widths.
This is the Higher-tier histogram, not a bar chart: bar area = frequency.

### Schema

```ts
interface HistogramClass {
  from: number;
  to: number;
  frequencyDensity: number;
  /** "Complete the histogram" support: in question mode the interval renders
      with NO bar; in feedback mode the bar is drawn, highlighted in brand
      orange tint so the student sees which bar they had to draw. */
  hidden?: boolean;
}

interface HistogramParams {
  classes: HistogramClass[];         // 2–8 classes, contiguous or gapped
  /** x-axis caption, e.g. "Height (cm)". Required. */
  xLabel: string;
  /** Override the auto y-axis maximum. */
  yMax?: number;
  /** Override the auto y-axis tick increment. */
  yTickStep?: number;
}
```

### Axis rules (critical for Edexcel accuracy)
- y-axis is **always** captioned "Frequency density".
- Auto tick increments chosen from the 1–2–5 ladder (0.1, 0.2, 0.5, 1, 2, 5, 10 …)
  so gridlines land on round values; y-axis runs from 0 to the first round tick
  at or above the maximum frequency density.
- x-axis ticks at every class boundary, plus round intermediate values when
  classes are wide. Light horizontal gridlines to support read-offs.
- Bars: white fill, near-black stroke (exam style). Hidden-then-revealed bars:
  `#FDE9C8` fill with brand-orange stroke in feedback mode.

### Defaults & validation
- `classes` missing/empty, any `from >= to`, or negative frequency density →
  null + warn.
- Overlapping classes → null + warn (an AI-malformed histogram must not render misleadingly).

### Examples

**A. Read-off question (complete histogram shown)**
```json
{
  "xLabel": "Height (cm)",
  "classes": [
    { "from": 0,  "to": 10, "frequencyDensity": 0.4 },
    { "from": 10, "to": 15, "frequencyDensity": 2.4 },
    { "from": 15, "to": 25, "frequencyDensity": 3.2 },
    { "from": 25, "to": 40, "frequencyDensity": 1.2 }
  ]
}
```

**B. "Complete the histogram" (one class hidden; frequency table lives in the question text)**
```json
{
  "xLabel": "Time (minutes)",
  "classes": [
    { "from": 0,  "to": 20, "frequencyDensity": 0.8 },
    { "from": 20, "to": 30, "frequencyDensity": 3.0 },
    { "from": 30, "to": 35, "frequencyDensity": 4.8, "hidden": true },
    { "from": 35, "to": 50, "frequencyDensity": 1.6 }
  ]
}
```

**C. Speeds of cars (estimate-from-histogram question)**
```json
{
  "xLabel": "Speed (mph)",
  "yTickStep": 1,
  "classes": [
    { "from": 30, "to": 40, "frequencyDensity": 1.5 },
    { "from": 40, "to": 45, "frequencyDensity": 5.0 },
    { "from": 45, "to": 50, "frequencyDensity": 6.4 },
    { "from": 50, "to": 60, "frequencyDensity": 2.1 },
    { "from": 60, "to": 80, "frequencyDensity": 0.4 }
  ]
}
```

### Question-safe vs answer-revealing
- **Question-safe:** all bars without `hidden`; `hidden` intervals render empty in
  question mode (that partial histogram IS the question).
- **Answer-revealing:** the drawn-in hidden bars — rendered only when
  `mode === 'feedback'`.
- Registry: `questionSafe: true`.

---

## 7. `VectorGeometryDiagram` — registry key `vector-geometry-diagram`

**Edexcel Higher Maths — Vectors.** Triangle/parallelogram skeletons with labelled
position vectors. Vector labels render **bold** (Edexcel convention: **a**, **b**).

### Schema

```ts
interface VectorGeometryEdge {
  from: string;                      // point name, must exist in `points`
  to: string;
  /** Vector expression label. Rendering convention: standalone lowercase letters
      are bolded (Edexcel vector style); digits, fractions and operators render
      normal weight. Supports e.g. "a", "2b", "a + b", "1/2 b", "3a - b". */
  label?: string;
  /** Mid-edge arrowhead marking vector direction. Default true when `label` is
      present, false otherwise. */
  arrow?: boolean;
  dashed?: boolean;                  // default false
}

interface VectorGeometryParams {
  /** Named points in abstract coordinates (y increases UP). The component
      normalises and scales to fit — coordinates only need to be in proportion. */
  points: Record<string, [number, number]>;
  edges: VectorGeometryEdge[];
  /** Derived points on a segment between two named points. */
  midpoints?: Array<{
    on: [string, string];            // e.g. ["A", "B"]
    label: string;                   // e.g. "M"
    /** Position ratio from the first point, default [1, 1] (midpoint).
        [2, 1] places the point 2/3 of the way from A to B. */
    ratio?: [number, number];
    /** Render the ratio beside the segment, e.g. "2 : 1". Default false. */
    showRatio?: boolean;
  }>;
  /** FEEDBACK-ONLY LAYER: extra edges for worked solutions — the answer route,
      drawn dashed in brand red (e.g. the vector OM the question asked for).
      `from`/`to` may reference midpoint labels as well as points. */
  feedbackEdges?: VectorGeometryEdge[];
  /** Default true — render point name letters at vertices. */
  showPointLabels?: boolean;
}
```

### Defaults & validation
- `points` with fewer than 2 entries, or any edge referencing an unknown point →
  null + warn.
- `ratio` with non-positive parts → treated as midpoint + warn.
- Point labels nudged outward from the polygon's centroid to avoid sitting on edges.

### Examples

**A. Classic triangle OAB with midpoint ("find OM in terms of a and b")**
```json
{
  "points": { "O": [0, 0], "A": [2, 5], "B": [6, 0] },
  "edges": [
    { "from": "O", "to": "A", "label": "a" },
    { "from": "O", "to": "B", "label": "b" },
    { "from": "A", "to": "B" }
  ],
  "midpoints": [{ "on": ["A", "B"], "label": "M" }],
  "feedbackEdges": [{ "from": "O", "to": "M", "label": "1/2 a + 1/2 b", "dashed": true }]
}
```

**B. Parallelogram OACB**
```json
{
  "points": { "O": [0, 0], "A": [5, 0], "B": [1.5, 3], "C": [6.5, 3] },
  "edges": [
    { "from": "O", "to": "A", "label": "a" },
    { "from": "O", "to": "B", "label": "b" },
    { "from": "A", "to": "C" },
    { "from": "B", "to": "C" }
  ]
}
```

**C. Ratio point ("N divides AB in the ratio 2 : 1")**
```json
{
  "points": { "O": [0, 0], "A": [1, 4], "B": [6, 1] },
  "edges": [
    { "from": "O", "to": "A", "label": "a" },
    { "from": "O", "to": "B", "label": "b" },
    { "from": "A", "to": "B" }
  ],
  "midpoints": [
    { "on": ["A", "B"], "label": "N", "ratio": [2, 1], "showRatio": true }
  ]
}
```

### Question-safe vs answer-revealing
- **Question-safe:** points, edges, given vector labels, midpoints/ratio points —
  this skeleton is exactly what an Edexcel paper prints.
- **Answer-revealing:** `feedbackEdges` (the asked-for vector drawn and labelled) —
  rendered only when `mode === 'feedback'`. Generators must never put the
  asked-for vector's label on a normal edge.
- Registry: `questionSafe: true`.

---

## 8. `CircuitDiagram` — registry key `circuit-diagram`

**AQA Physics — Electricity.** The hardest component; built in its own phase
(Phase 5) starting with the symbol sub-library. Symbols must match the AQA GCSE
spec symbol sheet exactly — **John signs off every symbol before layout work begins.**

### Topology — deliberately constrained
Supported topologies, and nothing else:
1. A single series loop.
2. A series loop with **one parallel section of up to 3 branches**, each branch
   containing up to 3 components in series. The parallel section sits in the main
   loop after the series components.

Arbitrary circuit topology is out of scope permanently — this constrained model
covers the overwhelming majority of GCSE circuit questions.

### Schema

```ts
type CircuitComponentType =
  | 'cell' | 'battery'
  | 'switch-open' | 'switch-closed'
  | 'lamp' | 'fuse'
  | 'resistor' | 'variable-resistor'
  | 'thermistor' | 'ldr'
  | 'diode' | 'led';

interface ComponentSpec {
  type: CircuitComponentType;
  /** Unique within the diagram. Used as the target of voltmeter `across`. */
  id: string;
  /** Rendered beside the symbol, e.g. "R₁ = 4 Ω", "6 V". If a value is the
      answer to the question, omit it here and state it in the worked solution
      text instead — the diagram stays identical in both modes. */
  label?: string;
}

interface CircuitMeterSpec {
  type: 'ammeter' | 'voltmeter';
  /** e.g. "A₁" or a given reading "2 A". Same rule as component labels:
      answer values do not belong in the diagram. */
  label?: string;
  /** Ammeters: 'main' (in the main loop) or { branch: n } (in line, 0-indexed
      branch). Voltmeters: { across: componentId } only — rendered in parallel
      across that component. */
  position: 'main' | { branch: number } | { across: string };
}

interface CircuitDiagramParams {
  supply: { type: 'cell' | 'battery'; label?: string };  // e.g. "6 V"
  /** Components in the main loop, in order, after the supply. May be empty
      when everything is in the parallel section. */
  series: ComponentSpec[];
  /** 1–3 branches, each 1–3 components. Omit for a pure series circuit. */
  parallelBranches?: ComponentSpec[][];
  meters?: CircuitMeterSpec[];
}
```

### Rendering rules
- Each AQA symbol implemented as a small pure SVG function on a consistent grid
  unit (symbol sub-library, signed off in the gallery before any layout code).
- Wires: straight lines, right angles only, near-black.
- Voltmeters: circle-V drawn in parallel across the target component with
  right-angled connecting wires. Ammeters: circle-A in line.
- Conventional layout: supply at the top of the loop, series components along the
  sides/bottom, parallel section as stacked horizontal branches.

### Defaults & validation
- Missing/invalid `supply`, duplicate `id`s, voltmeter `across` referencing an
  unknown id, `branch` index out of range, more than 3 branches or more than 3
  components per branch → null + warn.
- Unknown component `type` → null + warn (never guess a symbol).

### Examples

**A. Series circuit with meters (Ohm's law practical)**
```json
{
  "supply": { "type": "battery", "label": "6 V" },
  "series": [
    { "type": "switch-closed", "id": "s1" },
    { "type": "resistor", "id": "r1", "label": "R" }
  ],
  "meters": [
    { "type": "ammeter", "label": "A", "position": "main" },
    { "type": "voltmeter", "label": "V", "position": { "across": "r1" } }
  ]
}
```

**B. Two lamps in parallel ("compare the brightness / currents")**
```json
{
  "supply": { "type": "cell", "label": "1.5 V" },
  "series": [
    { "type": "switch-open", "id": "s1" }
  ],
  "parallelBranches": [
    [ { "type": "lamp", "id": "l1" } ],
    [ { "type": "lamp", "id": "l2" } ]
  ],
  "meters": [
    { "type": "ammeter", "label": "A₁", "position": "main" },
    { "type": "ammeter", "label": "A₂", "position": { "branch": 0 } }
  ]
}
```

**C. Thermistor sensing circuit (potential divider)**
```json
{
  "supply": { "type": "battery", "label": "12 V" },
  "series": [
    { "type": "thermistor", "id": "t1" },
    { "type": "resistor", "id": "r1", "label": "R" }
  ],
  "meters": [
    { "type": "voltmeter", "label": "V", "position": { "across": "r1" } }
  ]
}
```

### Question-safe vs answer-revealing
- **Question-safe:** the entire diagram. Circuit diagrams show the setup, never
  the answer — answer values (readings, calculated resistances) are stated in
  question/solution **text**, not in the diagram.
- **Answer-revealing:** nothing, by construction. There is no feedback-only layer.
- Registry: `questionSafe: true`.

---

## 9. Registry summary

| Registry key | Component | Subject | questionSafe | Feedback-only layer |
|---|---|---|---|---|
| `free-body-diagram` | FreeBodyDiagram | AQA Physics — Forces | `true` | `showResultant` |
| `vector-diagram` | VectorDiagram | AQA Physics / Edexcel Maths | `true` | `showResultant` |
| `wave-diagram` | WaveDiagram | AQA Physics — Waves | `true` | `answerLabels` |
| `histogram` | Histogram | Edexcel Higher Maths | `true` | drawn-in `hidden` bars |
| `vector-geometry-diagram` | VectorGeometryDiagram | Edexcel Higher Maths | `true` | `feedbackEdges` |
| `circuit-diagram` | CircuitDiagram | AQA Physics — Electricity | `true` | none |

---

## 10. Resolved decisions (John, 11/06/2026)

- **Q1 — Label font:** Helvetica Neue for all new components. Existing four keep
  Georgia for now.
- **Q2 — `mode` prop:** approved as specified in Section 2.
- **Q3 — FreeBodyDiagram:** angle convention is degrees anticlockwise from "right"
  (0° = right, 90° = up); `balanced: true` renders all arrows at equal length
  regardless of magnitudes.
- **Q4 — `parabola-vertex-graph`:** `questionSafe: false`, applied in Phase 3.
- **Q5 — Wave `phaseShift`:** fraction of one wavelength (0.5 = antiphase).
