// src/pages/admin/AdminDiagramGallery.tsx
//
// Admin CMS — Diagram Gallery
// Route: /admin/diagram-gallery
//
// QA harness for the parametric diagram component library (see DIAGRAMS.md).
// For every component in QUESTION_DIAGRAM_REGISTRY it shows a live rendering,
// an editable JSON params textarea, preset example buttons, and a "Download
// SVG" button that serialises the rendered SVG to a standalone .svg file.
//
// New components registered in questionDiagramRegistry.tsx appear here
// automatically; add presets to GALLERY_METADATA as each one is built.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Shapes,
  X,
  Download,
  Play,
  AlertCircle,
} from 'lucide-react';
import { QUESTION_DIAGRAM_REGISTRY } from '@/components/diagrams/questionDiagramRegistry';

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

// ─── Presets per registry key ─────────────────────────────────────────────────

interface GalleryPreset {
  label: string;
  params: Record<string, unknown>;
}

interface GalleryMetadata {
  name: string;
  description: string;
  presets: GalleryPreset[];
}

const GALLERY_METADATA: Record<string, GalleryMetadata> = {
  'probability-tree': {
    name: 'Probability Tree',
    description:
      'Two-stage GCSE probability tree. Optional path probabilities, highlighting and hidden labels.',
    presets: [
      {
        label: 'Counters, no replacement',
        params: {
          stages: [
            {
              label: 'First counter',
              branches: [
                { outcome: 'Red', probability: { num: 5, den: 8 } },
                { outcome: 'Blue', probability: { num: 3, den: 8 } },
              ],
            },
            {
              label: 'Second counter',
              branches: [
                { outcome: 'Red', probability: { num: 4, den: 7 }, fromOutcome: 'Red' },
                { outcome: 'Blue', probability: { num: 3, den: 7 }, fromOutcome: 'Red' },
                { outcome: 'Red', probability: { num: 5, den: 7 }, fromOutcome: 'Blue' },
                { outcome: 'Blue', probability: { num: 2, den: 7 }, fromOutcome: 'Blue' },
              ],
            },
          ],
        },
      },
      {
        label: 'With path probabilities',
        params: {
          stages: [
            {
              label: 'First spin',
              branches: [
                { outcome: 'Win', probability: { num: 1, den: 4 } },
                { outcome: 'Lose', probability: { num: 3, den: 4 } },
              ],
            },
            {
              label: 'Second spin',
              branches: [
                { outcome: 'Win', probability: { num: 1, den: 4 }, fromOutcome: 'Win', highlight: true },
                { outcome: 'Lose', probability: { num: 3, den: 4 }, fromOutcome: 'Win' },
                { outcome: 'Win', probability: { num: 1, den: 4 }, fromOutcome: 'Lose' },
                { outcome: 'Lose', probability: { num: 3, den: 4 }, fromOutcome: 'Lose' },
              ],
            },
          ],
          showPathProbabilities: true,
          pathProbabilities: [
            { path: ['Win', 'Win'], probability: { num: 1, den: 16 }, highlight: true },
            { path: ['Win', 'Lose'], probability: { num: 3, den: 16 } },
            { path: ['Lose', 'Win'], probability: { num: 3, den: 16 } },
            { path: ['Lose', 'Lose'], probability: { num: 9, den: 16 } },
          ],
        },
      },
      {
        label: 'Complete the tree (hidden)',
        params: {
          stages: [
            {
              label: 'First counter',
              branches: [
                { outcome: 'Red', probability: { num: 5, den: 8 } },
                { outcome: 'Blue', probability: { num: 3, den: 8 }, hidden: true },
              ],
            },
            {
              label: 'Second counter',
              branches: [
                { outcome: 'Red', probability: { num: 4, den: 7 }, fromOutcome: 'Red' },
                { outcome: 'Blue', probability: { num: 3, den: 7 }, fromOutcome: 'Red', hidden: true },
                { outcome: 'Red', probability: { num: 5, den: 7 }, fromOutcome: 'Blue', hidden: true },
                { outcome: 'Blue', probability: { num: 2, den: 7 }, fromOutcome: 'Blue' },
              ],
            },
          ],
        },
      },
    ],
  },
  'quadratic-inequality-graph': {
    name: 'Quadratic Inequality Graph',
    description:
      'Parabola sketch with the inequality solution region highlighted. Worked-solution only — never shown on questions.',
    presets: [
      {
        label: 'x² − 3x − 4 < 0',
        params: { roots: [-1, 4], inequality: '<' },
      },
      {
        label: 'x² − 7x + 10 ≥ 0',
        params: { roots: [2, 5], inequality: '>=' },
      },
      {
        label: 'Negative coefficient',
        params: { roots: [-2, 3], a: -1, inequality: '>' },
      },
    ],
  },
  'completing-the-square-area-model': {
    name: 'Completing the Square — Area Model',
    description:
      'x² square plus two b/2 strips with the missing corner square highlighted.',
    presets: [
      { label: 'x² + 6x', params: { b: 6 } },
      { label: 'x² + 8x', params: { b: 8 } },
      { label: 'x² + 4x', params: { b: 4 } },
    ],
  },
  'parabola-vertex-graph': {
    name: 'Parabola Vertex Graph',
    description:
      'y = (x + p)² + q with the vertex marked and dashed guide lines. Reveals the minimum point.',
    presets: [
      { label: 'Vertex (−2, 3)', params: { p: 2, q: 3 } },
      { label: 'Vertex (1, −4)', params: { p: -1, q: -4 } },
      { label: 'Vertex on y-axis', params: { p: 0, q: -9 } },
    ],
  },
};

