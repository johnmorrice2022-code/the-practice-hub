// src/pages/admin/AdminProbabilityQuestions.tsx
//
// Admin CMS — Probability Tree Question Authoring
// Route: /admin/probability-questions
//
// Scope: Foundation Probability subtopic only (for now).
// Reads/writes seeded_questions with diagram_component='probability-tree'.
//
// Features:
// - Left panel: list of existing questions (edit / delete)
// - Right panel: form with live ProbabilityTree preview
// - Save immediately, form resets for next question
// - Edit loads question back into form; save updates in place
// - "Generate mark scheme" button calls generate-mark-scheme edge function

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProbabilityTree } from '@/components/diagrams/ProbabilityTree';
import type {
  ProbabilityTreeConfig,
  Branch,
} from '@/components/diagrams/ProbabilityTree';
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Eye,
  RotateCcw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';
const PROB_SUBTOPIC_SLUG = 'probability-foundation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeededQuestion {
  id: string;
  question_text: string;
  marks: number;
  question_order: number;
  mark_scheme: unknown;
  worked_solution: string;
  diagram_component: string;
  diagram_params: ProbabilityTreeConfig;
  subtopic_id: string;
}

interface BranchForm {
  outcome: string;
  num: string;
  den: string;
  hidden: boolean;
  highlight: boolean;
}

interface PathProbForm {
  path0: string;
  path1: string;
  num: string;
  den: string;
  highlight: boolean;
}

interface FormState {
  questionText: string;
  marks: string;
  workedSolution: string;
  markScheme: string;
  s1: [BranchForm, BranchForm];
  s2: [BranchForm, BranchForm, BranchForm, BranchForm];
  showPathProbs: boolean;
  pathProbs: PathProbForm[];
}

const EMPTY_BRANCH: BranchForm = {
  outcome: '',
  num: '',
  den: '',
  hidden: false,
  highlight: false,
};

const EMPTY_PATH_PROB: PathProbForm = {
  path0: '',
  path1: '',
  num: '',
  den: '',
  highlight: false,
};

