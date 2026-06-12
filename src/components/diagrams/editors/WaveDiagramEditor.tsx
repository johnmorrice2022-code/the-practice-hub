// WaveDiagramEditor.tsx
//
// Touch-first structured editor for wave-diagram params, used by the Seeded
// Question Composer. Builds a WaveDiagramParams object from form controls —
// no JSON anywhere. Exposes the schema as built (DIAGRAMS.md §5): wave type,
// cycles, amplitude, second-wave comparison, the longitudinal energy arrow,
// and the lettered MARKERS that make "Which arrow/section shows…?" questions
// answerable by a letter.

import { Plus, Trash2, Wand2 } from 'lucide-react';
import type {
  WaveDiagramParams,
  WaveMarker,
  WaveMarkerFeature,
} from '../WaveDiagram';

export interface DiagramEditorProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

// Feature options per wave type, with teacher-friendly labels.
const TRANSVERSE_FEATURES: { value: WaveMarkerFeature; label: string }[] = [
  { value: 'amplitude', label: 'Amplitude (axis → crest)' },
  { value: 'wavelength', label: 'Wavelength (crest → crest)' },
  { value: 'peak-to-trough', label: 'Peak-to-trough (distractor)' },
  { value: 'half-wavelength', label: 'Half-wavelength (distractor)' },
  { value: 'point', label: 'Point on the axis (e.g. Point P)' },
];

const LONGITUDINAL_FEATURES: { value: WaveMarkerFeature; label: string }[] = [
  { value: 'compression', label: 'Compression (bunched section)' },
  { value: 'rarefaction', label: 'Rarefaction (sparse section)' },
  { value: 'wavelength', label: 'Wavelength (one full cycle)' },
];

// Canonical AQA marker sets, one tap to populate.
const TRANSVERSE_AQA_SET: WaveMarker[] = [
  { label: 'A', feature: 'wavelength', cycle: 0 },
  { label: 'B', feature: 'amplitude', cycle: 1 },
  { label: 'C', feature: 'peak-to-trough', cycle: 1 },
  { label: 'D', feature: 'half-wavelength', cycle: 2 },
  { label: 'Point P', feature: 'point' },
  { label: 'Point Q', feature: 'point' },
];

const LONGITUDINAL_AQA_SET: WaveMarker[] = [
  { label: 'A', feature: 'compression', cycle: 0 },
  { label: 'B', feature: 'rarefaction', cycle: 0 },
  { label: 'C', feature: 'wavelength', cycle: 2 },
];

