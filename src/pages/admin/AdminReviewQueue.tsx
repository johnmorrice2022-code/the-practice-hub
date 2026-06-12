// src/pages/admin/AdminReviewQueue.tsx
//
// Admin — Question Review Queue
// Route: /admin/review-queue
//
// Three views:
//   1. Queue view  — subtopic list with pending counts + Generate button
//                    + collapsible "Add/Edit Seeded Question" panel per subtopic
//   2. Review mode — one question at a time, keyboard shortcuts A/E/R/←/→
//   3. Publish view — approve → publish to live questions table

import {
  Component,
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  useMemo,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QuestionCard } from '@/components/practice/QuestionCard';
import { renderMathInText } from '@/lib/renderMathInText';
import {
  QUESTION_DIAGRAM_REGISTRY,
  isQuestionSafe,
} from '@/components/diagrams/questionDiagramRegistry';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Pencil,
  Upload,
  Loader2,
  LayoutDashboard,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Trash2,
  Eye,
  EyeOff,
  ImageIcon,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';
const SUPABASE_URL = 'https://wgcxwtgspmfnzugszhdc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnY3h3dGdzcG1mbnp1Z3N6aGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njk3OTgsImV4cCI6MjA5MDQ0NTc5OH0.mQbnr9m5MHzcqALxHRcqvLOhYNM-c2L7YjH9kiSDfxY';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subtopic {
  id: string;
  subtopic_name: string;
  topic: string;
  tier: string;
  subject: string;
  grade_band: string;
  slug: string;
}

interface SubtopicWithCounts extends Subtopic {
  pending: number;
  approved: number;
  published: number;
}

interface PendingQuestion {
  id: string;
  question_text: string;
  marks: number;
  mark_scheme: any[];
  worked_solution: string;
  parts: any[];
  calculator_allowed: boolean | null;
  status: string;
  prompt_version: string;
  batch_id: string;
  diagram_component: string | null;
  diagram_params: unknown;
}

interface SeededQuestion {
  id: string;
  subtopic_id: string;
  question_order: number;
  question_text: string;
  marks: number;
  mark_scheme: unknown;
  worked_solution: string | null;
  diagram_url: string | null;
  diagram_component: string | null;
  diagram_params: unknown;
  created_at: string;
}

type View = 'queue' | 'review';

// ─── Seeded question form state ───────────────────────────────────────────────

interface SeededFormState {
  questionText: string;
  marks: string;
  markScheme: string;
  workedSolution: string;
  diagramFile: File | null;
  diagramPreviewUrl: string | null;
}

function emptySeededForm(): SeededFormState {
  return {
    questionText: '',
    marks: '3',
    markScheme: '',
    workedSolution: '',
    diagramFile: null,
    diagramPreviewUrl: null,
  };
}

// ─── KaTeX preview ────────────────────────────────────────────────────────────

function MathPreview({ text, label }: { text: string; label: string }) {
  if (!text.trim()) return null;
  return (
    <div className="rounded-lg border border-amber-100 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 mb-2">
        {label} preview
      </p>
      <div
        className="text-sm text-gray-800 leading-relaxed question-text"
        dangerouslySetInnerHTML={{ __html: renderMathInText(text) }}
      />
    </div>
  );
}

// ─── Diagram review panel ─────────────────────────────────────────────────────
//
// Renders a pending question's parametric diagram through the registry so the
// reviewer sees exactly what the student (question view) and the worked
// solution (worked-solution view) will show — never raw JSON. This is the gate
// for all AI diagram wiring: malformed or unknown params surface a clear
// warning and must never crash the queue.

