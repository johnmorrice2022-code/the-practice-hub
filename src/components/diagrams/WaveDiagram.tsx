// WaveDiagram.tsx
// AQA Physics wave diagrams: transverse (smooth sine curve with axis) and
// longitudinal (vertical line bands showing compressions and rarefactions).
//
// Schema and conventions: DIAGRAMS.md Section 5.
// - `labels` are always shown (learning content, or labels given in the
//   question); `answerLabels` only render in feedback mode — used when the
//   label IS the answer ("On the diagram, label the wavelength").
// - `secondWave` draws a comparison wave below the first (transverse only).
//   `phaseShift` is a fraction of one wavelength (0.5 = antiphase).

export type WaveLabel =
  | 'amplitude'
  | 'wavelength'
  | 'crest'
  | 'trough'
  | 'compression'
  | 'rarefaction';

// AQA "which arrow shows the…" question type: lettered measurement arrows
// (some correct, some distractors) drawn on the wave. The letters reveal
// nothing on their own — the answer (which letter = amplitude) lives in the
// mark scheme — so markers are question-safe and render in BOTH modes.
export type WaveMarkerFeature =
  // Transverse features
  | 'wavelength' // horizontal double-arrow, one full cycle (crest→crest / compression→compression)
  | 'half-wavelength' // horizontal double-arrow, crest→trough (½ cycle) — distractor (transverse)
  | 'amplitude' // vertical double-arrow, axis→crest (transverse)
  | 'peak-to-trough' // vertical double-arrow, crest→trough (2×amplitude) — distractor (transverse)
  | 'point' // single up-arrow at the equilibrium axis (transverse; Point P / Point Q)
  // Longitudinal features
  | 'compression' // arrow pointing at a tight (bunched) band
  | 'rarefaction'; // arrow pointing at a sparse (spread) band

export interface WaveMarker {
  /** Letter (or short caption) drawn at the arrow, e.g. 'A', 'B', 'Point P'. */
  label: string;
  feature: WaveMarkerFeature;
  /** Which cycle the marker sits on (0-based). Defaults spread markers out;
      clamped to the visible range. Ignored for 'point'. */
  cycle?: number;
}

export interface WaveDiagramParams {
  type: 'transverse' | 'longitudinal';
  cycles?: number; // default 3, clamped 1–6
  amplitude?: number; // relative 0.2–1, default 1 (transverse only)
  labels?: WaveLabel[];
  answerLabels?: WaveLabel[]; // feedback-only
  markers?: WaveMarker[]; // transverse only; lettered measurement arrows
  axisLabels?: { x?: string; y?: string }; // transverse only
  mainWaveLabel?: string;
  secondWave?: {
    amplitudeRatio?: number; // default 1
    wavelengthRatio?: number; // default 1
    phaseShift?: number; // fraction of one wavelength, 0–1
    label?: string;
  };
}

const W = 380;
const PLOT_R = 364;
const MAX_AMP = 42;

const STROKE = '#1C1917';
const AXIS_COLOR = '#78716C';
const LABEL_COLOR = '#1C1917';
const POINTER_COLOR = '#78716C';

const FONT = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: '12.5',
  fontWeight: 600 as const,
  fill: LABEL_COLOR,
};

const MARKER_FONT = {
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: '13',
  fontWeight: 700 as const,
  fill: LABEL_COLOR,
};

const TRANSVERSE_LABELS: WaveLabel[] = ['amplitude', 'wavelength', 'crest', 'trough'];
const LONGITUDINAL_LABELS: WaveLabel[] = ['compression', 'rarefaction', 'wavelength'];
const TRANSVERSE_MARKER_FEATURES: WaveMarkerFeature[] = [
  'wavelength',
  'half-wavelength',
  'amplitude',
  'peak-to-trough',
  'point',
];
const LONGITUDINAL_MARKER_FEATURES: WaveMarkerFeature[] = [
  'wavelength',
  'half-wavelength',
  'compression',
  'rarefaction',
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function f(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Arrowhead polygon with tip at (x, y) pointing along (ux, uy). */
function head(x: number, y: number, ux: number, uy: number): string {
  const bx = x - ux * 8;
  const by = y - uy * 8;
  const px = -uy;
  const py = ux;
  return [
    `${f(x)},${f(y)}`,
    `${f(bx + px * 3.8)},${f(by + py * 3.8)}`,
    `${f(bx - px * 3.8)},${f(by - py * 3.8)}`,
  ].join(' ');
}

/** Double-headed measurement arrow between two points. */
function DoubleArrow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 2) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  return (
    <g>
      <line
        x1={f(x1 + ux * 8)}
        y1={f(y1 + uy * 8)}
        x2={f(x2 - ux * 8)}
        y2={f(y2 - uy * 8)}
        stroke={POINTER_COLOR}
        strokeWidth="1.4"
      />
      <polygon points={head(x1, y1, -ux, -uy)} fill={POINTER_COLOR} />
      <polygon points={head(x2, y2, ux, uy)} fill={POINTER_COLOR} />
    </g>
  );
}