function emptyForm(): FormState {
  return {
    questionText: '',
    marks: '3',
    workedSolution: '',
    markScheme: '',
    s1: [{ ...EMPTY_BRANCH }, { ...EMPTY_BRANCH }],
    s2: [
      { ...EMPTY_BRANCH },
      { ...EMPTY_BRANCH },
      { ...EMPTY_BRANCH },
      { ...EMPTY_BRANCH },
    ],
    showPathProbs: false,
    pathProbs: [
      { ...EMPTY_PATH_PROB },
      { ...EMPTY_PATH_PROB },
      { ...EMPTY_PATH_PROB },
      { ...EMPTY_PATH_PROB },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function formToConfig(form: FormState): ProbabilityTreeConfig {
  const s1Branches: Branch[] = form.s1.map((b) => ({
    outcome: b.outcome || '?',
    probability: { num: toNum(b.num), den: toNum(b.den) },
    hidden: b.hidden,
    highlight: b.highlight,
  }));

  const s2Branches: Branch[] = [
    { ...form.s2[0], fromOutcome: form.s1[0].outcome || '?' },
    { ...form.s2[1], fromOutcome: form.s1[0].outcome || '?' },
    { ...form.s2[2], fromOutcome: form.s1[1].outcome || '?' },
    { ...form.s2[3], fromOutcome: form.s1[1].outcome || '?' },
  ].map((b) => ({
    outcome: b.outcome || '?',
    probability: {
      num: toNum(b.num as unknown as string),
      den: toNum(b.den as unknown as string),
    },
    fromOutcome: b.fromOutcome,
    hidden: b.hidden,
    highlight: b.highlight,
  }));

  const config: ProbabilityTreeConfig = {
    stages: [{ branches: s1Branches }, { branches: s2Branches }],
    showPathProbabilities: form.showPathProbs,
  };

  if (form.showPathProbs && form.pathProbs.length > 0) {
    config.pathProbabilities = form.pathProbs
      .filter((pp) => pp.path0 && pp.path1)
      .map((pp) => ({
        path: [pp.path0, pp.path1],
        probability: { num: toNum(pp.num), den: toNum(pp.den) },
        highlight: pp.highlight,
      }));
  }

  return config;
}

function formToDiagramParams(form: FormState): ProbabilityTreeConfig {
  return formToConfig(form);
}

function configToForm(q: SeededQuestion, base: FormState): FormState {
  const cfg = q.diagram_params;
  if (!cfg?.stages) return base;

  const stage1 = cfg.stages[0]?.branches ?? [];
  const stage2 = cfg.stages[1]?.branches ?? [];

  const s1: [BranchForm, BranchForm] = [0, 1].map((i) => {
    const b = stage1[i];
    if (!b) return { ...EMPTY_BRANCH };
    return {
      outcome: b.outcome,
      num: String(b.probability.num),
      den: String(b.probability.den),
      hidden: b.hidden ?? false,
      highlight: b.highlight ?? false,
    };
  }) as [BranchForm, BranchForm];

  const s2: [BranchForm, BranchForm, BranchForm, BranchForm] = [
    stage2.filter((b) => b.fromOutcome === stage1[0]?.outcome)[0],
    stage2.filter((b) => b.fromOutcome === stage1[0]?.outcome)[1],
    stage2.filter((b) => b.fromOutcome === stage1[1]?.outcome)[0],
    stage2.filter((b) => b.fromOutcome === stage1[1]?.outcome)[1],
  ].map((b) => {
    if (!b) return { ...EMPTY_BRANCH };
    return {
      outcome: b.outcome,
      num: String(b.probability.num),
      den: String(b.probability.den),
      hidden: b.hidden ?? false,
      highlight: b.highlight ?? false,
    };
  }) as [BranchForm, BranchForm, BranchForm, BranchForm];

  const pathProbs: PathProbForm[] = (cfg.pathProbabilities ?? []).map((pp) => ({
    path0: pp.path[0] ?? '',
    path1: pp.path[1] ?? '',
    num: String(pp.probability.num),
    den: String(pp.probability.den),
    highlight: pp.highlight ?? false,
  }));

  while (pathProbs.length < 4) pathProbs.push({ ...EMPTY_PATH_PROB });

  return {
    questionText: q.question_text,
    marks: String(q.marks),
    workedSolution: q.worked_solution ?? '',
    markScheme:
      typeof q.mark_scheme === 'string'
        ? q.mark_scheme
        : JSON.stringify(q.mark_scheme ?? '', null, 2),
    s1,
    s2,
    showPathProbs: cfg.showPathProbabilities ?? false,
    pathProbs: pathProbs as [
      PathProbForm,
      PathProbForm,
      PathProbForm,
      PathProbForm,
    ],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminProbabilityQuestions() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [subtopicId, setSubtopicId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SeededQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [generatingMarkScheme, setGeneratingMarkScheme] = useState(false);
  const [markSchemeError, setMarkSchemeError] = useState('');

  // ── Auth ────────────────────────────────────────────────────────────────────

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

  // ── Fetch subtopic ID + questions ────────────────────────────────────────────

  useEffect(() => {
    if (!authed) return;
    supabase
      .from('subtopics')
      .select('id')
      .eq('slug', PROB_SUBTOPIC_SLUG)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setSubtopicId(data.id);
      });
  }, [authed]);

  const fetchQuestions = useCallback(async () => {
    if (!subtopicId) return;
    setLoadingQuestions(true);
    const { data, error } = await supabase
      .from('seeded_questions')
      .select('*')
      .eq('subtopic_id', subtopicId)
      .eq('diagram_component', 'probability-tree')
      .order('question_order', { ascending: true });

    if (!error && data) {
      setQuestions(data as unknown as SeededQuestion[]);
    }
    setLoadingQuestions(false);
  }, [subtopicId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function updateS1(
    idx: 0 | 1,
    field: keyof BranchForm,
    value: string | boolean
  ) {
    setForm((f) => {
      const s1 = [...f.s1] as [BranchForm, BranchForm];
      s1[idx] = { ...s1[idx], [field]: value };
      return { ...f, s1 };
    });
  }

  function updateS2(
    idx: 0 | 1 | 2 | 3,
    field: keyof BranchForm,
    value: string | boolean
  ) {
    setForm((f) => {
      const s2 = [...f.s2] as [BranchForm, BranchForm, BranchForm, BranchForm];
      s2[idx] = { ...s2[idx], [field]: value };
      return { ...f, s2 };
    });
  }

  function updatePathProb(
    idx: number,
    field: keyof PathProbForm,
    value: string | boolean
  ) {
    setForm((f) => {
      const pp = [...f.pathProbs];
      pp[idx] = { ...pp[idx], [field]: value };
      return { ...f, pathProbs: pp };
    });
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setSaveStatus('idle');
    setSaveError('');
    setMarkSchemeError('');
  }

  function loadForEdit(q: SeededQuestion) {
    setForm(configToForm(q, emptyForm()));
    setEditingId(q.id);
    setSaveStatus('idle');
    setSaveError('');
    setMarkSchemeError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Generate mark scheme ─────────────────────────────────────────────────────

  async function handleGenerateMarkScheme() {
    if (!form.questionText.trim()) {
      setMarkSchemeError('Add a question text first.');
      return;
    }
    if (!form.workedSolution.trim()) {
      setMarkSchemeError(
        'Add a worked solution first — Claude needs it to write accurate criteria.'
      );
      return;
    }

    setGeneratingMarkScheme(true);
    setMarkSchemeError('');

    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-mark-scheme',
        {
          body: {
            questionText: form.questionText.trim(),
            marksAvailable: toNum(form.marks),
            workedSolution: form.workedSolution.trim(),
            diagramComponent: 'probability-tree',
            diagramParams: formToDiagramParams(form),
            examBoard: 'Edexcel',
            subject: 'Maths',
            tier: 'Foundation',
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const formatted = JSON.stringify(data.markScheme, null, 2);
      setForm((f) => ({ ...f, markScheme: formatted }));
    } catch (e: any) {
      setMarkSchemeError(e.message || 'Generation failed — try again.');
    } finally {
      setGeneratingMarkScheme(false);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!subtopicId) return;
    setSaveStatus('saving');
    setSaveError('');

    const diagramParams = formToDiagramParams(form);
    const maxOrder = questions.reduce(
      (m, q) => Math.max(m, q.question_order),
      0
    );

    let markSchemeValue: unknown;
    try {
      markSchemeValue = JSON.parse(form.markScheme);
    } catch {
      markSchemeValue = form.markScheme;
    }

    const payload = {
      subtopic_id: subtopicId,
      question_text: form.questionText.trim(),
      marks: toNum(form.marks),
      worked_solution: form.workedSolution.trim(),
      mark_scheme: markSchemeValue,
      diagram_component: 'probability-tree',
      diagram_params: diagramParams,
      ...(!editingId ? { question_order: maxOrder + 1 } : {}),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from('seeded_questions')
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error } = await supabase.from('seeded_questions').insert(payload));
    }

    if (error) {
      setSaveStatus('error');
      setSaveError(error.message);
      return;
    }

    setSaveStatus('success');
    await fetchQuestions();
    setTimeout(() => {
      resetForm();
    }, 1200);
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleteId(id);
    const { error } = await supabase
      .from('seeded_questions')
      .delete()
      .eq('id', id);

    if (!error) {
      setQuestions((qs) => qs.filter((q) => q.id !== id));
      if (editingId === id) resetForm();
    }
    setDeleteId(null);
  }

  const previewConfig = formToConfig(form);

  if (!authChecked || !authed) return null;

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: '#E23D28' }}
            >
              <GitBranch size={14} color="white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">
                Probability Question Authoring
              </span>
              <span
                className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#F5A623', color: 'white' }}
              >
                Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Admin Hub
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <X size={12} /> Exit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* ═══════════════════════════════════════════════════════════════════
              LEFT: Question list
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Existing questions
              </h2>
              <span className="text-[11px] text-gray-400">
                {questions.length} question{questions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingQuestions ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-white rounded-xl border border-black/5 shadow-sm p-8 text-center">
                <GitBranch
                  size={24}
                  className="mx-auto mb-3 text-gray-300"
                  strokeWidth={1.5}
                />
                <p className="text-xs text-gray-400">
                  No questions yet.
                  <br />
                  Author your first one →
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    isEditing={editingId === q.id}
                    isDeleting={deleteId === q.id}
                    onEdit={() => loadForEdit(q)}
                    onDelete={() => handleDelete(q.id)}
                  />
                ))}
              </div>
            )}

            {editingId && (
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-xs font-medium transition-all"
                style={{
                  borderColor: '#e5c99a',
                  color: '#b07d36',
                  background: '#fffbf5',
                }}
              >
                <Plus size={13} /> New question
              </button>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT: Authoring form + preview
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {editingId ? 'Editing question' : 'New question'}
              </h2>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw size={11} /> Cancel edit
                </button>
              )}
            </div>

            {/* ── Question text + marks ── */}
            <Card>
              <CardSection label="Question">
                <label className="block text-[11px] text-gray-500 mb-1">
                  Question text
                </label>
                <textarea
                  value={form.questionText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, questionText: e.target.value }))
                  }
                  placeholder="e.g. A bag contains 4 red and 2 blue balls..."
                  rows={3}
                  className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none transition-all"
                />
                <div className="mt-3">
                  <label className="block text-[11px] text-gray-500 mb-1">
                    Marks
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.marks}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, marks: e.target.value }))
                    }
                    className="w-20 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all text-center"
                  />
                </div>
              </CardSection>
            </Card>

            {/* ── Tree builder ── */}
            <Card>
              <CardSection label="Stage 1 — First draw">
                <p className="text-[11px] text-gray-400 mb-3">
                  Two branches from the root.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {([0, 1] as const).map((i) => (
                    <BranchEditor
                      key={i}
                      label={`Branch ${i + 1}`}
                      branch={form.s1[i]}
                      onOutcome={(v) => updateS1(i, 'outcome', v)}
                      onNum={(v) => updateS1(i, 'num', v)}
                      onDen={(v) => updateS1(i, 'den', v)}
                      onHidden={(v) => updateS1(i, 'hidden', v)}
                      onHighlight={(v) => updateS1(i, 'highlight', v)}
                    />
                  ))}
                </div>
              </CardSection>

              <div className="border-t border-gray-100 mt-4 pt-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Stage 2 — Second draw
                </p>
                <p className="text-[11px] text-gray-400 mb-4">
                  Two branches hang off each stage-1 outcome.
                </p>

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{ background: '#fef3c7', color: '#92400e' }}
                    >
                      Given: {form.s1[0].outcome || 'Branch 1'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {([0, 1] as const).map((i) => (
                      <BranchEditor
                        key={i}
                        label={`Branch ${i + 1}`}
                        branch={form.s2[i]}
                        onOutcome={(v) => updateS2(i, 'outcome', v)}
                        onNum={(v) => updateS2(i, 'num', v)}
                        onDen={(v) => updateS2(i, 'den', v)}
                        onHidden={(v) => updateS2(i, 'hidden', v)}
                        onHighlight={(v) => updateS2(i, 'highlight', v)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{ background: '#fef3c7', color: '#92400e' }}
                    >
                      Given: {form.s1[1].outcome || 'Branch 2'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {([2, 3] as const).map((i) => (
                      <BranchEditor
                        key={i}
                        label={`Branch ${i - 1}`}
                        branch={form.s2[i]}
                        onOutcome={(v) => updateS2(i, 'outcome', v)}
                        onNum={(v) => updateS2(i, 'num', v)}
                        onDen={(v) => updateS2(i, 'den', v)}
                        onHidden={(v) => updateS2(i, 'hidden', v)}
                        onHighlight={(v) => updateS2(i, 'highlight', v)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Path probabilities ── */}
            <Card>
              <CardSection label="Path probabilities (optional)">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <div
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        showPathProbs: !f.showPathProbs,
                      }))
                    }
                    className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                    style={{
                      background: form.showPathProbs ? '#F5A623' : '#d1d5db',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{
                        transform: form.showPathProbs
                          ? 'translateX(18px)'
                          : 'translateX(2px)',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">
                    Show path probabilities column
                  </span>
                </label>

                {form.showPathProbs && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400">
                      One row per terminal path (e.g. Red → Red).
                    </p>
                    {form.pathProbs.map((pp, i) => (
                      <PathProbEditor
                        key={i}
                        index={i}
                        pp={pp}
                        onChange={(field, value) =>
                          updatePathProb(i, field, value)
                        }
                      />
                    ))}
                  </div>
                )}
              </CardSection>
            </Card>

            {/* ── Mark scheme + worked solution ── */}
            <Card>
              <CardSection label="Mark scheme & worked solution">
                <label className="block text-[11px] text-gray-500 mb-1">
                  Worked solution
                </label>
                <textarea
                  value={form.workedSolution}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workedSolution: e.target.value }))
                  }
                  placeholder="Step-by-step solution shown to students after attempting…"
                  rows={4}
                  className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none transition-all"
                />

                <div className="mt-4 flex items-center justify-between mb-1">
                  <label className="block text-[11px] text-gray-500">
                    Mark scheme (JSON array)
                  </label>
                  <button
                    onClick={handleGenerateMarkScheme}
                    disabled={
                      generatingMarkScheme ||
                      !form.questionText.trim() ||
                      !form.workedSolution.trim()
                    }
                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                    style={{
                      background: '#FEF9F0',
                      color: '#F5A623',
                      border: '1px solid #F5A623',
                    }}
                  >
                    {generatingMarkScheme ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />{' '}
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} /> Generate
                      </>
                    )}
                  </button>
                </div>

                {markSchemeError && (
                  <p className="text-[11px] text-red-500 mb-2">
                    {markSchemeError}
                  </p>
                )}

                <textarea
                  value={form.markScheme}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, markScheme: e.target.value }))
                  }
                  placeholder={`[\n  {"criterion": "..."},\n  {"criterion": "..."}\n]`}
                  rows={8}
                  className="w-full text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Add question text and worked solution first, then click
                  Generate. Review before saving.
                </p>
              </CardSection>
            </Card>

            {/* ── Live preview ── */}
            <Card>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Eye size={13} className="text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Live preview
                </span>
              </div>
              <div className="px-5 py-5">
                {form.questionText && (
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                    {form.questionText}
                  </p>
                )}
                <div className="rounded-lg border border-gray-100 bg-white p-2 overflow-x-auto">
                  <ProbabilityTree config={previewConfig} />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  Updates as you type — no save needed to preview.
                </p>
              </div>
            </Card>

            {/* ── Save button ── */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving' || !form.questionText.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background:
                    saveStatus === 'success'
                      ? '#22c55e'
                      : saveStatus === 'error'
                        ? '#ef4444'
                        : '#E23D28',
                }}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <CheckCircle2 size={14} /> Saved!
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <AlertTriangle size={14} /> Error — try again
                  </>
                ) : (
                  <>
                    <Save size={14} />{' '}
                    {editingId ? 'Update question' : 'Save question'}
                  </>
                )}
              </button>

              {saveStatus === 'error' && saveError && (
                <p className="text-xs text-red-500">{saveError}</p>
              )}

              {!editingId && (
                <button
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw size={11} /> Reset form
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden">
      {children}
    </div>
  );
}

function CardSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

interface BranchEditorProps {
  label: string;
  branch: BranchForm;
  onOutcome: (v: string) => void;
  onNum: (v: string) => void;
  onDen: (v: string) => void;
  onHidden: (v: boolean) => void;
  onHighlight: (v: boolean) => void;
}

function BranchEditor({
  label,
  branch,
  onOutcome,
  onNum,
  onDen,
  onHidden,
  onHighlight,
}: BranchEditorProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2.5 border border-gray-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">Outcome</label>
        <input
          type="text"
          value={branch.outcome}
          onChange={(e) => onOutcome(e.target.value)}
          placeholder="e.g. Red"
          className="w-full text-sm bg-white border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-400 block mb-1">
          Probability
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            value={branch.num}
            onChange={(e) => onNum(e.target.value)}
            placeholder="num"
            className="w-14 text-sm text-center bg-white border border-gray-200 rounded-md px-1.5 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
          />
          <span className="text-gray-300 text-sm font-light">/</span>
          <input
            type="number"
            min={1}
            value={branch.den}
            onChange={(e) => onDen(e.target.value)}
            placeholder="den"
            className="w-14 text-sm text-center bg-white border border-gray-200 rounded-md px-1.5 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      </div>
      <div className="flex items-center gap-4 pt-1">
        <CheckboxField
          label="Hidden"
          checked={branch.hidden}
          onChange={onHidden}
          title="Blank placeholder (student fills in)"
        />
        <CheckboxField
          label="Highlight"
          checked={branch.highlight}
          onChange={onHighlight}
          title="Draw in brand red"
          accentRed
        />
      </div>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  title,
  accentRed,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
  accentRed?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
        style={accentRed && checked ? { accentColor: '#E23D28' } : {}}
      />
      <span
        className="text-[10px] text-gray-500"
        style={accentRed && checked ? { color: '#E23D28' } : {}}
      >
        {label}
      </span>
    </label>
  );
}

