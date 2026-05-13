// src/pages/admin/AdminReviewQueue.tsx
//
// Admin — Question Review Queue
// Route: /admin/review-queue
//
// Three views:
//   1. Queue view  — subtopic list with pending counts + Generate button
//   2. Review mode — one question at a time, keyboard shortcuts A/E/R/←/→
//   3. Publish view — approve → publish to live questions table

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QuestionCard } from '@/components/practice/QuestionCard';
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
}

type View = 'queue' | 'review' | 'publish';

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminReviewQueue() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState<View>('queue');
  const [subtopics, setSubtopics] = useState<SubtopicWithCounts[]>([]);
  const [loadingSubtopics, setLoadingSubtopics] = useState(true);
  const [selectedSubtopic, setSelectedSubtopic] =
    useState<SubtopicWithCounts | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Review mode state
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<Partial<PendingQuestion>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────

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

  // ── Load subtopics with counts ────────────────────────────────────────────

  const loadSubtopics = useCallback(async () => {
    setLoadingSubtopics(true);
    try {
      // Get all Maths subtopics
      const { data: subs } = await supabase
        .from('subtopics')
        .select('id, subtopic_name, topic, tier, subject, grade_band')
        .ilike('subject', '%math%')
        .order('topic')
        .order('subtopic_name');

      if (!subs) return;

      // Get pending_questions counts per subtopic
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
  }, []);

  useEffect(() => {
    if (authed) loadSubtopics();
  }, [authed, loadSubtopics]);

  // ── Generate batch ────────────────────────────────────────────────────────

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
          body: JSON.stringify({ subtopicId: subtopic.id, count: 20 }),
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

  // ── Enter review mode ─────────────────────────────────────────────────────

  async function enterReview(subtopic: SubtopicWithCounts) {
    setSelectedSubtopic(subtopic);
    setLoadingQuestions(true);
    setView('review');
    setCurrentIndex(0);
    setEditMode(false);

    const { data } = await supabase
      .from('pending_questions')
      .select('*')
      .eq('subtopic_id', subtopic.id)
      .eq('status', 'pending')
      .order('created_at');

    setQuestions(data ?? []);
    setLoadingQuestions(false);
  }

  // ── Review actions ────────────────────────────────────────────────────────

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

    // Write audit trail for changed fields
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

    // Apply edits + approve
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
    const remaining = questions.filter(
      (q) => q.id !== currentQuestion?.id && q.status === 'pending'
    );
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
      // No more pending — go back to queue
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

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

  // ── Publish ───────────────────────────────────────────────────────────────

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

    // Insert into live questions table
    const liveRows = approved.map((q) => ({
      subtopic_id: q.subtopic_id,
      question_text: q.question_text,
      marks: q.marks,
      mark_scheme: q.mark_scheme,
      worked_solution: q.worked_solution,
      parts: q.parts,
      calculator_allowed: q.calculator_allowed,
      source: 'reviewed',
    }));

    const { error } = await supabase.from('questions').insert(liveRows);
    if (error) {
      alert(`Publish failed: ${error.message}`);
      return;
    }

    // Mark as published
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

  // ─── Render guards ────────────────────────────────────────────────────────

  if (!authChecked || !authed) return null;

  // ─── Queue view ───────────────────────────────────────────────────────────

  if (view === 'queue') {
    return (
      <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
        {/* Header */}
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
              <span
                className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#F5A623', color: 'white' }}
              >
                Maths
              </span>
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
          {/* Keyboard hint */}
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
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-black/5 shadow-sm px-5 py-4 flex items-center gap-4"
                >
                  {/* Subtopic info */}
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

                  {/* Counts */}
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

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
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
      {/* Header */}
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
          {/* Progress */}
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
          {/* Calculator badge */}
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

          {/* Question rendered exactly as student sees it */}
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
            /* Edit mode */
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

          {/* Mark scheme (read mode) */}
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

          {/* Worked solution (read mode) */}
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

          {/* Reject reason input */}
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

          {/* Action bar */}
          <div className="flex items-center gap-3 pt-2">
            {/* Navigation */}
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
