// src/pages/admin/AdminSeededComposer.tsx
//
// Admin — Seeded Question Composer
// Route: /admin/seeded-composer
//
// Author a complete seeded diagram question on an iPad with zero JSON and zero
// code. Shared form (subtopic, question text + KaTeX, marks, structured mark
// scheme, worked solution) plus a registry-driven diagram panel: pick a family,
// edit its params with a touch-first editor, live-preview in question or
// worked-solution view. Save writes a seeded_questions row and confirms by
// rendering the real QuestionCard.
//
// First family: Wave. New families plug in via the registry `editor` field —
// the composer shell never changes.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { renderMathInText } from '@/lib/renderMathInText';
import { QuestionCard } from '@/components/practice/QuestionCard';
import { QUESTION_DIAGRAM_REGISTRY } from '@/components/diagrams/questionDiagramRegistry';
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Eye,
  Waves as WavesIcon,
} from 'lucide-react';

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

interface Subtopic {
  id: string;
  subtopic_name: string;
  topic: string;
  subject: string;
  slug: string;
  tier: string;
  exam_board: string | null;
}

interface MarkRow {
  mark: string;
  criterion: string;
}

const MARK_TYPES = ['B1', 'M1', 'A1', 'C1'];

// Diagram families that are inherently AQA Physics — authoring one means the
// mark scheme should be 1-mark-per-point even before a subtopic is selected.
// (vector-diagram is excluded: it doubles as Edexcel Maths column vectors.)
const PHYSICS_DIAGRAM_FAMILIES = new Set([
  'wave-diagram',
  'circuit-diagram',
  'free-body-diagram',
]);

// Families authorable in the composer = registry entries with an editor.
const EDITOR_FAMILIES = Object.entries(QUESTION_DIAGRAM_REGISTRY)
  .filter(([, e]) => !!e.editor)
  .map(([key, e]) => ({ key, label: e.label ?? key, defaults: e.editorDefaults ?? {} }));

// ─── KaTeX quick-insert toolbar ───────────────────────────────────────────────