interface PathProbEditorProps {
  index: number;
  pp: PathProbForm;
  onChange: (field: keyof PathProbForm, value: string | boolean) => void;
}

function PathProbEditor({ index, pp, onChange }: PathProbEditorProps) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
      <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">
        #{index + 1}
      </span>
      <input
        type="text"
        value={pp.path0}
        onChange={(e) => onChange('path0', e.target.value)}
        placeholder="Stage 1"
        className="w-20 text-xs bg-white border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
      />
      <span className="text-gray-300 text-xs">→</span>
      <input
        type="text"
        value={pp.path1}
        onChange={(e) => onChange('path1', e.target.value)}
        placeholder="Stage 2"
        className="w-20 text-xs bg-white border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
      />
      <span className="text-gray-300 text-xs">=</span>
      <input
        type="number"
        value={pp.num}
        onChange={(e) => onChange('num', e.target.value)}
        placeholder="num"
        className="w-12 text-xs text-center bg-white border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
      />
      <span className="text-gray-300 text-xs">/</span>
      <input
        type="number"
        value={pp.den}
        onChange={(e) => onChange('den', e.target.value)}
        placeholder="den"
        className="w-12 text-xs text-center bg-white border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:border-amber-400 transition-colors"
      />
      <CheckboxField
        label="Red"
        checked={pp.highlight}
        onChange={(v) => onChange('highlight', v)}
        accentRed
      />
    </div>
  );
}

interface QuestionCardProps {
  question: SeededQuestion;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function QuestionCard({
  question,
  isEditing,
  isDeleting,
  onEdit,
  onDelete,
}: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all"
      style={{
        borderColor: isEditing ? '#F5A623' : 'rgba(0,0,0,0.06)',
        boxShadow: isEditing ? '0 0 0 2px rgba(245,166,35,0.15)' : undefined,
      }}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#fef3c7', color: '#92400e' }}
              >
                Q{question.question_order}
              </span>
              <span className="text-[10px] text-gray-400">
                {question.marks} mark{question.marks !== 1 ? 's' : ''}
              </span>
              {isEditing && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: '#FEF9F0', color: '#F5A623' }}
                >
                  Editing
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
              {question.question_text}
            </p>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: '#F5A623' }}
          >
            <Edit3 size={11} /> Edit
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
          >
            {isDeleting ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Deleting…
              </>
            ) : (
              <>
                <Trash2 size={11} /> Delete
              </>
            )}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50">
          <div className="overflow-x-auto">
            <ProbabilityTree config={question.diagram_params} />
          </div>
        </div>
      )}
    </div>
  );
}
