// CircuitDiagramEditor.tsx
//
// Touch-first structured editor for circuit-diagram params, used by the Seeded
// Question Composer. Builds a CircuitDiagramParams object from form controls —
// no JSON. Covers the approved schema (DIAGRAMS.md §8): supply, a series loop,
// an optional parallel section of up to 3 branches, and meters (ammeters in
// line, voltmeters across a named component).
//
// Component ids are generated automatically and kept unique, so the author
// never types one — they just pick which component a voltmeter measures.

import { Plus, Trash2, Wand2 } from 'lucide-react';
import type {
  CircuitDiagramParams,
  CircuitComponentSpec,
  CircuitComponentType,
  CircuitMeterSpec,
} from '../CircuitDiagram';

export interface DiagramEditorProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}

// Components that can sit in the series loop or a branch (supply handled apart).
const COMPONENT_OPTIONS: { value: CircuitComponentType; label: string; idPrefix: string }[] = [
  { value: 'resistor', label: 'Resistor', idPrefix: 'r' },
  { value: 'lamp', label: 'Lamp', idPrefix: 'l' },
  { value: 'variable-resistor', label: 'Variable resistor', idPrefix: 'vr' },
  { value: 'thermistor', label: 'Thermistor', idPrefix: 't' },
  { value: 'ldr', label: 'LDR', idPrefix: 'ldr' },
  { value: 'switch-open', label: 'Switch (open)', idPrefix: 's' },
  { value: 'switch-closed', label: 'Switch (closed)', idPrefix: 's' },
  { value: 'diode', label: 'Diode', idPrefix: 'd' },
  { value: 'led', label: 'LED', idPrefix: 'led' },
  { value: 'fuse', label: 'Fuse', idPrefix: 'f' },
];

const PREFIX: Record<string, string> = Object.fromEntries(
  COMPONENT_OPTIONS.map((o) => [o.value, o.idPrefix])
);

const COMPONENT_LABEL: Record<string, string> = Object.fromEntries(
  COMPONENT_OPTIONS.map((o) => [o.value, o.label])
);