function MathToolbar({
  textareaRef,
  onInsert,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onInsert: (next: string) => void;
}) {
  const wrap = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const v = el.value;
    const next = v.slice(0, start) + before + v.slice(start, end) + after + v.slice(end);
    onInsert(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length;
      el.setSelectionRange(pos, pos + (end - start));
    });
  };
  const btns: { label: string; before: string; after: string }[] = [
    { label: '$ $', before: '$', after: '$' },
    { label: 'x²', before: '$', after: '^{2}$' },
    { label: '½', before: '$\\frac{', after: '}{}$' },
    { label: '√', before: '$\\sqrt{', after: '}$' },
    { label: '°', before: '$', after: '^{\\circ}$' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {btns.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={() => wrap(b.before, b.after)}
          className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 active:bg-gray-100"
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminSeededComposer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [subtopicId, setSubtopicId] = useState('');

  const [questionText, setQuestionText] = useState('');
  const [marks, setMarks] = useState(1);
  const [workedSolution, setWorkedSolution] = useState('');
  const [markRows, setMarkRows] = useState<MarkRow[]>([{ mark: 'B1', criterion: '' }]);
  const [generatingMs, setGeneratingMs] = useState(false);
  const [msError, setMsError] = useState('');

  const [hasDiagram, setHasDiagram] = useState(true);
  const [family, setFamily] = useState(
    searchParams.get('family') && EDITOR_FAMILIES.some((f) => f.key === searchParams.get('family'))
      ? (searchParams.get('family') as string)
      : EDITOR_FAMILIES[0]?.key ?? ''
  );
  const [diagramParams, setDiagramParams] = useState<Record<string, unknown>>(
    EDITOR_FAMILIES.find((f) => f.key === (searchParams.get('family') || EDITOR_FAMILIES[0]?.key))
      ?.defaults ?? {}
  );
  const [previewMode, setPreviewMode] = useState<'question' | 'feedback'>('question');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [savedQuestion, setSavedQuestion] = useState<{
    questionText: string;
    marks: number;
    diagramComponent: string | null;
    diagramParams: Record<string, unknown> | null;
  } | null>(null);

  const questionRef = useRef<HTMLTextAreaElement>(null);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email === ADMIN_EMAIL) setAuthed(true);
      else navigate('/');
      setAuthChecked(true);
    });
  }, [navigate]);

  // ── Subtopics ──
  useEffect(() => {
    if (!authed) return;
    supabase
      .from('subtopics')
      .select('id, subtopic_name, topic, subject, slug, tier, exam_board')
      .order('subject')
      .order('topic')
      .then(({ data }) => {
        if (!data) return;
        setSubtopics(data as Subtopic[]);
        // Default to wave-properties when launched for the wave family.
        if (!subtopicId && family === 'wave-diagram') {
          const wp = data.find((s: Subtopic) => s.slug === 'wave-properties');
          if (wp) setSubtopicId(wp.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const selectedSubtopic = subtopics.find((s) => s.id === subtopicId) ?? null;
  // AQA Physics awards 1 mark per point (no M1/A1/B1 labels) — the marking
  // engine treats every Physics criterion as a standalone 1-mark step.
  // Driven by the selected subtopic's subject, but the diagram families below
  // are inherently Physics, so the 1-mark UI shows immediately when authoring
  // one (even before a subtopic is picked).
  const isPhysics =
    (selectedSubtopic?.subject ?? '').toLowerCase().includes('physics') ||
    (hasDiagram && PHYSICS_DIAGRAM_FAMILIES.has(family));
  const familyEntry = QUESTION_DIAGRAM_REGISTRY[family];
  const Editor = familyEntry?.editor;
  const PreviewComponent = familyEntry?.component;

  function pickFamily(key: string) {
    setFamily(key);
    setDiagramParams(EDITOR_FAMILIES.find((f) => f.key === key)?.defaults ?? {});
  }

  function updateMarkRow(i: number, patch: Partial<MarkRow>) {
    setMarkRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleGenerateMarkScheme() {
    if (!questionText.trim() || !workedSolution.trim()) {
      setMsError('Add the question text and a worked solution first.');
      return;
    }
    setGeneratingMs(true);
    setMsError('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-mark-scheme', {
        body: {
          questionText: questionText.trim(),
          marksAvailable: marks,
          workedSolution: workedSolution.trim(),
          diagramComponent: hasDiagram ? family : null,
          diagramParams: hasDiagram ? diagramParams : null,
          examBoard: selectedSubtopic?.exam_board ?? 'AQA',
          subject: selectedSubtopic?.subject ?? 'Physics',
          tier: selectedSubtopic?.tier ?? 'Both',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const scheme = Array.isArray(data.markScheme) ? data.markScheme : [];
      const rows: MarkRow[] = scheme
        .filter((r: any) => (r.criterion ?? '') && (r.mark ?? r.mark_type) !== 'TOTAL')
        .map((r: any) => ({ mark: r.mark ?? r.mark_type ?? 'B1', criterion: r.criterion }));
      if (rows.length) setMarkRows(rows);
    } catch (e: any) {
      setMsError(e.message || 'Generation failed — try again.');
    } finally {
      setGeneratingMs(false);
    }
  }

  async function handleSave() {
    if (!subtopicId) return setSaveErr('Choose a subtopic.');
    if (!questionText.trim()) return setSaveErr('Add the question text.');
    const cleanRows = markRows.filter((r) => r.criterion.trim());
    if (cleanRows.length === 0) return setSaveErr('Add at least one mark scheme line.');

    setSaveStatus('saving');
    setSaveError('');

    const mark_scheme = [
      ...cleanRows.map((r) => ({
        mark: isPhysics ? 'step' : r.mark,
        criterion: r.criterion.trim(),
      })),
      { mark: 'TOTAL', criterion: `${marks} mark${marks !== 1 ? 's' : ''}` },
    ];

    const { data: existing } = await supabase
      .from('seeded_questions')
      .select('question_order')
      .eq('subtopic_id', subtopicId)
      .order('question_order', { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.question_order ?? 0) + 1;

    const { error } = await supabase.from('seeded_questions').insert({
      subtopic_id: subtopicId,
      question_order: nextOrder,
      question_text: questionText.trim(),
      marks,
      mark_scheme,
      worked_solution: workedSolution.trim() || null,
      diagram_component: hasDiagram ? family : null,
      diagram_params: hasDiagram ? diagramParams : null,
    });

    if (error) {
      setSaveStatus('error');
      setSaveError(error.message);
      return;
    }

    setSavedQuestion({
      questionText: questionText.trim(),
      marks,
      diagramComponent: hasDiagram ? family : null,
      diagramParams: hasDiagram ? diagramParams : null,
    });
    setSaveStatus('success');
  }

  function setSaveErr(msg: string) {
    setSaveStatus('error');
    setSaveError(msg);
  }

  function authorAnother() {
    setQuestionText('');
    setMarks(1);
    setWorkedSolution('');
    setMarkRows([{ mark: 'B1', criterion: '' }]);
    setDiagramParams(EDITOR_FAMILIES.find((f) => f.key === family)?.defaults ?? {});
    setSavedQuestion(null);
    setSaveStatus('idle');
    setSaveError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const subtopicOptions = useMemo(() => {
    const groups: Record<string, Subtopic[]> = {};
    for (const s of subtopics) {
      const g = `${s.subject} · ${s.topic}`;
      (groups[g] ??= []).push(s);
    }
    return groups;
  }, [subtopics]);

  if (!authChecked || !authed) return null;

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b" style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#E23D28' }}>
              <WavesIcon size={14} color="white" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Seeded Question Composer</span>
          </div>
          <button onClick={() => navigate('/admin')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <ArrowLeft size={12} /> Admin Hub
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        {savedQuestion ? (
          <SavedConfirmation saved={savedQuestion} onAnother={authorAnother} onExit={() => navigate('/admin')} />
        ) : (
          <>
            {/* Subtopic */}
            <Section title="Subtopic">
              <select
                value={subtopicId}
                onChange={(e) => setSubtopicId(e.target.value)}
                className="w-full h-12 text-sm border border-gray-200 rounded-lg px-3 bg-white focus:outline-none focus:border-amber-400"
              >
                <option value="">Choose a subtopic…</option>
                {Object.entries(subtopicOptions).map(([group, list]) => (
                  <optgroup key={group} label={group}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subtopic_name} ({s.tier})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Section>

            {/* Question text + marks */}
            <Section title="Question">
              <MathToolbar textareaRef={questionRef} onInsert={setQuestionText} />
              <textarea
                ref={questionRef}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={4}
                placeholder="e.g. The diagram shows a transverse wave. Which arrow shows the amplitude? Give the letter."
                className="mt-2 w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:border-amber-400 bg-white"
              />
              {questionText.trim() && (
                <div
                  className="mt-2 rounded-lg border border-amber-100 bg-white p-3 text-sm text-gray-800 question-text"
                  dangerouslySetInnerHTML={{ __html: renderMathInText(questionText) }}
                />
              )}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-sm text-gray-600">Marks</span>
                <NumberStepper value={marks} onChange={setMarks} min={1} max={10} />
              </div>
            </Section>

            {/* Diagram */}
            <Section
              title="Diagram"
              right={
                <Switch on={hasDiagram} onChange={setHasDiagram} label={hasDiagram ? 'On' : 'Off'} />
              }
            >
              {hasDiagram && (
                <>
                  {EDITOR_FAMILIES.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {EDITOR_FAMILIES.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => pickFamily(f.key)}
                          className="h-10 px-4 rounded-lg text-sm font-medium border"
                          style={
                            family === f.key
                              ? { background: '#F5A623', color: 'white', borderColor: '#F5A623' }
                              : { background: 'white', color: '#6b7280', borderColor: 'rgba(0,0,0,0.1)' }
                          }
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {Editor ? (
                    <Editor params={diagramParams} onChange={setDiagramParams} />
                  ) : (
                    <p className="text-xs text-gray-400">No editor for this family yet.</p>
                  )}

                  {/* Live preview */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                        <Eye size={12} /> Live preview
                      </span>
                      <div className="flex items-center rounded-lg border border-black/10 overflow-hidden">
                        {(['question', 'feedback'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPreviewMode(m)}
                            className="text-[10px] font-semibold px-2.5 py-1.5 uppercase tracking-wide"
                            style={
                              previewMode === m
                                ? { background: m === 'question' ? '#F5A623' : '#E23D28', color: 'white' }
                                : { background: 'transparent', color: '#9ca3af' }
                            }
                          >
                            {m === 'question' ? 'Question view' : 'Solution view'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/5" style={{ background: '#FAF7F2' }}>
                      {PreviewComponent && <PreviewComponent params={diagramParams} mode={previewMode} />}
                    </div>
                  </div>
                </>
              )}
            </Section>

            {/* Mark scheme */}
            <Section
              title="Mark scheme"
              right={
                <button
                  type="button"
                  onClick={handleGenerateMarkScheme}
                  disabled={generatingMs || !questionText.trim() || !workedSolution.trim()}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg disabled:opacity-40"
                  style={{ background: '#FEF9F0', color: '#F5A623', border: '1px solid rgba(245,166,35,0.4)' }}
                >
                  {generatingMs ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Generate
                </button>
              }
            >
              {msError && <p className="text-[11px] text-red-500 mb-2">{msError}</p>}
              {isPhysics && (
                <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                  AQA Physics awards <span className="font-medium text-gray-500">1 mark per point</span> —
                  add one line per mark. Write each point as the examiner would, and list acceptable
                  alternatives with <span className="font-mono text-gray-500">allow …</span> (e.g.
                  “current decreases; allow gets smaller / reduces”). The marking AI uses these.
                </p>
              )}
              <div className="space-y-2">
                {markRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {isPhysics ? (
                      <span className="w-20 h-11 shrink-0 flex items-center justify-center text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                        1 mark
                      </span>
                    ) : (
                      <select
                        value={r.mark}
                        onChange={(e) => updateMarkRow(i, { mark: e.target.value })}
                        className="w-20 h-11 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none focus:border-amber-400"
                      >
                        {MARK_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={r.criterion}
                      onChange={(e) => updateMarkRow(i, { criterion: e.target.value })}
                      placeholder={isPhysics ? 'Point — e.g. the current decreases; allow reduces' : 'Criterion — e.g. amplitude is arrow B'}
                      className="flex-1 min-w-0 h-11 text-sm border border-gray-200 rounded-lg px-3 bg-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setMarkRows((rows) => rows.filter((_, j) => j !== i))}
                      className="w-10 h-10 shrink-0 rounded-md text-gray-300 hover:text-red-400 flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMarkRows((rows) => [...rows, { mark: isPhysics ? 'step' : 'A1', criterion: '' }])}
                className="mt-2 flex items-center justify-center gap-1.5 w-full h-11 rounded-lg border-2 border-dashed border-gray-200 text-xs font-medium text-gray-500 active:bg-gray-50"
              >
                <Plus size={14} /> Add mark scheme line
              </button>
            </Section>

            {/* Worked solution */}
            <Section title="Worked solution">
              <textarea
                value={workedSolution}
                onChange={(e) => setWorkedSolution(e.target.value)}
                rows={3}
                placeholder="Shown to the student after they attempt. Separate steps with new lines."
                className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:border-amber-400 bg-white"
              />
              {workedSolution.trim() && (
                <div
                  className="mt-2 rounded-lg border border-amber-100 bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap question-text"
                  dangerouslySetInnerHTML={{ __html: renderMathInText(workedSolution) }}
                />
              )}
            </Section>

            {/* Save */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: saveStatus === 'error' ? '#ef4444' : '#E23D28' }}
              >
                {saveStatus === 'saving' ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving…</>
                ) : saveStatus === 'error' ? (
                  <><AlertTriangle size={15} /> {saveError || 'Error — try again'}</>
                ) : (
                  <><Save size={15} /> Save seeded question</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-black/5 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-11 h-11 rounded-lg border border-gray-200 bg-white text-xl text-gray-600 active:bg-gray-100 disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-11 h-11 rounded-lg border border-gray-200 bg-white text-xl text-gray-600 active:bg-gray-100 disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 select-none">
      <span className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="relative w-11 h-6 rounded-full transition-colors" style={{ background: on ? '#F5A623' : '#d1d5db' }}>
        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
      </span>
    </button>
  );
}

function SavedConfirmation({
  saved,
  onAnother,
  onExit,
}: {
  saved: { questionText: string; marks: number; diagramComponent: string | null; diagramParams: Record<string, unknown> | null };
  onAnother: () => void;
  onExit: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 size={18} />
        <span className="text-sm font-semibold">Saved — live now in this subtopic.</span>
      </div>
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-4">
          How the student sees it
        </p>
        <QuestionCard
          questionNumber={1}
          totalQuestions={1}
          questionText={saved.questionText}
          marks={saved.marks}
          answer=""
          onAnswerChange={() => {}}
          diagramComponent={saved.diagramComponent}
          diagramParams={saved.diagramParams}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onAnother}
          className="flex items-center justify-center gap-2 flex-1 h-12 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#E23D28' }}
        >
          <Plus size={15} /> Author another
        </button>
        <button
          onClick={onExit}
          className="flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600"
        >
          <X size={14} /> Done
        </button>
      </div>
    </div>
  );
}