// ─── Small touch controls ─────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round = (v: number) => Math.round(v / step) * step;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(round(value - step)))}
        className="w-11 h-11 rounded-lg border border-gray-200 bg-white text-xl text-gray-600 active:bg-gray-100 disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="w-14 text-center text-sm font-semibold tabular-nums">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(round(value + step)))}
        className="w-11 h-11 rounded-lg border border-gray-200 bg-white text-xl text-gray-600 active:bg-gray-100 disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center gap-2.5 select-none"
    >
      <span
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: on ? '#F5A623' : '#d1d5db' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
          style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-gray-600">{label}</span>
      {children}
    </div>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export function WaveDiagramEditor({ params, onChange }: DiagramEditorProps) {
  const p = params as WaveDiagramParams;
  const type = p.type === 'longitudinal' ? 'longitudinal' : 'transverse';
  const isTransverse = type === 'transverse';
  const markers: WaveMarker[] = Array.isArray(p.markers) ? p.markers : [];
  const features = isTransverse ? TRANSVERSE_FEATURES : LONGITUDINAL_FEATURES;

  const update = (patch: Partial<WaveDiagramParams>) =>
    onChange({ ...p, ...patch } as Record<string, unknown>);

  const setMarkers = (m: WaveMarker[]) => update({ markers: m });

  const switchType = (next: 'transverse' | 'longitudinal') => {
    if (next === type) return;
    // Features differ by type, so clear type-specific fields on switch.
    onChange({
      type: next,
      cycles: p.cycles ?? (next === 'longitudinal' ? 4 : 3),
      ...(next === 'longitudinal' ? { energyArrow: true } : {}),
    });
  };

  const addMarker = () => {
    const nextLetter = String.fromCharCode(65 + markers.filter((m) => m.feature !== 'point').length);
    setMarkers([
      ...markers,
      { label: nextLetter, feature: features[0].value, cycle: 0 },
    ]);
  };

  const updateMarker = (i: number, patch: Partial<WaveMarker>) =>
    setMarkers(markers.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const removeMarker = (i: number) =>
    setMarkers(markers.filter((_, j) => j !== i));

  return (
    <div className="space-y-5">
      {/* Wave type */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Wave type
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['transverse', 'longitudinal'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className="h-11 rounded-lg text-sm font-medium border capitalize transition-colors"
              style={
                type === t
                  ? { background: '#F5A623', color: 'white', borderColor: '#F5A623' }
                  : { background: 'white', color: '#6b7280', borderColor: 'rgba(0,0,0,0.1)' }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Geometry */}
      <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 divide-y divide-gray-100">
        <Field label="Number of waves (cycles)">
          <Stepper
            value={typeof p.cycles === 'number' ? p.cycles : isTransverse ? 3 : 4}
            onChange={(v) => update({ cycles: v })}
            min={1}
            max={6}
          />
        </Field>
        {isTransverse && (
          <Field label="Wave height (amplitude)">
            <Stepper
              value={typeof p.amplitude === 'number' ? p.amplitude : 1}
              onChange={(v) => update({ amplitude: v })}
              min={0.2}
              max={1}
              step={0.1}
              format={(v) => v.toFixed(1)}
            />
          </Field>
        )}
        {!isTransverse && (
          <Field label="Show energy-transfer arrow">
            <Toggle
              on={p.energyArrow === true}
              onChange={(v) => update({ energyArrow: v })}
              label=""
            />
          </Field>
        )}
      </div>

      {/* Markers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Lettered markers
          </p>
          <button
            type="button"
            onClick={() =>
              setMarkers(isTransverse ? TRANSVERSE_AQA_SET : LONGITUDINAL_AQA_SET)
            }
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
            style={{ background: '#FEF9F0', color: '#F5A623', border: '1px solid rgba(245,166,35,0.4)' }}
          >
            <Wand2 size={12} /> Quick AQA set
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          Each marker draws a lettered {isTransverse ? 'arrow' : 'section'} the
          student answers by letter. Keep each part distinct.
        </p>

        <div className="space-y-2">
          {markers.map((m, i) => {
            const isPoint = m.feature === 'point';
            return (
              <div
                key={i}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2"
              >
                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => updateMarker(i, { label: e.target.value })}
                  className="w-16 text-sm text-center font-semibold border border-gray-200 rounded-md h-10 focus:outline-none focus:border-amber-400"
                  aria-label="Marker label"
                />
                <select
                  value={m.feature}
                  onChange={(e) =>
                    updateMarker(i, { feature: e.target.value as WaveMarkerFeature })
                  }
                  className="flex-1 min-w-0 text-sm border border-gray-200 rounded-md h-10 px-2 bg-white focus:outline-none focus:border-amber-400"
                >
                  {features.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {!isPoint && (
                  <div className="shrink-0">
                    <Stepper
                      value={typeof m.cycle === 'number' ? m.cycle : 0}
                      onChange={(v) => updateMarker(i, { cycle: v })}
                      min={0}
                      max={5}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeMarker(i)}
                  className="w-10 h-10 shrink-0 rounded-md text-gray-300 hover:text-red-400 flex items-center justify-center"
                  aria-label="Remove marker"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addMarker}
          className="mt-2 flex items-center justify-center gap-1.5 w-full h-11 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 active:bg-gray-50"
        >
          <Plus size={14} /> Add marker
        </button>
      </div>

      {/* Second wave (transverse comparison) */}
      {isTransverse && (
        <div>
          <Toggle
            on={!!p.secondWave}
            onChange={(v) =>
              update(
                v
                  ? {
                      mainWaveLabel: p.mainWaveLabel ?? 'Wave A',
                      secondWave: { wavelengthRatio: 0.5, label: 'Wave B' },
                    }
                  : { secondWave: undefined, mainWaveLabel: undefined }
              )
            }
            label="Add a second wave to compare"
          />
          {p.secondWave && (
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 divide-y divide-gray-100">
              <Field label="First wave label">
                <input
                  type="text"
                  value={p.mainWaveLabel ?? ''}
                  onChange={(e) => update({ mainWaveLabel: e.target.value })}
                  className="w-28 text-sm border border-gray-200 rounded-md h-10 px-2 text-center focus:outline-none focus:border-amber-400"
                />
              </Field>
              <Field label="Second wave label">
                <input
                  type="text"
                  value={p.secondWave.label ?? ''}
                  onChange={(e) =>
                    update({ secondWave: { ...p.secondWave, label: e.target.value } })
                  }
                  className="w-28 text-sm border border-gray-200 rounded-md h-10 px-2 text-center focus:outline-none focus:border-amber-400"
                />
              </Field>
              <Field label="Its wavelength (× the first)">
                <Stepper
                  value={p.secondWave.wavelengthRatio ?? 1}
                  onChange={(v) =>
                    update({ secondWave: { ...p.secondWave, wavelengthRatio: v } })
                  }
                  min={0.25}
                  max={3}
                  step={0.25}
                  format={(v) => `${v}×`}
                />
              </Field>
              <Field label="Its amplitude (× the first)">
                <Stepper
                  value={p.secondWave.amplitudeRatio ?? 1}
                  onChange={(v) =>
                    update({ secondWave: { ...p.secondWave, amplitudeRatio: v } })
                  }
                  min={0.25}
                  max={1.5}
                  step={0.25}
                  format={(v) => `${v}×`}
                />
              </Field>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