// One-tap canonical starting points mirroring the gallery presets.
const PRESETS: { name: string; params: CircuitDiagramParams }[] = [
  {
    name: 'Series + meters',
    params: {
      supply: { type: 'battery', label: '6 V' },
      series: [
        { type: 'switch-closed', id: 's1' },
        { type: 'resistor', id: 'r1', label: 'R' },
        { type: 'lamp', id: 'l1' },
      ],
      meters: [
        { type: 'ammeter', label: 'A', position: 'main' },
        { type: 'voltmeter', label: 'V', position: { across: 'l1' } },
      ],
    },
  },
  {
    name: 'Parallel lamps',
    params: {
      supply: { type: 'battery', label: '12 V' },
      series: [{ type: 'switch-closed', id: 's1' }],
      parallelBranches: [
        [{ type: 'lamp', id: 'l1' }],
        [{ type: 'lamp', id: 'l2' }],
      ],
      meters: [
        { type: 'ammeter', label: 'A₁', position: 'main' },
        { type: 'ammeter', label: 'A₂', position: { branch: 0 } },
      ],
    },
  },
  {
    name: 'Thermistor divider',
    params: {
      supply: { type: 'battery', label: '12 V' },
      series: [
        { type: 'thermistor', id: 't1' },
        { type: 'resistor', id: 'r1', label: 'R' },
      ],
      meters: [{ type: 'voltmeter', label: 'V', position: { across: 'r1' } }],
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allIds(p: CircuitDiagramParams): Set<string> {
  const ids = new Set<string>();
  (p.series ?? []).forEach((c) => c.id && ids.add(c.id));
  (p.parallelBranches ?? []).forEach((b) => b.forEach((c) => c.id && ids.add(c.id)));
  return ids;
}

function freshId(type: CircuitComponentType, existing: Set<string>): string {
  const prefix = PREFIX[type] ?? 'c';
  let i = 1;
  while (existing.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

// All component ids with a friendly label, for the voltmeter "across" picker.
function idChoices(p: CircuitDiagramParams): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const push = (c: CircuitComponentSpec) => {
    if (c.id) out.push({ id: c.id, label: `${COMPONENT_LABEL[c.type] ?? c.type}${c.label ? ` (${c.label})` : ''}` });
  };
  (p.series ?? []).forEach(push);
  (p.parallelBranches ?? []).forEach((b) => b.forEach(push));
  return out;
}

// ─── Small touch controls ──────────────────────────────────────────────────────

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5 select-none">
      <span className="relative w-11 h-6 rounded-full transition-colors" style={{ background: on ? '#F5A623' : '#d1d5db' }}>
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </button>
  );
}

function CompRow({
  c,
  onChange,
  onRemove,
}: {
  c: CircuitComponentSpec;
  onChange: (patch: Partial<CircuitComponentSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2">
      <select
        value={c.type}
        onChange={(e) => onChange({ type: e.target.value as CircuitComponentType })}
        className="flex-1 min-w-0 text-sm border border-gray-200 rounded-md h-10 px-2 bg-white focus:outline-none focus:border-amber-400"
      >
        {COMPONENT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={c.label ?? ''}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="label e.g. 4 Ω"
        className="w-24 text-sm border border-gray-200 rounded-md h-10 px-2 focus:outline-none focus:border-amber-400"
      />
      <button
        type="button"
        onClick={onRemove}
        className="w-10 h-10 shrink-0 rounded-md text-gray-300 hover:text-red-400 flex items-center justify-center"
        aria-label="Remove component"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Main editor ────────────────────────────────────────────────────────────

export function CircuitDiagramEditor({ params, onChange }: DiagramEditorProps) {
  const p = params as CircuitDiagramParams;
  const supply = p.supply ?? { type: 'battery', label: '6 V' };
  const series = Array.isArray(p.series) ? p.series : [];
  const branches = Array.isArray(p.parallelBranches) ? p.parallelBranches : [];
  const meters = Array.isArray(p.meters) ? p.meters : [];
  const hasParallel = branches.length > 0;

  const update = (patch: Partial<CircuitDiagramParams>) =>
    onChange({ ...p, ...patch } as Record<string, unknown>);

  // ── Supply ──
  const setSupply = (patch: Partial<CircuitDiagramParams['supply']>) =>
    update({ supply: { ...supply, ...patch } });

  // ── Series ──
  const addSeries = () => {
    const id = freshId('resistor', allIds(p));
    update({ series: [...series, { type: 'resistor', id }] });
  };
  const updateSeries = (i: number, patch: Partial<CircuitComponentSpec>) => {
    const next = series.map((c, j) => (j === i ? { ...c, ...patch } : c));
    // Keep an id stable when only the label changes; refresh it if the type
    // changed so the id prefix still makes sense (and stays unique).
    if (patch.type && patch.type !== series[i].type) {
      const others = allIds({ ...p, series: series.filter((_, j) => j !== i) });
      next[i].id = freshId(patch.type, others);
      // Drop voltmeters that referenced the old id.
      const oldId = series[i].id;
      update({
        series: next,
        meters: meters.filter(
          (m) => !(typeof m.position === 'object' && 'across' in m.position && m.position.across === oldId)
        ),
      });
      return;
    }
    update({ series: next });
  };
  const removeSeries = (i: number) => {
    const oldId = series[i].id;
    update({
      series: series.filter((_, j) => j !== i),
      meters: meters.filter(
        (m) => !(typeof m.position === 'object' && 'across' in m.position && m.position.across === oldId)
      ),
    });
  };

  // ── Parallel branches ──
  const toggleParallel = (on: boolean) => {
    if (on) update({ parallelBranches: [[{ type: 'lamp', id: freshId('lamp', allIds(p)) }]] });
    else
      update({
        parallelBranches: [],
        // Drop branch ammeters and voltmeters across branch components.
        meters: meters.filter((m) => !(typeof m.position === 'object' && 'branch' in m.position))
          .filter((m) => {
            if (typeof m.position === 'object' && 'across' in m.position) {
              return (p.series ?? []).some((c) => c.id === m.position.across);
            }
            return true;
          }),
      });
  };
  const addBranch = () => {
    if (branches.length >= 3) return;
    update({ parallelBranches: [...branches, [{ type: 'lamp', id: freshId('lamp', allIds(p)) }]] });
  };
  const removeBranch = (bi: number) => {
    const removedIds = new Set(branches[bi].map((c) => c.id));
    update({
      parallelBranches: branches.filter((_, j) => j !== bi),
      meters: meters
        .filter((m) => !(typeof m.position === 'object' && 'branch' in m.position && m.position.branch === bi))
        // Re-index branch ammeters above the removed branch.
        .map((m) =>
          typeof m.position === 'object' && 'branch' in m.position && m.position.branch > bi
            ? { ...m, position: { branch: m.position.branch - 1 } }
            : m
        )
        .filter((m) => !(typeof m.position === 'object' && 'across' in m.position && removedIds.has(m.position.across))),
    });
  };
  const addBranchComp = (bi: number) => {
    if (branches[bi].length >= 3) return;
    const id = freshId('resistor', allIds(p));
    update({
      parallelBranches: branches.map((b, j) => (j === bi ? [...b, { type: 'resistor', id }] : b)),
    });
  };
  const updateBranchComp = (bi: number, ci: number, patch: Partial<CircuitComponentSpec>) => {
    const old = branches[bi][ci];
    const nextBranches = branches.map((b, j) =>
      j === bi ? b.map((c, k) => (k === ci ? { ...c, ...patch } : c)) : b
    );
    if (patch.type && patch.type !== old.type) {
      const others = allIds({ ...p, parallelBranches: branches.map((b, j) => (j === bi ? b.filter((_, k) => k !== ci) : b)) });
      nextBranches[bi][ci].id = freshId(patch.type, others);
      update({
        parallelBranches: nextBranches,
        meters: meters.filter(
          (m) => !(typeof m.position === 'object' && 'across' in m.position && m.position.across === old.id)
        ),
      });
      return;
    }
    update({ parallelBranches: nextBranches });
  };
  const removeBranchComp = (bi: number, ci: number) => {
    const oldId = branches[bi][ci].id;
    update({
      parallelBranches: branches.map((b, j) => (j === bi ? b.filter((_, k) => k !== ci) : b)),
      meters: meters.filter(
        (m) => !(typeof m.position === 'object' && 'across' in m.position && m.position.across === oldId)
      ),
    });
  };

  // ── Meters ──
  const choices = idChoices(p);
  const addAmmeter = () =>
    update({ meters: [...meters, { type: 'ammeter', label: 'A', position: 'main' }] });
  const addVoltmeter = () => {
    const target = choices[0]?.id;
    if (!target) return;
    update({ meters: [...meters, { type: 'voltmeter', label: 'V', position: { across: target } }] });
  };
  const updateMeter = (i: number, patch: Partial<CircuitMeterSpec>) =>
    update({ meters: meters.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const removeMeter = (i: number) => update({ meters: meters.filter((_, j) => j !== i) });

  return (
    <div className="space-y-5">
      {/* Quick presets */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Quick start
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.params as Record<string, unknown>)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium"
              style={{ background: '#FEF9F0', color: '#F5A623', border: '1px solid rgba(245,166,35,0.4)' }}
            >
              <Wand2 size={12} /> {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Supply */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Supply</p>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-2 flex-1">
            {(['cell', 'battery'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSupply({ type: t })}
                className="h-11 rounded-lg text-sm font-medium border capitalize transition-colors"
                style={
                  supply.type === t
                    ? { background: '#F5A623', color: 'white', borderColor: '#F5A623' }
                    : { background: 'white', color: '#6b7280', borderColor: 'rgba(0,0,0,0.1)' }
                }
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={supply.label ?? ''}
            onChange={(e) => setSupply({ label: e.target.value })}
            placeholder="e.g. 6 V"
            className="w-24 text-sm text-center border border-gray-200 rounded-lg h-11 px-2 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Series components */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Series components
        </p>
        <div className="space-y-2">
          {series.map((c, i) => (
            <CompRow
              key={c.id ?? i}
              c={c}
              onChange={(patch) => updateSeries(i, patch)}
              onRemove={() => removeSeries(i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addSeries}
          className="mt-2 flex items-center justify-center gap-1.5 w-full h-11 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 active:bg-gray-50"
        >
          <Plus size={14} /> Add series component
        </button>
      </div>

      {/* Parallel section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Parallel section
          </p>
          <Toggle on={hasParallel} onChange={toggleParallel} label={hasParallel ? 'On' : 'Off'} />
        </div>
        {hasParallel && (
          <div className="space-y-3">
            {/* Branch layout */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'inline', label: 'Inline block' },
                { value: 'ladder', label: 'Full-width rungs' },
              ] as const).map((opt) => {
                const active = (p.parallelStyle ?? 'inline') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update({ parallelStyle: opt.value })}
                    className="h-10 rounded-lg text-[12px] font-medium border transition-colors"
                    style={
                      active
                        ? { background: '#F5A623', color: 'white', borderColor: '#F5A623' }
                        : { background: 'white', color: '#6b7280', borderColor: 'rgba(0,0,0,0.1)' }
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 -mt-1">
              Full-width rungs draw equal-length branches stacked between two rails,
              with the supply on top — the conventional AQA parallel diagram.
            </p>
            {branches.map((b, bi) => (
              <div key={bi} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-500">Branch {bi + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeBranch(bi)}
                    className="text-[11px] text-gray-400 hover:text-red-400 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Remove branch
                  </button>
                </div>
                <div className="space-y-2">
                  {b.map((c, ci) => (
                    <CompRow
                      key={c.id ?? ci}
                      c={c}
                      onChange={(patch) => updateBranchComp(bi, ci, patch)}
                      onRemove={() => removeBranchComp(bi, ci)}
                    />
                  ))}
                </div>
                {b.length < 3 && (
                  <button
                    type="button"
                    onClick={() => addBranchComp(bi)}
                    className="mt-2 flex items-center justify-center gap-1.5 w-full h-10 rounded-lg border-2 border-dashed border-gray-200 text-[11px] font-medium text-gray-500 active:bg-gray-50"
                  >
                    <Plus size={13} /> Add to branch
                  </button>
                )}
              </div>
            ))}
            {branches.length < 3 && (
              <button
                type="button"
                onClick={addBranch}
                className="flex items-center justify-center gap-1.5 w-full h-11 rounded-lg border-2 border-dashed border-amber-200 text-xs font-medium text-amber-500 active:bg-amber-50"
              >
                <Plus size={14} /> Add branch
              </button>
            )}
          </div>
        )}
      </div>

      {/* Meters */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Meters</p>
        <div className="space-y-2">
          {meters.map((m, i) => {
            const isVolt = m.type === 'voltmeter';
            const branchPos =
              typeof m.position === 'object' && 'branch' in m.position ? m.position.branch : -1;
            const acrossPos =
              typeof m.position === 'object' && 'across' in m.position ? m.position.across : '';
            return (
              <div key={i} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2">
                <input
                  type="text"
                  value={m.label ?? ''}
                  onChange={(e) => updateMeter(i, { label: e.target.value })}
                  className="w-14 text-sm text-center font-semibold border border-gray-200 rounded-md h-10 focus:outline-none focus:border-amber-400"
                  aria-label="Meter label"
                />
                <select
                  value={m.type}
                  onChange={(e) => {
                    const type = e.target.value as 'ammeter' | 'voltmeter';
                    if (type === 'voltmeter') {
                      const target = choices[0]?.id;
                      updateMeter(i, target ? { type, position: { across: target } } : { type });
                    } else {
                      updateMeter(i, { type, position: 'main' });
                    }
                  }}
                  className="w-28 text-sm border border-gray-200 rounded-md h-10 px-2 bg-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ammeter">Ammeter</option>
                  <option value="voltmeter">Voltmeter</option>
                </select>
                {isVolt ? (
                  <select
                    value={acrossPos}
                    onChange={(e) => updateMeter(i, { position: { across: e.target.value } })}
                    className="flex-1 min-w-0 text-sm border border-gray-200 rounded-md h-10 px-2 bg-white focus:outline-none focus:border-amber-400"
                  >
                    {choices.length === 0 && <option value="">add a component first</option>}
                    {choices.map((ch) => (
                      <option key={ch.id} value={ch.id}>across {ch.label}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={branchPos === -1 ? 'main' : `branch:${branchPos}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateMeter(i, {
                        position: v === 'main' ? 'main' : { branch: Number(v.split(':')[1]) },
                      });
                    }}
                    className="flex-1 min-w-0 text-sm border border-gray-200 rounded-md h-10 px-2 bg-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="main">main loop</option>
                    {branches.map((_, bi) => (
                      <option key={bi} value={`branch:${bi}`}>branch {bi + 1}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => removeMeter(i)}
                  className="w-10 h-10 shrink-0 rounded-md text-gray-300 hover:text-red-400 flex items-center justify-center"
                  aria-label="Remove meter"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={addAmmeter}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 active:bg-gray-50"
          >
            <Plus size={14} /> Ammeter
          </button>
          <button
            type="button"
            onClick={addVoltmeter}
            disabled={choices.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 active:bg-gray-50 disabled:opacity-40"
          >
            <Plus size={14} /> Voltmeter
          </button>
        </div>
      </div>
    </div>
  );
}