// ─── Error boundary ───────────────────────────────────────────────────────────
// A diagram component fed hand-edited params must never take the page down.

class DiagramErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : 'Render error' };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600 py-8 justify-center">
          <AlertCircle size={16} />
          Render error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDiagramGallery() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email === ADMIN_EMAIL) {
        setAuthed(true);
      } else {
        navigate('/');
      }
      setAuthChecked(true);
    });
  }, [navigate]);

  // All registered diagram keys, whether or not they have gallery metadata yet.
  const registryKeys = useMemo(
    () => Object.keys(QUESTION_DIAGRAM_REGISTRY),
    []
  );

  const [selectedKey, setSelectedKey] = useState(registryKeys[0]);
  const meta = GALLERY_METADATA[selectedKey];

  const initialParams = meta?.presets[0]?.params ?? {};
  const [paramsText, setParamsText] = useState(
    JSON.stringify(initialParams, null, 2)
  );
  const [appliedParams, setAppliedParams] = useState<Record<string, unknown>>(
    initialParams
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const selectComponent = (key: string) => {
    setSelectedKey(key);
    const first = GALLERY_METADATA[key]?.presets[0]?.params ?? {};
    setParamsText(JSON.stringify(first, null, 2));
    setAppliedParams(first);
    setParseError(null);
  };

  const applyPreset = (preset: GalleryPreset) => {
    setParamsText(JSON.stringify(preset.params, null, 2));
    setAppliedParams(preset.params);
    setParseError(null);
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(paramsText);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParseError('Params must be a JSON object.');
        return;
      }
      setAppliedParams(parsed);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const downloadSvg = () => {
    const svg = previewRef.current?.querySelector('svg');
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Standalone files need explicit dimensions; in-app sizing styles are
    // dropped in favour of the viewBox dimensions.
    clone.removeAttribute('style');
    const vb = svg.viewBox?.baseVal;
    if (vb && vb.width > 0) {
      clone.setAttribute('width', String(vb.width));
      clone.setAttribute('height', String(vb.height));
    }

    const source =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedKey}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!authChecked || !authed) return null;

  const Diagram = QUESTION_DIAGRAM_REGISTRY[selectedKey];

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: '#E23D28' }}
            >
              <Shapes size={14} color="white" />
            </div>
            <span className="text-sm font-semibold text-gray-800">
              Diagram Gallery
            </span>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Back to Admin Hub
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Component list */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Components
          </p>
          {registryKeys.map((key) => {
            const m = GALLERY_METADATA[key];
            const active = key === selectedKey;
            return (
              <button
                key={key}
                onClick={() => selectComponent(key)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? 'white' : 'transparent',
                  border: active
                    ? '1px solid rgba(0,0,0,0.08)'
                    : '1px solid transparent',
                  fontWeight: active ? 600 : 400,
                  color: active ? '#1C1917' : '#6b7280',
                }}
              >
                {m?.name ?? key}
                <span className="block text-[10px] text-gray-400 font-normal mt-0.5">
                  {key}
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview + editor */}
        <div className="space-y-5 min-w-0">
          {meta && (
            <p className="text-xs text-gray-500 leading-relaxed">
              {meta.description}
            </p>
          )}

          {/* Live rendering */}
          <div
            ref={previewRef}
            className="bg-white rounded-xl border p-4 overflow-x-auto"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <DiagramErrorBoundary
              key={`${selectedKey}:${JSON.stringify(appliedParams)}`}
            >
              {Diagram ? (
                <Diagram params={appliedParams} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  Component not found in registry.
                </p>
              )}
            </DiagramErrorBoundary>
          </div>

          {/* Presets */}
          {meta && meta.presets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meta.presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:shadow-sm transition-all text-gray-600"
                  style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* JSON editor */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              diagram_params (JSON)
            </p>
            <textarea
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              spellCheck={false}
              rows={14}
              className="w-full rounded-lg border bg-white p-3 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            />
            {parseError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={13} />
                {parseError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={applyJson}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg transition-all active:scale-[0.97]"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              >
                <Play size={12} /> Apply params
              </button>
              <button
                onClick={downloadSvg}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border bg-white text-gray-700 hover:shadow-sm transition-all active:scale-[0.97]"
                style={{ borderColor: 'rgba(0,0,0,0.1)' }}
              >
                <Download size={12} /> Download SVG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