function DiagramWarning({
  tone = 'red',
  title,
  detail,
}: {
  tone?: 'red' | 'amber';
  title: string;
  detail?: string;
}) {
  const red = tone === 'red';
  return (
    <div
      className="rounded-lg border p-3 flex items-start gap-2"
      style={{
        background: red ? '#FEF2F2' : '#FFFBEB',
        borderColor: red ? '#FCA5A5' : '#FDE68A',
      }}
    >
      <AlertTriangle
        size={14}
        className="mt-0.5 shrink-0"
        style={{ color: red ? '#dc2626' : '#d97706' }}
      />
      <div>
        <p
          className="text-xs font-semibold"
          style={{ color: red ? '#b91c1c' : '#92400e' }}
        >
          {title}
        </p>
        {detail && (
          <p
            className="text-[11px] mt-0.5 leading-snug"
            style={{ color: red ? '#7f1d1d' : '#78350f' }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// Catches a throwing diagram component so a malformed-params render can never
// crash the review queue. Resets when resetKey changes (mode toggle).
class DiagramErrorBoundary extends Component<
  { resetKey: string; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { resetKey: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message ?? 'Render error' };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <DiagramWarning
          tone="red"
          title="This diagram crashed while rendering."
          detail={`${this.state.message} — do not approve until the params are fixed.`}
        />
      );
    }
    return this.props.children;
  }
}

// Remount per question (keyed by question id in the parent) so the view toggle
// always resets to the question view for each new question.
function DiagramReviewPanel({
  component,
  params,
}: {
  component: string;
  params: unknown;
}) {
  const [viewMode, setViewMode] = useState<'question' | 'feedback'>('question');
  const containerRef = useRef<HTMLDivElement>(null);
  const [noRender, setNoRender] = useState(false);

  // diagram_params is occasionally stored as a JSON string scalar — normalise.
  const parsed = useMemo(() => {
    if (typeof params === 'string') {
      try {
        return JSON.parse(params);
      } catch {
        return params;
      }
    }
    return params;
  }, [params]);

  const entry = QUESTION_DIAGRAM_REGISTRY[component];
  const RegisteredComponent = entry?.component ?? null;
  const isObjectParams =
    parsed != null && typeof parsed === 'object' && !Array.isArray(parsed);
  const safe = isQuestionSafe(component, parsed);

  // In question view a non-question-safe diagram deliberately shows nothing to
  // the student, so don't run (or warn about) the empty-render check there.
  const attemptingRender =
    !!entry && isObjectParams && !(viewMode === 'question' && !safe);

  // Detect a component that rendered nothing (malformed but non-throwing — our
  // components warn + return null on bad params). The boundary renders children
  // with no wrapper, so an empty container means the component produced no DOM.
  useLayoutEffect(() => {
    if (!attemptingRender) {
      setNoRender(false);
      return;
    }
    setNoRender((containerRef.current?.childElementCount ?? 0) === 0);
  }, [attemptingRender, parsed, viewMode]);

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ImageIcon size={13} className="text-gray-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Diagram preview
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-500">
            {component}
          </span>
        </div>
        <div className="flex items-center rounded-lg border border-black/10 overflow-hidden">
          <button
            onClick={() => setViewMode('question')}
            className="text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide transition-colors"
            style={
              viewMode === 'question'
                ? { background: '#F5A623', color: 'white' }
                : { background: 'transparent', color: '#9ca3af' }
            }
          >
            Question view
          </button>
          <button
            onClick={() => setViewMode('feedback')}
            className="text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide transition-colors"
            style={
              viewMode === 'feedback'
                ? { background: '#E23D28', color: 'white' }
                : { background: 'transparent', color: '#9ca3af' }
            }
          >
            Worked-solution view
          </button>
        </div>
      </div>

      {/* Warnings */}
      {!entry && (
        <DiagramWarning
          tone="red"
          title={`Unknown diagram component "${component}".`}
          detail="Not in the registry — the student will see no diagram. Fix the component key before approving."
        />
      )}
      {entry && !isObjectParams && (
        <DiagramWarning
          tone="red"
          title="Diagram params are missing or malformed."
          detail="diagram_params is not a JSON object, so nothing will render. Do not approve until this is fixed."
        />
      )}
      {entry && isObjectParams && viewMode === 'question' && !safe && (
        <DiagramWarning
          tone="amber"
          title="Worked-solution-only diagram."
          detail="Not question-safe: the student sees no diagram on the question itself. Switch to Worked-solution view to check it."
        />
      )}
      {attemptingRender && noRender && (
        <DiagramWarning
          tone="amber"
          title="Nothing rendered for these params."
          detail="The component rejected the params (see the browser console). Check the JSON below before approving."
        />
      )}

      {/* Render */}
      {entry && isObjectParams && (
        <div
          ref={containerRef}
          className="rounded-xl border border-black/5"
          style={{ background: '#FAF7F2' }}
        >
          {viewMode === 'question' && !safe ? (
            <div className="py-8 text-center text-[11px] text-gray-400 italic">
              No diagram shown to the student on the question.
            </div>
          ) : (
            <DiagramErrorBoundary resetKey={viewMode}>
              {RegisteredComponent && (
                <RegisteredComponent params={parsed} mode={viewMode} />
              )}
            </DiagramErrorBoundary>
          )}
        </div>
      )}

      {/* Raw params for cross-checking */}
      <details className="text-[11px]">
        <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">
          Raw diagram_params
        </summary>
        <pre className="mt-2 bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto font-mono text-[10px] text-gray-600">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ─── Seeded Question List Card ────────────────────────────────────────────────

function SeededQuestionListCard({
  q,
  isEditing,
  onEdit,
  onDelete,
}: {
  q: SeededQuestion;
  isEditing: boolean;
  onEdit: (q: SeededQuestion) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this seeded question? This cannot be undone.')) return;
    setDeleting(true);
    const { error } = await supabase
      .from('seeded_questions')
      .delete()
      .eq('id', q.id);
    if (error) {
      alert('Delete failed: ' + error.message);
      setDeleting(false);
    } else {
      onDelete(q.id);
    }
  }

  return (
    <div
      className="border rounded-lg bg-white overflow-hidden transition-all"
      style={{
        borderColor: isEditing ? '#F5A623' : 'rgba(0,0,0,0.06)',
        boxShadow: isEditing ? '0 0 0 2px rgba(245,166,35,0.15)' : undefined,
      }}
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold"
          style={{ background: '#fef3c7', color: '#92400e' }}
        >
          {q.question_order}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 line-clamp-2 leading-snug">
            {q.question_text}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-gray-400">
              {q.marks} mark{q.marks !== 1 ? 's' : ''}
            </span>
            {isEditing && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#FEF9F0', color: '#F5A623' }}
              >
                Editing
              </span>
            )}
            {q.diagram_url && (
              <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">
                image
              </span>
            )}
            {q.diagram_component && (
              <span className="text-[10px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded font-medium">
                {q.diagram_component}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 text-gray-300 hover:text-gray-500 rounded transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={() => onEdit(q)}
            className="p-1.5 text-gray-300 hover:text-amber-500 rounded transition-colors"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-300 hover:text-red-400 rounded transition-colors"
            title="Delete"
          >
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-3 pb-3 pt-2 bg-gray-50/60 space-y-2">
          {q.diagram_url && (
            <img
              src={q.diagram_url}
              alt="Question diagram"
              className="max-h-32 rounded border border-gray-100 object-contain"
            />
          )}
          {q.mark_scheme && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Mark scheme
              </p>
              <pre className="text-[11px] text-gray-600 whitespace-pre-wrap bg-white border border-gray-100 rounded p-2 max-h-28 overflow-y-auto font-mono">
                {typeof q.mark_scheme === 'string'
                  ? q.mark_scheme
                  : JSON.stringify(q.mark_scheme, null, 2)}
              </pre>
            </div>
          )}
          {q.worked_solution && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Worked solution
              </p>
              <p className="text-[11px] text-gray-600 whitespace-pre-wrap">
                {q.worked_solution}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seeded Question Panel ────────────────────────────────────────────────────

function SeededQuestionPanel({ subtopic }: { subtopic: SubtopicWithCounts }) {
  const [seededQuestions, setSeededQuestions] = useState<SeededQuestion[]>([]);
  const [loadingSeeded, setLoadingSeeded] = useState(true);
  const [form, setForm] = useState<SeededFormState>(emptySeededForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState('');
  const [generatingMarkScheme, setGeneratingMarkScheme] = useState(false);
  const [markSchemeError, setMarkSchemeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoadingSeeded(true);
      const { data, error } = await supabase
        .from('seeded_questions')
        .select('*')
        .eq('subtopic_id', subtopic.id)
        .order('question_order', { ascending: true });
      if (!error && data) setSeededQuestions(data as SeededQuestion[]);
      setLoadingSeeded(false);
    }
    load();
  }, [subtopic.id]);

  function handleEditSeeded(q: SeededQuestion) {
    setEditingId(q.id);
    setForm({
      questionText: q.question_text,
      marks: String(q.marks),
      markScheme:
        typeof q.mark_scheme === 'string'
          ? q.mark_scheme
          : JSON.stringify(q.mark_scheme ?? [], null, 2),
      workedSolution: q.worked_solution ?? '',
      diagramFile: null,
      diagramPreviewUrl: q.diagram_url ?? null,
    });
    setMarkSchemeError('');
    setSaveStatus('idle');
    setSaveError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptySeededForm());
    setSaveStatus('idle');
    setSaveError('');
    setMarkSchemeError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (form.diagramPreviewUrl && form.diagramFile) {
      URL.revokeObjectURL(form.diagramPreviewUrl);
    }
    setForm((f) => ({
      ...f,
      diagramFile: file,
      diagramPreviewUrl: URL.createObjectURL(file),
    }));
  }

  function clearDiagram() {
    if (form.diagramPreviewUrl && form.diagramFile) {
      URL.revokeObjectURL(form.diagramPreviewUrl);
    }
    setForm((f) => ({ ...f, diagramFile: null, diagramPreviewUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadDiagram(): Promise<string | null> {
    if (!form.diagramFile) return null;
    const subject = subtopic.subject.toLowerCase().replace(/\s+/g, '-');
    const topic = subtopic.topic.toLowerCase().replace(/\s+/g, '-');
    const slug = subtopic.slug;
    const ext = form.diagramFile.name.split('.').pop() ?? 'png';
    const path = `diagrams/${subject}/${topic}/${slug}/seeded-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('diagrams')
      .upload(path, form.diagramFile, { upsert: false });

    if (error) {
      alert('Diagram upload failed: ' + error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('diagrams')
      .getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleGenerateMarkScheme() {
    if (!form.questionText.trim()) {
      setMarkSchemeError('Add question text first.');
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
            marksAvailable: parseInt(form.marks, 10) || 3,
            workedSolution: form.workedSolution.trim(),
            diagramComponent: null,
            diagramParams: null,
            examBoard: subtopic.subject.toLowerCase().includes('maths')
              ? 'Edexcel'
              : 'AQA',
            subject: subtopic.subject,
            tier: subtopic.tier,
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f) => ({
        ...f,
        markScheme: JSON.stringify(data.markScheme, null, 2),
      }));
    } catch (e: any) {
      setMarkSchemeError(e.message || 'Generation failed — try again.');
    } finally {
      setGeneratingMarkScheme(false);
    }
  }

  async function handleSave() {
    if (!form.questionText.trim()) {
      alert('Question text is required.');
      return;
    }
    if (!form.markScheme.trim()) {
      alert('Mark scheme is required.');
      return;
    }

    setSaveStatus('saving');
    setSaveError('');

    const newDiagramUrl = await uploadDiagram();
    if (form.diagramFile && !newDiagramUrl) {
      setSaveStatus('error');
      setSaveError('Diagram upload failed.');
      return;
    }

    let markSchemeValue: unknown;
    try {
      markSchemeValue = JSON.parse(form.markScheme);
    } catch {
      markSchemeValue = form.markScheme
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ criterion: line.trim() }));
    }

    const fields = {
      question_text: form.questionText.trim(),
      marks: parseInt(form.marks, 10) || 3,
      mark_scheme: markSchemeValue,
      worked_solution: form.workedSolution.trim() || null,
      ...(newDiagramUrl ? { diagram_url: newDiagramUrl } : {}),
    };

    if (editingId) {
      const { error } = await supabase
        .from('seeded_questions')
        .update(fields)
        .eq('id', editingId);

      if (error) {
        setSaveStatus('error');
        setSaveError(error.message);
        return;
      }

      setSeededQuestions((prev) =>
        prev.map((q) =>
          q.id === editingId
            ? { ...q, ...fields, diagram_url: newDiagramUrl ?? q.diagram_url }
            : q
        )
      );
    } else {
      const maxOrder = seededQuestions.reduce(
        (m, q) => Math.max(m, q.question_order),
        0
      );

      const { data: inserted, error } = await supabase
        .from('seeded_questions')
        .insert({
          subtopic_id: subtopic.id,
          question_order: maxOrder + 1,
          diagram_url: newDiagramUrl ?? null,
          diagram_component: null,
          diagram_params: null,
          ...fields,
        })
        .select()
        .single();

      if (error) {
        setSaveStatus('error');
        setSaveError(error.message);
        return;
      }

      setSeededQuestions((prev) => [...prev, inserted as SeededQuestion]);
    }

    setSaveStatus('success');

    setTimeout(() => {
      if (form.diagramFile && form.diagramPreviewUrl) {
        URL.revokeObjectURL(form.diagramPreviewUrl);
      }
      setForm(emptySeededForm());
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSaveStatus('idle');
      setSaveError('');
      setMarkSchemeError('');
      setEditingId(null);
    }, 1500);
  }

  function handleDeleteSeeded(id: string) {
    setSeededQuestions((prev) => prev.filter((q) => q.id !== id));
    if (editingId === id) cancelEdit();
  }

  const parametricCount = seededQuestions.filter(
    (q) => q.diagram_component !== null
  ).length;

  return (
    <div
      className="mt-2 rounded-xl overflow-hidden border"
      style={{ borderColor: 'rgba(245,166,35,0.3)', background: '#fffcf5' }}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{
          borderColor: 'rgba(245,166,35,0.2)',
          background: 'rgba(245,166,35,0.06)',
        }}
      >
        <BookOpen size={13} style={{ color: '#F5A623' }} />
        <span className="text-xs font-semibold" style={{ color: '#b07d36' }}>
          Seeded Questions
        </span>
        <span className="ml-auto text-[11px]" style={{ color: '#b07d36' }}>
          {seededQuestions.length} total
          {parametricCount > 0 &&
            ` · ${parametricCount} parametric · ${seededQuestions.length - parametricCount} image/text`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-amber-100">
        {/* ── LEFT: existing questions ─────────────────────────────── */}
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Current Questions
          </p>

          {loadingSeeded ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          ) : seededQuestions.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4">
              No seeded questions yet for this subtopic.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {seededQuestions.map((q) => (
                <SeededQuestionListCard
                  key={q.id}
                  q={q}
                  isEditing={editingId === q.id}
                  onEdit={handleEditSeeded}
                  onDelete={handleDeleteSeeded}
                />
              ))}
            </div>
          )}

          {parametricCount > 0 && (
            <p className="text-[10px] text-gray-400 italic mt-3">
              {parametricCount} parametric question
              {parametricCount !== 1 ? 's' : ''} (e.g. probability trees) — edit
              via their dedicated admin form.
            </p>
          )}
        </div>

        {/* ── RIGHT: form ──────────────────────────────────────────── */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {editingId ? 'Editing Question' : 'Add Question'}
            </p>
            {editingId && (
              <button
                onClick={cancelEdit}
                className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              >
                <X size={10} /> Cancel edit
              </button>
            )}
          </div>

          {/* Question text */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Question text <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.questionText}
              onChange={(e) =>
                setForm((f) => ({ ...f, questionText: e.target.value }))
              }
              rows={4}
              placeholder="e.g. Expand and simplify $3(x + 4) + 2(x - 1)$"
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 bg-white transition-all font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">$...$</code> for
              inline maths and{' '}
              <code className="bg-gray-100 px-1 rounded">$$...$$</code> for
              display maths.
            </p>
          </div>

          {/* Live question preview */}
          <MathPreview text={form.questionText} label="Question" />

          {/* Marks */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Marks
            </label>
            <input
              type="number"
              min={1}
              max={12}
              value={form.marks}
              onChange={(e) =>
                setForm((f) => ({ ...f, marks: e.target.value }))
              }
              className="w-20 text-sm border border-gray-200 rounded-lg p-2 text-center focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 bg-white transition-all"
            />
          </div>

          {/* Diagram upload */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Diagram (optional)
            </label>
            {form.diagramPreviewUrl ? (
              <div className="space-y-2">
                <img
                  src={form.diagramPreviewUrl}
                  alt="Diagram preview"
                  className="max-h-32 rounded-lg border border-gray-200 object-contain"
                />
                <button
                  onClick={clearDiagram}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={11} /> Remove diagram
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-lg p-3 text-[11px] text-gray-400 hover:border-amber-300 hover:text-amber-500 transition-all"
              >
                <ImageIcon size={13} /> Upload SVG / PNG / JPG
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Worked solution */}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              Worked solution
            </label>
            <textarea
              value={form.workedSolution}
              onChange={(e) =>
                setForm((f) => ({ ...f, workedSolution: e.target.value }))
              }
              rows={3}
              placeholder="Step-by-step solution shown to students after attempting…"
              className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 bg-white transition-all font-mono"
            />
          </div>

          {/* Live worked solution preview */}
          <MathPreview text={form.workedSolution} label="Worked solution" />

          {/* Mark scheme */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] text-gray-500">
                Mark scheme (JSON or plain text){' '}
                <span className="text-red-400">*</span>
              </label>
              <button
                onClick={handleGenerateMarkScheme}
                disabled={
                  generatingMarkScheme ||
                  !form.questionText.trim() ||
                  !form.workedSolution.trim()
                }
                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{
                  background: '#FEF9F0',
                  color: '#F5A623',
                  border: '1px solid rgba(245,166,35,0.4)',
                }}
              >
                {generatingMarkScheme ? (
                  <>
                    <Loader2 size={10} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={10} /> Generate
                  </>
                )}
              </button>
            </div>

            {markSchemeError && (
              <p className="text-[11px] text-red-500 mb-1.5">
                {markSchemeError}
              </p>
            )}

            <textarea
              value={form.markScheme}
              onChange={(e) =>
                setForm((f) => ({ ...f, markScheme: e.target.value }))
              }
              rows={6}
              placeholder={`[\n  {"mark_type": "M1", "criterion": "Correct expansion of both brackets", "marks": 1},\n  {"mark_type": "A1", "criterion": "$5x + 10$", "marks": 1}\n]`}
              className="w-full text-xs font-mono border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 bg-white transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Add question text + worked solution first, then click Generate.
              Always review before saving.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !form.questionText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
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
                <Loader2 size={13} className="animate-spin" /> Saving…
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle2 size={13} />{' '}
                {editingId ? 'Updated' : 'Saved — live now'}
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertTriangle size={13} /> Error — try again
              </>
            ) : (
              <>
                <Save size={13} />{' '}
                {editingId ? 'Update question' : 'Save seeded question'}
              </>
            )}
          </button>

          {saveStatus === 'error' && saveError && (
            <p className="text-xs text-red-500 -mt-2">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminReviewQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<View>('queue');
  const [subtopics, setSubtopics] = useState<SubtopicWithCounts[]>([]);
  const [loadingSubtopics, setLoadingSubtopics] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<'Maths' | 'Physics'>(
    searchParams.get('subject') === 'Physics' ? 'Physics' : 'Maths'
  );
  const [selectedSubtopic, setSelectedSubtopic] =
    useState<SubtopicWithCounts | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [seededPanelOpenFor, setSeededPanelOpenFor] = useState<string | null>(
    null
  );

  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Partial<PendingQuestion>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

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

  const loadSubtopics = useCallback(async () => {
    setLoadingSubtopics(true);
    try {
      const { data: subs } = await supabase
        .from('subtopics')
        .select('id, subtopic_name, topic, tier, subject, grade_band, slug')
        .ilike('subject', subjectFilter === 'Maths' ? '%math%' : '%physics%')
        .order('topic')
        .order('subtopic_name');

      if (!subs) return;

      const { data: counts } = await supabase
        .from('pending_questions')
        .select('subtopic_id, status');

      const countMap: Record<
        string,
        { pending: number; approved: number; published: number }
      > = {};
      for (const row of counts ?? []) {
        if (!countMap[row.subtopic_id]) {
          countMap[row.subtopic_id] = { pending: 0, approved: 0, published: 0 };
        }
        if (row.status === 'pending') countMap[row.subtopic_id].pending++;
        if (row.status === 'approved') countMap[row.subtopic_id].approved++;
        if (row.status === 'published') countMap[row.subtopic_id].published++;
      }

      const withCounts: SubtopicWithCounts[] = subs.map((s) => ({
        ...s,
        pending: countMap[s.id]?.pending ?? 0,
        approved: countMap[s.id]?.approved ?? 0,
        published: countMap[s.id]?.published ?? 0,
      }));

      setSubtopics(withCounts);
    } finally {
      setLoadingSubtopics(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    if (authed) loadSubtopics();
  }, [authed, loadSubtopics, subjectFilter]);

  // Auto-select subtopic from URL param ?subtopicId=
  useEffect(() => {
    const paramId = searchParams.get('subtopicId');
    if (!paramId || subtopics.length === 0) return;
    const match = subtopics.find(s => s.id === paramId);
    if (match) setSelectedSubtopic(match);
  }, [subtopics, searchParams]);

  async function handleGenerate(subtopic: SubtopicWithCounts) {
    setGeneratingFor(subtopic.id);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-pending-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            subtopicId: subtopic.id,
            count: 20,
            ...(subjectFilter === 'Physics' && { physicsTier: subtopic.tier }),
          }),
        }
      );
      if (!res.ok) throw new Error('Generation failed');
      await loadSubtopics();
    } catch (e) {
      console.error(e);
      alert('Generation failed — check console');
    } finally {
      setGeneratingFor(null);
    }
  }

  function toggleSeededPanel(subtopicId: string) {
    setSeededPanelOpenFor((current) =>
      current === subtopicId ? null : subtopicId
    );
  }

  async function enterReview(subtopic: SubtopicWithCounts) {
    setSelectedSubtopic(subtopic);
    setLoadingQuestions(true);
    setView('review');
    setCurrentIndex(0);
    setEditMode(false);
    setSeededPanelOpenFor(null);

    const { data } = await supabase
      .from('pending_questions')
      .select('*')
      .eq('subtopic_id', subtopic.id)
      .eq('status', 'pending')
      .order('created_at');

    setQuestions(data ?? []);
    setLoadingQuestions(false);
  }

  const currentQuestion = questions[currentIndex] ?? null;

  async function handleApprove() {
    if (!currentQuestion || savingAction) return;
    setSavingAction(true);
    await supabase
      .from('pending_questions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', currentQuestion.id);
    advanceOrFinish();
    setSavingAction(false);
  }

  async function handleReject() {
    if (!currentQuestion || savingAction) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setSavingAction(true);
    await supabase
      .from('pending_questions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', currentQuestion.id);
    setShowRejectInput(false);
    setRejectReason('');
    advanceOrFinish();
    setSavingAction(false);
  }

  async function handleSaveEdit() {
    if (!currentQuestion || savingAction) return;
    setSavingAction(true);

    const editRows: any[] = [];
    for (const [field, newVal] of Object.entries(editFields)) {
      const oldVal = (currentQuestion as any)[field];
      const oldStr =
        typeof oldVal === 'object'
          ? JSON.stringify(oldVal)
          : String(oldVal ?? '');
      const newStr =
        typeof newVal === 'object'
          ? JSON.stringify(newVal)
          : String(newVal ?? '');
      if (oldStr !== newStr) {
        editRows.push({
          pending_question_id: currentQuestion.id,
          field_name: field,
          old_value: oldStr,
          new_value: newStr,
        });
      }
    }
    if (editRows.length > 0) {
      await supabase.from('pending_question_edits').insert(editRows);
    }

    await supabase
      .from('pending_questions')
      .update({
        ...editFields,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', currentQuestion.id);

    setEditMode(false);
    setEditFields({});
    advanceOrFinish();
    setSavingAction(false);
  }

  function advanceOrFinish() {
    const updatedList = questions.map((q) =>
      q.id === currentQuestion?.id ? { ...q, status: 'done' } : q
    );
    setQuestions(updatedList);
    const nextPendingIndex = updatedList.findIndex(
      (q, i) => i > currentIndex && q.status === 'pending'
    );
    if (nextPendingIndex !== -1) {
      setCurrentIndex(nextPendingIndex);
    } else {
      loadSubtopics();
      setView('queue');
    }
  }

  function handlePrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  }

  useEffect(() => {
    if (view !== 'review' || editMode || showRejectInput) return;
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'a' || e.key === 'A') handleApprove();
      if (e.key === 'r' || e.key === 'R') handleReject();
      if (e.key === 'e' || e.key === 'E') {
        setEditMode(true);
        setEditFields({
          question_text: currentQuestion?.question_text ?? '',
          worked_solution: currentQuestion?.worked_solution ?? '',
          mark_scheme: currentQuestion?.mark_scheme ?? [],
        });
      }
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    view,
    editMode,
    showRejectInput,
    currentIndex,
    currentQuestion,
    questions,
  ]);

  async function handlePublish(subtopic: SubtopicWithCounts) {
    const { data: approved } = await supabase
      .from('pending_questions')
      .select('*')
      .eq('subtopic_id', subtopic.id)
      .eq('status', 'approved');

    if (!approved || approved.length === 0) {
      alert('No approved questions to publish.');
      return;
    }

    const liveRows = approved.map((q) => ({
      subtopic_id: q.subtopic_id,
      question_text: q.question_text,
      marks: q.marks,
      mark_scheme: q.mark_scheme ?? [],
      worked_solution: q.worked_solution ?? '',
      parts: q.parts ?? [],
      calculator_allowed: q.calculator_allowed,
      diagram_component: q.diagram_component ?? null,
      diagram_params: q.diagram_params ?? null,
      source: 'reviewed',
    }));

    const { error } = await supabase.from('questions').insert(liveRows);
    if (error) {
      alert(`Publish failed: ${error.message}`);
      return;
    }

    await supabase
      .from('pending_questions')
      .update({ status: 'published' })
      .eq('subtopic_id', subtopic.id)
      .eq('status', 'approved');

    await loadSubtopics();
    alert(
      `Published ${approved.length} questions for ${subtopic.subtopic_name}.`
    );
  }

  if (!authChecked || !authed) return null;

  // ─── Queue view ───────────────────────────────────────────────────────────

  if (view === 'queue') {
    return (
      <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
        <div
          className="sticky top-0 z-20 border-b"
          style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: '#E23D28' }}
              >
                <LayoutDashboard size={14} color="white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                Review Queue
              </span>
              <div className="flex items-center rounded-lg border border-black/10 overflow-hidden ml-1">
                <button
                  onClick={() => setSubjectFilter('Maths')}
                  className="text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide transition-colors"
                  style={subjectFilter === 'Maths'
                    ? { background: '#F5A623', color: 'white' }
                    : { background: 'transparent', color: '#9ca3af' }}
                >
                  Maths
                </button>
                <button
                  onClick={() => setSubjectFilter('Physics')}
                  className="text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide transition-colors"
                  style={subjectFilter === 'Physics'
                    ? { background: '#E23D28', color: 'white' }
                    : { background: 'transparent', color: '#9ca3af' }}
                >
                  Physics
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <X size={12} /> Exit
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6 text-xs text-gray-400 bg-white/60 rounded-lg px-4 py-3 border border-black/5">
            In review mode:{' '}
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
              A
            </kbd>{' '}
            approve &nbsp;
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
              E
            </kbd>{' '}
            edit &nbsp;
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
              R
            </kbd>{' '}
            reject &nbsp;
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono">
              ←→
            </kbd>{' '}
            navigate
          </div>

          {loadingSubtopics ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading subtopics…
            </div>
          ) : (
            <div className="space-y-2">
              {subtopics.map((s) => (
                <div key={s.id}>
                  <div className="bg-white rounded-xl border border-black/5 shadow-sm px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => s.pending > 0 && enterReview(s)}
                        className={`text-sm font-semibold text-left ${s.pending > 0 ? 'text-gray-800 hover:text-amber-600 cursor-pointer' : 'text-gray-400 cursor-default'}`}
                      >
                        {s.subtopic_name}
                      </button>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.topic} · {s.tier}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <span className="text-amber-500 font-semibold tabular-nums">
                        {s.pending} pending
                      </span>
                      <span className="text-green-600 font-semibold tabular-nums">
                        {s.approved} approved
                      </span>
                      <span className="text-gray-400 tabular-nums">
                        {s.published} published
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleSeededPanel(s.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                        style={
                          seededPanelOpenFor === s.id
                            ? {
                                background: 'rgba(245,166,35,0.1)',
                                borderColor: 'rgba(245,166,35,0.5)',
                                color: '#b07d36',
                              }
                            : {
                                borderColor: 'rgba(0,0,0,0.1)',
                                color: '#6b7280',
                              }
                        }
                      >
                        <BookOpen size={11} />
                        Seeded
                        {seededPanelOpenFor === s.id ? (
                          <ChevronUp size={10} />
                        ) : (
                          <ChevronDown size={10} />
                        )}
                      </button>

                      {s.approved > 0 && (
                        <button
                          onClick={() => handlePublish(s)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                          style={{ background: '#22c55e' }}
                        >
                          <Upload size={11} /> Publish {s.approved}
                        </button>
                      )}
                      {s.pending > 0 && (
                        <button
                          onClick={() => enterReview(s)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                          style={{ background: '#F5A623' }}
                        >
                          Review <ChevronRight size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => handleGenerate(s)}
                        disabled={generatingFor === s.id}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-black/10 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {generatingFor === s.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        Generate 20
                      </button>
                    </div>
                  </div>

                  {seededPanelOpenFor === s.id && (
                    <SeededQuestionPanel subtopic={s} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Review mode ──────────────────────────────────────────────────────────

  const pendingOnly = questions.filter((q) => q.status === 'pending');
  const reviewedCount = questions.length - pendingOnly.length;

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView('queue');
                loadSubtopics();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {selectedSubtopic?.subtopic_name}
            </span>
            <span className="text-xs text-gray-400">
              {selectedSubtopic?.tier}
            </span>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {reviewedCount} / {questions.length} reviewed
          </span>
        </div>
      </div>

      {loadingQuestions ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400 text-sm">
          No pending questions for this subtopic.
        </div>
      ) : currentQuestion ? (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {currentQuestion.calculator_allowed !== null && (
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${currentQuestion.calculator_allowed ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'}`}
              >
                {currentQuestion.calculator_allowed
                  ? 'Calculator'
                  : 'Non-calculator'}
              </span>
              <span className="text-[10px] text-gray-400">
                {currentQuestion.prompt_version}
              </span>
            </div>
          )}

          {!editMode ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
              <QuestionCard
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                questionText={currentQuestion.question_text}
                marks={currentQuestion.marks}
                parts={currentQuestion.parts ?? []}
                answer=""
                onAnswerChange={() => {}}
                partAnswers={{}}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 space-y-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                Editing question
              </p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Question text
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y"
                  rows={4}
                  value={editFields.question_text ?? ''}
                  onChange={(e) =>
                    setEditFields({
                      ...editFields,
                      question_text: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Worked solution
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y"
                  rows={4}
                  value={editFields.worked_solution ?? ''}
                  onChange={(e) =>
                    setEditFields({
                      ...editFields,
                      worked_solution: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Mark scheme (JSON)
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y"
                  rows={6}
                  value={
                    typeof editFields.mark_scheme === 'string'
                      ? editFields.mark_scheme
                      : JSON.stringify(editFields.mark_scheme ?? [], null, 2)
                  }
                  onChange={(e) => {
                    try {
                      setEditFields({
                        ...editFields,
                        mark_scheme: JSON.parse(e.target.value),
                      });
                    } catch {
                      setEditFields({
                        ...editFields,
                        mark_scheme: e.target.value as any,
                      });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {!editMode && currentQuestion.diagram_component && (
            <DiagramReviewPanel
              key={currentQuestion.id}
              component={currentQuestion.diagram_component}
              params={currentQuestion.diagram_params}
            />
          )}

          {!editMode && currentQuestion.mark_scheme && (
            <div className="bg-white/70 rounded-xl border border-black/5 p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Mark scheme
              </p>
              {currentQuestion.mark_scheme.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0 mt-0.5">
                    {item.mark_type}
                  </span>
                  <span className="text-gray-700">{item.criterion}</span>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">
                    {item.marks}m
                  </span>
                </div>
              ))}
            </div>
          )}

          {!editMode && currentQuestion.worked_solution && (
            <div className="bg-white/70 rounded-xl border border-black/5 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
                Worked solution
              </p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {currentQuestion.worked_solution}
              </pre>
            </div>
          )}

          {showRejectInput && (
            <div className="bg-red-50 rounded-xl border border-red-100 p-4 space-y-3">
              <p className="text-xs text-red-600 font-medium">
                Reason for rejection (optional)
              </p>
              <input
                autoFocus
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. wrong answer, poor wording, out of spec…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReject();
                  if (e.key === 'Escape') {
                    setShowRejectInput(false);
                    setRejectReason('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg text-white bg-red-500"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason('');
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg border border-black/10 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              className="p-2 rounded-lg border border-black/10 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={14} />
            </button>

            <div className="flex-1" />

            {editMode ? (
              <>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditFields({});
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-500"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingAction}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg text-white"
                  style={{ background: '#F5A623' }}
                >
                  {savingAction ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Save & approve
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  disabled={savingAction}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={12} /> Reject{' '}
                  <kbd className="ml-1 bg-red-50 px-1 rounded font-mono text-[10px]">
                    R
                  </kbd>
                </button>
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditFields({
                      question_text: currentQuestion.question_text,
                      worked_solution: currentQuestion.worked_solution,
                      mark_scheme: currentQuestion.mark_scheme,
                    });
                  }}
                  disabled={savingAction}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <Pencil size={12} /> Edit{' '}
                  <kbd className="ml-1 bg-amber-50 px-1 rounded font-mono text-[10px]">
                    E
                  </kbd>
                </button>
                <button
                  onClick={handleApprove}
                  disabled={savingAction}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg text-white transition-colors"
                  style={{ background: '#22c55e' }}
                >
                  {savingAction ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Approve{' '}
                  <kbd className="ml-1 bg-green-400/30 px-1 rounded font-mono text-[10px]">
                    A
                  </kbd>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400 text-sm">
          All questions reviewed.
          <button
            onClick={() => {
              setView('queue');
              loadSubtopics();
            }}
            className="ml-2 text-amber-500 underline"
          >
            Back to queue
          </button>
        </div>
      )}
    </div>
  );
}