export function WaveDiagram({
  params,
  mode = 'question',
}: {
  params: WaveDiagramParams;
  mode?: 'question' | 'feedback';
}) {
  if (!params || (params.type !== 'transverse' && params.type !== 'longitudinal')) {
    console.warn('[WaveDiagram] invalid params', params);
    return null;
  }

  const isTransverse = params.type === 'transverse';
  const allowed = isTransverse ? TRANSVERSE_LABELS : LONGITUDINAL_LABELS;

  const collect = (list: unknown): WaveLabel[] => {
    if (!Array.isArray(list)) return [];
    return list.filter((l): l is WaveLabel => {
      if (allowed.includes(l as WaveLabel)) return true;
      console.warn(`[WaveDiagram] ignoring label "${l}" — not valid for ${params.type}`);
      return false;
    });
  };

  const shown = new Set<WaveLabel>([
    ...collect(params.labels),
    ...(mode === 'feedback' ? collect(params.answerLabels) : []),
  ]);

  // Lettered measurement arrows (AQA "which arrow shows…" questions).
  // Valid for both wave types; always rendered (the letter reveals no answer).
  const allowedMarkerFeatures = isTransverse
    ? TRANSVERSE_MARKER_FEATURES
    : LONGITUDINAL_MARKER_FEATURES;
  const markerList: WaveMarker[] = (() => {
    if (!Array.isArray(params.markers) || params.markers.length === 0) return [];
    return params.markers.filter((m): m is WaveMarker => {
      if (!m || typeof m.label !== 'string') {
        console.warn('[WaveDiagram] ignoring invalid marker', m);
        return false;
      }
      if (!allowedMarkerFeatures.includes(m.feature as WaveMarkerFeature)) {
        console.warn(
          `[WaveDiagram] ignoring marker "${m.label}" — feature "${m.feature}" not valid for ${params.type}`
        );
        return false;
      }
      return true;
    });
  })();
  const hasMarkers = markerList.length > 0;

  let cycles = clamp(
    typeof params.cycles === 'number' && Number.isFinite(params.cycles)
      ? Math.round(params.cycles)
      : 3,
    1,
    6
  );
  // Crest-to-crest / compression-to-compression brackets need 2 full cycles.
  if (shown.has('wavelength') && cycles < 2) cycles = 2;
  // A wavelength marker spans crest→crest, so it also needs 2 cycles.
  if (hasMarkers && markerList.some((m) => m.feature === 'wavelength') && cycles < 2) {
    cycles = 2;
  }

  const secondWave = isTransverse ? params.secondWave : undefined;
  if (params.secondWave && !isTransverse) {
    console.warn('[WaveDiagram] secondWave ignored for longitudinal waves');
  }

  // Reserve a left annotation column when the amplitude measurement is shown:
  // the arrow + "amplitude" text live entirely in this margin (connected to
  // the first crest by a dashed guide line) so they never cross the curve.
  let plotL = 26;
  if (isTransverse && params.axisLabels?.y) plotL = 54;
  if (isTransverse && shown.has('amplitude')) plotL = Math.max(plotL, 92);
  const plotW = PLOT_R - plotL;
  const lam = plotW / cycles;

  // ── Transverse rendering ──────────────────────────────────────────────────

  const renderTransverse = (
    midY: number,
    ampPx: number,
    lamPx: number,
    phasePx: number,
    caption: string | undefined,
    withLabels: boolean
  ) => {
    const samples = Math.max(60, Math.round(plotW / 3));
    const path = Array.from({ length: samples + 1 }, (_, i) => {
      const x = plotL + (i / samples) * plotW;
      const y = midY - ampPx * Math.sin((2 * Math.PI * (x - plotL - phasePx)) / lamPx);
      return `${i === 0 ? 'M' : 'L'} ${f(x)} ${f(y)}`;
    }).join(' ');

    const crestX = (k: number) => plotL + phasePx + lamPx / 4 + k * lamPx;
    const troughX = (k: number) => plotL + phasePx + (3 * lamPx) / 4 + k * lamPx;
    const lastVisible = (xOf: (k: number) => number) => {
      let k = 0;
      while (xOf(k + 1) < PLOT_R - 6) k++;
      return xOf(k);
    };

    return (
      <g>
        {caption && (
          <text {...FONT} x={plotL} y={midY - ampPx - 26} textAnchor="start">
            {caption}
          </text>
        )}

        {/* equilibrium axis */}
        <line
          x1={plotL}
          y1={f(midY)}
          x2={PLOT_R}
          y2={f(midY)}
          stroke={AXIS_COLOR}
          strokeWidth="1.2"
        />

        {/* curve */}
        <path d={path} fill="none" stroke={STROKE} strokeWidth="2" />

        {withLabels && shown.has('amplitude') && (
          <g>
            {/* dashed guides from the first crest / axis into the margin */}
            <line
              x1={f(crestX(0))}
              y1={f(midY - ampPx)}
              x2={f(plotL - 18)}
              y2={f(midY - ampPx)}
              stroke={POINTER_COLOR}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <line
              x1={f(plotL)}
              y1={f(midY)}
              x2={f(plotL - 18)}
              y2={f(midY)}
              stroke={POINTER_COLOR}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <DoubleArrow
              x1={plotL - 18}
              y1={midY}
              x2={plotL - 18}
              y2={midY - ampPx}
            />
            <text
              {...FONT}
              x={f(plotL - 26)}
              y={f(midY - ampPx / 2 + 4)}
              textAnchor="end"
            >
              amplitude
            </text>
          </g>
        )}

        {withLabels && shown.has('wavelength') && (
          <g>
            <line
              x1={f(crestX(0))}
              y1={f(midY - ampPx)}
              x2={f(crestX(0))}
              y2={f(midY - ampPx - 16)}
              stroke={POINTER_COLOR}
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <line
              x1={f(crestX(1))}
              y1={f(midY - ampPx)}
              x2={f(crestX(1))}
              y2={f(midY - ampPx - 16)}
              stroke={POINTER_COLOR}
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <DoubleArrow
              x1={crestX(0)}
              y1={midY - ampPx - 12}
              x2={crestX(1)}
              y2={midY - ampPx - 12}
            />
            <text
              {...FONT}
              x={f((crestX(0) + crestX(1)) / 2)}
              y={f(midY - ampPx - 18)}
              textAnchor="middle"
            >
              wavelength
            </text>
          </g>
        )}

        {withLabels && shown.has('crest') && (
          <text
            {...FONT}
            x={f(lastVisible(crestX))}
            y={f(midY - ampPx - 8)}
            textAnchor="middle"
          >
            crest
          </text>
        )}

        {withLabels && shown.has('trough') && (
          <text
            {...FONT}
            x={f(lastVisible(troughX))}
            y={f(midY + ampPx + 16)}
            textAnchor="middle"
          >
            trough
          </text>
        )}

        {/* Lettered measurement arrows (AQA "which arrow shows…" questions) */}
        {withLabels &&
          markerList.length > 0 &&
          (() => {
            const descZeroX = (k: number) =>
              plotL + phasePx + lamPx / 2 + k * lamPx;
            const maxCrestK = Math.max(0, cycles - 1);
            const clampK = (k: number, max: number) =>
              Math.min(max, Math.max(0, Math.round(k)));
            const pointXs: number[] = (() => {
              const n = markerList.filter((m) => m.feature === 'point').length;
              if (n <= 1) return [plotL + (PLOT_R - plotL) / 2];
              return [plotL + 4, PLOT_R - 4];
            })();
            let pi = 0;

            return markerList.map((m, i) => {
              switch (m.feature) {
                case 'wavelength': {
                  const k = clampK(m.cycle ?? 0, Math.max(0, cycles - 2));
                  const x1 = crestX(k);
                  const x2 = crestX(k + 1);
                  const y = midY - ampPx - 14;
                  return (
                    <g key={`mk-${i}`}>
                      <DoubleArrow x1={x1} y1={y} x2={x2} y2={y} />
                      <text
                        {...MARKER_FONT}
                        x={f((x1 + x2) / 2)}
                        y={f(y - 6)}
                        textAnchor="middle"
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                case 'half-wavelength': {
                  const k = clampK(m.cycle ?? maxCrestK, maxCrestK);
                  const x1 = crestX(k);
                  const x2 = troughX(k);
                  const y = midY - ampPx - 14;
                  return (
                    <g key={`mk-${i}`}>
                      <DoubleArrow x1={x1} y1={y} x2={x2} y2={y} />
                      <text
                        {...MARKER_FONT}
                        x={f((x1 + x2) / 2)}
                        y={f(y - 6)}
                        textAnchor="middle"
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                case 'amplitude': {
                  const k = clampK(m.cycle ?? 0, maxCrestK);
                  const x = crestX(k);
                  return (
                    <g key={`mk-${i}`}>
                      <DoubleArrow x1={x} y1={midY} x2={x} y2={midY - ampPx} />
                      {/* Sit in the open pocket just right of the arrow, below
                          the descending curve and clear of the axis. */}
                      <text
                        {...MARKER_FONT}
                        x={f(x + 10)}
                        y={f(midY - ampPx * 0.34)}
                        textAnchor="start"
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                case 'peak-to-trough': {
                  const k = clampK(m.cycle ?? 0, maxCrestK);
                  const x = descZeroX(k);
                  return (
                    <g key={`mk-${i}`}>
                      <DoubleArrow
                        x1={x}
                        y1={midY - ampPx}
                        x2={x}
                        y2={midY + ampPx}
                      />
                      {/* Upper arm, right of the arrow: the curve descends to
                          the right here, so this pocket is clear. */}
                      <text
                        {...MARKER_FONT}
                        x={f(x + 10)}
                        y={f(midY - ampPx * 0.34)}
                        textAnchor="start"
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                case 'point': {
                  const x = pointXs[Math.min(pi, pointXs.length - 1)];
                  pi++;
                  const anchor = x < W / 2 ? 'start' : 'end';
                  const tx = x < W / 2 ? x - 3 : x + 3;
                  return (
                    <g key={`mk-${i}`}>
                      {/* Short up-arrow to the axis; caption dropped below the
                          trough line so it never overlaps the curve. */}
                      <line
                        x1={f(x)}
                        y1={f(midY + ampPx * 0.5)}
                        x2={f(x)}
                        y2={f(midY + 6)}
                        stroke={POINTER_COLOR}
                        strokeWidth="1.4"
                      />
                      <polygon points={head(x, midY, 0, -1)} fill={STROKE} />
                      <text
                        {...MARKER_FONT}
                        x={f(tx)}
                        y={f(midY + ampPx + 16)}
                        textAnchor={anchor}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                default:
                  return null;
              }
            });
          })()}
      </g>
    );
  };

  // ── Longitudinal rendering ────────────────────────────────────────────────

  const renderLongitudinal = (topY: number, bandH: number) => {
    const linesPerCycle = 12;
    const count = cycles * linesPerCycle;
    const shift = lam * 0.14;
    const lines: number[] = [];
    for (let i = 0; i <= count; i++) {
      const x0 = (i / count) * plotW;
      const x = plotL + x0 + shift * Math.sin((2 * Math.PI * x0) / lam);
      lines.push(x);
    }
    // Particles bunch at x = λ/2 + kλ (compressions); spread at x = kλ.
    const compressionX = (k: number) => plotL + lam / 2 + k * lam;
    const rarefactionX = (k: number) => plotL + lam * (k + 1);
    // Label the FIRST compression but a LATER rarefaction so the two text
    // labels are far apart and can never collide.
    const rarefactionK = Math.max(0, cycles - 2);
    const bottom = topY + bandH;

    return (
      <g>
        {lines.map((x, i) => (
          <line
            key={i}
            x1={f(x)}
            y1={f(topY)}
            x2={f(x)}
            y2={f(bottom)}
            stroke={STROKE}
            strokeWidth="1.5"
          />
        ))}

        {shown.has('wavelength') && (
          <g>
            <DoubleArrow
              x1={compressionX(0)}
              y1={topY - 14}
              x2={compressionX(1)}
              y2={topY - 14}
            />
            <text
              {...FONT}
              x={f((compressionX(0) + compressionX(1)) / 2)}
              y={f(topY - 20)}
              textAnchor="middle"
            >
              wavelength
            </text>
          </g>
        )}

        {shown.has('compression') && (
          <g>
            <line
              x1={f(compressionX(0))}
              y1={f(bottom + 4)}
              x2={f(compressionX(0))}
              y2={f(bottom + 18)}
              stroke={POINTER_COLOR}
              strokeWidth="1.2"
            />
            <text {...FONT} x={f(compressionX(0))} y={f(bottom + 32)} textAnchor="middle">
              compression
            </text>
          </g>
        )}

        {shown.has('rarefaction') && (
          <g>
            <line
              x1={f(rarefactionX(rarefactionK))}
              y1={f(bottom + 4)}
              x2={f(rarefactionX(rarefactionK))}
              y2={f(bottom + 18)}
              stroke={POINTER_COLOR}
              strokeWidth="1.2"
            />
            <text
              {...FONT}
              x={f(rarefactionX(rarefactionK))}
              y={f(bottom + 32)}
              textAnchor="middle"
            >
              rarefaction
            </text>
          </g>
        )}

        {/* Lettered SECTION brackets (AQA "which section shows the
            compression / rarefaction / wavelength?" questions). Each marker is
            a horizontal bracket over a region of the wave with end-guides down
            to the band, and the letter above. The student reads the band
            density under the bracket to identify the part. */}
        {markerList.length > 0 &&
          (() => {
            const clampK = (k: number, max: number) =>
              Math.min(max, Math.max(0, Math.round(k)));
            const maxCompK = Math.max(0, cycles - 1);
            const maxRareK = Math.max(0, cycles - 2);
            const bracketY = topY - 16;
            // Half-width of a compression / rarefaction section bracket.
            const sectionHW = lam * 0.2;

            const sectionBracket = (
              x1: number,
              x2: number,
              label: string,
              key: string
            ) => {
              const lo = Math.max(plotL + 1, Math.min(x1, x2));
              const hi = Math.min(PLOT_R - 1, Math.max(x1, x2));
              return (
                <g key={key}>
                  {/* end guides from the bracket down to the band top */}
                  <line
                    x1={f(lo)}
                    y1={f(bracketY)}
                    x2={f(lo)}
                    y2={f(topY - 2)}
                    stroke={POINTER_COLOR}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={f(hi)}
                    y1={f(bracketY)}
                    x2={f(hi)}
                    y2={f(topY - 2)}
                    stroke={POINTER_COLOR}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <DoubleArrow x1={lo} y1={bracketY} x2={hi} y2={bracketY} />
                  <text
                    {...MARKER_FONT}
                    x={f((lo + hi) / 2)}
                    y={f(bracketY - 6)}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              );
            };

            return markerList.map((m, i) => {
              const key = `lmk-${i}`;
              switch (m.feature) {
                case 'compression': {
                  const c = compressionX(clampK(m.cycle ?? 0, maxCompK));
                  return sectionBracket(c - sectionHW, c + sectionHW, m.label, key);
                }
                case 'rarefaction': {
                  const c = rarefactionX(clampK(m.cycle ?? 0, maxRareK));
                  return sectionBracket(c - sectionHW, c + sectionHW, m.label, key);
                }
                case 'wavelength': {
                  const k = clampK(m.cycle ?? 0, Math.max(0, cycles - 2));
                  return sectionBracket(
                    compressionX(k),
                    compressionX(k + 1),
                    m.label,
                    key
                  );
                }
                case 'half-wavelength': {
                  const k = clampK(m.cycle ?? 0, maxCompK);
                  const x1 = compressionX(k);
                  return sectionBracket(x1, x1 + lam / 2, m.label, key);
                }
                default:
                  return null;
              }
            });
          })()}
      </g>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  const ampRel = clamp(
    typeof params.amplitude === 'number' ? params.amplitude : 1,
    0.2,
    1
  );
  const ampPx = ampRel * MAX_AMP;

  const blockH = isTransverse ? 2 * MAX_AMP + 64 : 150;
  const waveCount = isTransverse && secondWave ? 2 : 1;
  const xCaptionH = isTransverse && params.axisLabels?.x ? 22 : 0;
  // Transverse markers need headroom above (horizontal arrows + letters) and
  // below (Point P/Q arrows + captions). Longitudinal draws section brackets in
  // the existing space above the bands, so it needs no extra padding.
  const markerTopPad = hasMarkers && isTransverse ? 20 : 0;
  const markerBotPad = hasMarkers && isTransverse ? 30 : 0;
  const H =
    blockH * waveCount + xCaptionH + 8 + markerTopPad + markerBotPad;

  // Second wave geometry
  const amp2 = secondWave
    ? clamp(ampRel * clamp(secondWave.amplitudeRatio ?? 1, 0.2, 1.5), 0.15, 1) * MAX_AMP
    : 0;
  const lam2 = secondWave ? lam * clamp(secondWave.wavelengthRatio ?? 1, 0.25, 3) : lam;
  const phase2 = secondWave ? clamp(secondWave.phaseShift ?? 0, 0, 1) * lam2 : 0;

  const mid1 = blockH / 2 + 14 + markerTopPad;
  const mid2 = blockH + blockH / 2 + 14 + markerTopPad;

  const labelList = Array.from(shown);
  const markerDesc = hasMarkers
    ? `; lettered measurement arrows: ${markerList
        .map((m) => `${m.label} (${m.feature})`)
        .join(', ')}`
    : '';
  const desc = isTransverse
    ? `Transverse wave with ${cycles} cycles` +
      (labelList.length ? `, labelled: ${labelList.join(', ')}` : '') +
      markerDesc +
      (secondWave
        ? `; second wave for comparison${secondWave.label ? ` (${secondWave.label})` : ''}`
        : '') +
      '.'
    : `Longitudinal wave with ${cycles} cycles shown as vertical line bands` +
      (labelList.length ? `, labelled: ${labelList.join(', ')}` : '') +
      '.';

  return (
    <div className="flex justify-center py-4 px-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 400 }}
      >
        <svg
          viewBox={`0 0 ${W} ${f(H)}`}
          width="100%"
          style={{ maxWidth: 360, display: 'block', margin: '0 auto' }}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>{isTransverse ? 'Transverse wave diagram' : 'Longitudinal wave diagram'}</title>
          <desc>{desc}</desc>

          {isTransverse ? (
            <g>
              {/* y-axis */}
              {params.axisLabels?.y && (
                <g>
                  <line
                    x1={plotL}
                    y1={f(mid1 - ampPx - 8)}
                    x2={plotL}
                    y2={f(mid1 + ampPx + 8)}
                    stroke={AXIS_COLOR}
                    strokeWidth="1.2"
                  />
                  <text
                    {...FONT}
                    fontSize="11"
                    fontWeight={400}
                    fill={AXIS_COLOR}
                    textAnchor="middle"
                    transform={`rotate(-90 ${plotL - 10} ${f(mid1)})`}
                    x={plotL - 10}
                    y={f(mid1)}
                  >
                    {params.axisLabels.y}
                  </text>
                </g>
              )}

              {renderTransverse(mid1, ampPx, lam, 0, params.mainWaveLabel, true)}
              {secondWave &&
                renderTransverse(mid2, amp2, lam2, phase2, secondWave.label, false)}

              {params.axisLabels?.x && (
                <text
                  {...FONT}
                  fontSize="11"
                  fontWeight={400}
                  fill={AXIS_COLOR}
                  x={f((plotL + PLOT_R) / 2)}
                  y={f(H - 6)}
                  textAnchor="middle"
                >
                  {params.axisLabels.x}
                </text>
              )}
            </g>
          ) : (
            renderLongitudinal(44, 80)
          )}
        </svg>
      </div>
    </div>
  );
}
