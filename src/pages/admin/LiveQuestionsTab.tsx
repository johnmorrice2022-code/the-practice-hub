// src/pages/admin/LiveQuestionsTab.tsx
//
// Shared tab used by both "Live Seeded" and "Live AI" tabs in AdminLearningContent.
// Shows all published practice questions for a subtopic with inline edit and delete.

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question_text: string;
  worked_solution: string | null;
  mark_scheme: unknown;
  diagram_component?: string | null;
  calculator_allowed?: boolean | null;
}

interface Draft {
  question_text: string;
  worked_solution: string;
  mark_scheme: string;
}

interface LiveQuestionsTabProps {
  subtopicId: string;
  source: 'seeded_questions' | 'questions';
  badge: 'Seeded' | 'AI';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toJsonString(value: unknown): string {
  if (!value) return '[]';
  if (typeof value === 'string') {
    try { JSON.parse(value); return value; } catch { return '[]'; }
  }
  return JSON.stringify(value, null, 2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveQuestionsTab({ subtopicId, source, badge }: LiveQuestionsTabProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!subtopicId) return;
    setLoading(true);
    setExpandedId(null);

    const query = source === 'seeded_questions'
      ? supabase
          .from('seeded_questions')
          .select('id, question_text, worked_solution, mark_scheme, diagram_component, calculator_allowed')
          .eq('subtopic_id', subtopicId)
      : supabase
          .from('questions')
          .select('id, question_text, worked_solution, mark_scheme, calculator_allowed')
          .eq('subtopic_id', subtopicId);

    query.then(({ data }) => {
      setQuestions((data ?? []) as Question[]);
      setLoading(false);
    });
  }, [subtopicId, source]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  function toggleEdit(q: Question) {
    if (expandedId === q.id) { setExpandedId(null); return; }
    setDrafts(prev => ({
      ...prev,
      [q.id]: {
        question_text: q.question_text,
        worked_solution: q.worked_solution ?? '',
        mark_scheme: toJsonString(q.mark_scheme),
      },
    }));
    setExpandedId(q.id);
  }

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveEdit(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    let parsedScheme: unknown;
    try {
      parsedScheme = JSON.parse(draft.mark_scheme);
    } catch {
      alert('Mark scheme is not valid JSON. Please check the format.');
      return;
    }

    setSaving(id);

    const update = {
      question_text: draft.question_text.trim(),
      worked_solution: draft.worked_solution.trim() || null,
      mark_scheme: parsedScheme,
    };

    const { error } = source === 'seeded_questions'
      ? await supabase.from('seeded_questions').update(update).eq('id', id)
      : await supabase.from('questions').update(update).eq('id', id);

    setSaving(null);

    if (!error) {
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...update } : q));
      setSavedIds(prev => new Set([...prev, id]));
      setTimeout(() => setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 2000);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question? It will be removed from the live question pool immediately.')) return;

    const { error } = source === 'seeded_questions'
      ? await supabase.from('seeded_questions').delete().eq('id', id)
      : await supabase.from('questions').delete().eq('id', id);

    if (!error) {
      setQuestions(prev => prev.filter(q => q.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  );

  if (questions.length === 0) return (
    <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <p className="text-sm text-gray-400">No {badge === 'AI' ? 'approved AI' : 'seeded'} questions live for this subtopic.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">
        {questions.length} question{questions.length !== 1 ? 's' : ''} live
      </p>

      {questions.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>

          {/* ── Collapsed row ── */}
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="text-[11px] font-semibold text-gray-300 w-6 flex-shrink-0 pt-0.5">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 line-clamp-2">{q.question_text}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={badge === 'AI'
                    ? { background: '#ede9fe', color: '#6d28d9' }
                    : { background: '#fef3c7', color: '#92400e' }}
                >
                  {badge}
                </span>
                {q.diagram_component && (
                  <span className="text-[10px] text-gray-400">has diagram</span>
                )}
                {q.calculator_allowed === true && (
                  <span className="text-[10px] text-gray-400">calculator</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleEdit(q)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"
              >
                {expandedId === q.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* ── Edit panel ── */}
          {expandedId === q.id && drafts[q.id] && (
            <div className="border-t px-4 pb-4 pt-4 space-y-3" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#fafafa' }}>
              {q.diagram_component && (
                <p className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                  Diagram parameters can only be edited in the Review Queue.
                </p>
              )}

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Question text</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={drafts[q.id].question_text}
                  onChange={e => updateDraft(q.id, 'question_text', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Worked solution</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-y min-h-[60px] focus:outline-none"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  placeholder="Step-by-step solution (use $…$ for LaTeX)"
                  value={drafts[q.id].worked_solution}
                  onChange={e => updateDraft(q.id, 'worked_solution', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Mark scheme (JSON)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-y min-h-[100px] focus:outline-none"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={drafts[q.id].mark_scheme}
                  onChange={e => updateDraft(q.id, 'mark_scheme', e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveEdit(q.id)}
                  disabled={saving === q.id || !drafts[q.id].question_text.trim()}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                  style={{ background: savedIds.has(q.id) ? '#16a34a' : '#E23D28' }}
                >
                  {saving === q.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : savedIds.has(q.id)
                      ? '✓ Saved'
                      : <><Save size={12} />&nbsp;Save changes</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
