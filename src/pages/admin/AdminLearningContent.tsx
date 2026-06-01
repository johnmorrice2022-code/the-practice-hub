import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen, X, Loader2, ChevronDown, ChevronUp,
  Plus, Trash2, Save, HelpCircle, ArrowLeft,
} from 'lucide-react';

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

interface Paragraph {
  text: string;
  diagram_url?: string | null;
  is_non_example?: boolean;
  style?: 'key-point' | 'exam-tip' | 'watch-out' | 'subheading' | 'higher-only';
}
interface IndexItem {
  label: string;
  section_index: number;
}
interface Section {
  heading: string;
  paragraphs: Paragraph[];
  type?: string;
  component?: string;
  items?: IndexItem[];
}
interface Subtopic {
  id: string;
  subject: string;
  topic: string;
  subtopic_name: string;
  slug: string;
}
interface LearningRow {
  id: string;
  sections: Section[];
}

const STYLES = [
  { value: 'normal',      label: 'Normal' },
  { value: 'key-point',   label: 'Key point' },
  { value: 'exam-tip',    label: 'Exam tip' },
  { value: 'watch-out',   label: 'Watch out' },
  { value: 'subheading',  label: 'Subheading' },
  { value: 'higher-only', label: 'Higher only' },
] as const;

const STYLE_COLOURS: Record<string, string> = {
  'normal':      'transparent',
  'key-point':   '#E23D28',
  'exam-tip':    '#2D9A5F',
  'watch-out':   '#F5A623',
  'subheading':  '#6366f1',
  'higher-only': '#7C3AED',
};

function styleValue(para: Paragraph): string {
  if (para.is_non_example) return 'watch-out';
  return para.style ?? 'normal';
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CheckQuestion {
  id: string;
  subtopic_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  question_order: number;
}

const EMPTY_CHECK = (): Omit<CheckQuestion, 'id' | 'subtopic_id' | 'question_order'> => ({
  question_text: '',
  options: ['', '', '', ''],
  correct_index: 0,
  explanation: '',
});

export default function AdminLearningContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [learningRow, setLearningRow] = useState<LearningRow | null>(null);
  const [working, setWorking] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'content' | 'checks'>('content');

  // Check questions state
  const [checkQuestions, setCheckQuestions] = useState<CheckQuestion[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [expandedCheckId, setExpandedCheckId] = useState<string | 'new' | null>(null);
  const [checkDraft, setCheckDraft] = useState<Omit<CheckQuestion, 'id' | 'subtopic_id' | 'question_order'>>(EMPTY_CHECK());
  const [savingCheck, setSavingCheck] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email === ADMIN_EMAIL) setAuthed(true);
      else navigate('/');
      setAuthChecked(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (!authed) return;
    supabase
      .from('subtopics')
      .select('id, subject, topic, subtopic_name, slug')
      .order('subject')
      .then(({ data }) => {
        if (!data) return;
        setSubtopics(data);
        // Pre-select from URL param ?subtopicId=
        const paramId = searchParams.get('subtopicId');
        if (paramId) {
          const match = data.find(s => s.id === paramId);
          if (match) setSelectedSlug(match.slug);
        }
        // Pre-select tab from URL param ?tab=
        const paramTab = searchParams.get('tab');
        if (paramTab === 'checks') setActiveTab('checks');
      });
  }, [authed, searchParams]);

  useEffect(() => {
    if (!selectedSlug) { setLearningRow(null); setWorking([]); setDirty(false); return; }
    const sub = subtopics.find(s => s.slug === selectedSlug);
    if (!sub) return;
    setLoading(true);
    setDirty(false);
    setSaved(false);
    supabase
      .from('learning_content')
      .select('id, sections')
      .eq('subtopic_id', sub.id)
      .maybeSingle()
      .then(({ data }) => {
        setLoading(false);
        if (data) {
          const row: LearningRow = { id: data.id, sections: data.sections as unknown as Section[] };
          setLearningRow(row);
          setWorking(deepClone(row.sections));
        } else {
          setLearningRow(null);
          setWorking([]);
        }
      });
  }, [selectedSlug, subtopics]);

  // ── Mutators ──────────────────────────────────────────────────────────────────

  function mutate(updater: (s: Section[]) => Section[]) {
    setWorking(prev => updater(deepClone(prev)));
    setDirty(true);
    setSaved(false);
  }

  const updateHeading     = (si: number, v: string)          => mutate(s => { s[si].heading = v; return s; });
  const updateParaText    = (si: number, pi: number, v: string) => mutate(s => { s[si].paragraphs[pi].text = v; return s; });
  const updateParaStyle   = (si: number, pi: number, v: string) => mutate(s => {
    const p = s[si].paragraphs[pi];
    if (v === 'normal')     { delete p.style; delete p.is_non_example; }
    else if (v === 'watch-out') { p.is_non_example = true; delete p.style; }
    else                    { delete p.is_non_example; p.style = v as Paragraph['style']; }
    return s;
  });
  const addParagraph      = (si: number)                      => mutate(s => { s[si].paragraphs.push({ text: '' }); return s; });
  const deleteParagraph   = (si: number, pi: number)          => mutate(s => { s[si].paragraphs.splice(pi, 1); return s; });
  const addSection        = ()                                 => mutate(s => { s.push({ heading: 'New section', paragraphs: [{ text: '' }] }); return s; });
  const addIndexItem      = (si: number)                      => mutate(s => { (s[si].items ??= []).push({ label: '', section_index: 0 }); return s; });
  const deleteIndexItem   = (si: number, ii: number)          => mutate(s => { s[si].items?.splice(ii, 1); return s; });
  const updateIndexLabel  = (si: number, ii: number, v: string) => mutate(s => { if (s[si].items?.[ii]) s[si].items[ii].label = v; return s; });
  const updateIndexTarget = (si: number, ii: number, v: number) => mutate(s => { if (s[si].items?.[ii]) s[si].items[ii].section_index = v; return s; });
  const deleteSection     = (si: number)                      => mutate(s => { s.splice(si, 1); return s; });
  const moveSectionUp     = (si: number)                      => mutate(s => { if (si > 0) [s[si-1], s[si]] = [s[si], s[si-1]]; return s; });
  const moveSectionDown   = (si: number)                      => mutate(s => { if (si < s.length-1) [s[si], s[si+1]] = [s[si+1], s[si]]; return s; });

  // ── Check questions load ──────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'checks' || !selectedSlug) return;
    const sub = subtopics.find(s => s.slug === selectedSlug);
    if (!sub) return;
    setCheckLoading(true);
    setExpandedCheckId(null);
    supabase
      .from('check_questions')
      .select('*')
      .eq('subtopic_id', sub.id)
      .order('question_order')
      .then(({ data }) => {
        setCheckQuestions((data ?? []) as CheckQuestion[]);
        setCheckLoading(false);
      });
  }, [activeTab, selectedSlug, subtopics]);

  // ── Check question CRUD ───────────────────────────────────────────────────────

  function openNewCheck() {
    setCheckDraft(EMPTY_CHECK());
    setExpandedCheckId('new');
  }

  function openEditCheck(q: CheckQuestion) {
    setCheckDraft({ question_text: q.question_text, options: [...q.options], correct_index: q.correct_index, explanation: q.explanation });
    setExpandedCheckId(q.id);
  }

  async function saveCheck() {
    const sub = subtopics.find(s => s.slug === selectedSlug);
    if (!sub || !checkDraft.question_text.trim()) return;
    setSavingCheck(true);

    if (expandedCheckId === 'new') {
      const nextOrder = checkQuestions.length > 0 ? Math.max(...checkQuestions.map(q => q.question_order)) + 1 : 1;
      const { data, error } = await supabase.from('check_questions').insert({
        subtopic_id: sub.id,
        question_text: checkDraft.question_text,
        options: checkDraft.options,
        correct_index: checkDraft.correct_index,
        explanation: checkDraft.explanation,
        question_order: nextOrder,
      }).select('*').single();
      if (!error && data) setCheckQuestions(prev => [...prev, data as CheckQuestion]);
    } else if (expandedCheckId) {
      const { error } = await supabase.from('check_questions').update({
        question_text: checkDraft.question_text,
        options: checkDraft.options,
        correct_index: checkDraft.correct_index,
        explanation: checkDraft.explanation,
      }).eq('id', expandedCheckId);
      if (!error) setCheckQuestions(prev => prev.map(q => q.id === expandedCheckId ? { ...q, ...checkDraft } : q));
    }

    setSavingCheck(false);
    setExpandedCheckId(null);
  }

  async function deleteCheck(id: string) {
    if (!confirm('Delete this check question?')) return;
    await supabase.from('check_questions').delete().eq('id', id);
    setCheckQuestions(prev => prev.filter(q => q.id !== id));
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!learningRow) return;
    setSaving(true);
    const { error } = await supabase
      .from('learning_content')
      .update({ sections: working as unknown as never })
      .eq('id', learningRow.id);
    setSaving(false);
    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      setDirty(false);
      setSaved(true);
      setLearningRow(prev => prev ? { ...prev, sections: working } : prev);
    }
  };

  if (!authChecked || !authed) return null;

  const bySubject = subtopics.reduce<Record<string, Subtopic[]>>((acc, s) => {
    (acc[s.subject] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b" style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#E23D28' }}>
              <BookOpen size={14} color="white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">Learning Content Editor</span>
              <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: '#F5A623', color: 'white' }}>CMS</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'content' && dirty && (
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                style={{ background: '#E23D28' }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
            {activeTab === 'content' && saved && !dirty && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
            <button onClick={() => navigate('/admin/content-pipeline')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Pipeline
            </button>
            <button onClick={() => navigate('/admin')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              <X size={12} /> Exit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Subtopic picker */}
        <div className="bg-white rounded-xl border p-5 mb-6" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Subtopic</label>
          <div className="relative">
            <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
              className="w-full h-10 px-3 pr-8 rounded-lg border bg-white text-sm text-gray-700 focus:outline-none appearance-none"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}>
              <option value="">Select a subtopic…</option>
              {Object.entries(bySubject).map(([subject, subs]) => (
                <optgroup key={subject} label={subject}>
                  {subs.map(s => <option key={s.slug} value={s.slug}>{s.topic} — {s.subtopic_name}</option>)}
                </optgroup>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Tab switcher */}
        {selectedSlug && (
          <div className="flex gap-1 mb-6">
            {([['content', 'Learning Content', <BookOpen size={12} />], ['checks', 'Check Questions', <HelpCircle size={12} />]] as const).map(([tab, label, icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors"
                style={activeTab === tab
                  ? { background: '#E23D28', color: 'white' }
                  : { background: 'white', color: '#6b7280', border: '1px solid rgba(0,0,0,0.08)' }
                }>
                {icon}{label}
              </button>
            ))}
          </div>
        )}

        {/* ── Learning Content tab ── */}
        {activeTab === 'content' && loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-12">
            <Loader2 size={16} className="animate-spin" /> Loading content…
          </div>
        )}

        {activeTab === 'content' && !loading && selectedSlug && !learningRow && (
          <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <p className="text-sm text-gray-400">No learning content found for this subtopic.</p>
            <p className="text-xs text-gray-300 mt-1">Insert the initial content via Supabase, then edit it here.</p>
          </div>
        )}

        {activeTab === 'content' && !loading && learningRow && (
          <div className="space-y-4">
            {working.map((section, si) => (
              <SectionCard key={si}
                section={section} sectionIndex={si} total={working.length}
                allSections={working}
                onUpdateHeading={v => updateHeading(si, v)}
                onUpdateParaText={(pi, v) => updateParaText(si, pi, v)}
                onUpdateParaStyle={(pi, v) => updateParaStyle(si, pi, v)}
                onAddParagraph={() => addParagraph(si)}
                onDeleteParagraph={pi => deleteParagraph(si, pi)}
                onDelete={() => deleteSection(si)}
                onMoveUp={() => moveSectionUp(si)}
                onMoveDown={() => moveSectionDown(si)}
                onAddIndexItem={() => addIndexItem(si)}
                onDeleteIndexItem={ii => deleteIndexItem(si, ii)}
                onUpdateIndexLabel={(ii, v) => updateIndexLabel(si, ii, v)}
                onUpdateIndexTarget={(ii, v) => updateIndexTarget(si, ii, v)}
              />
            ))}
            <button onClick={addSection}
              className="w-full border-2 border-dashed rounded-xl p-4 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
              style={{ borderColor: 'rgba(0,0,0,0.10)' }}>
              <Plus size={14} /> Add section
            </button>
          </div>
        )}

        {/* ── Check Questions tab ── */}
        {activeTab === 'checks' && selectedSlug && (
          <div className="space-y-3">
            {checkLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : (
              <>
                {checkQuestions.length === 0 && expandedCheckId !== 'new' && (
                  <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <p className="text-sm text-gray-400">No check questions yet.</p>
                    <p className="text-xs text-gray-300 mt-1">Add up to 5 multiple-choice comprehension checks.</p>
                  </div>
                )}

                {checkQuestions.map((q, idx) => (
                  <div key={q.id} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                    {expandedCheckId === q.id ? (
                      <CheckQuestionForm
                        draft={checkDraft}
                        onChange={setCheckDraft}
                        onSave={saveCheck}
                        onCancel={() => setExpandedCheckId(null)}
                        saving={savingCheck}
                        label={`Q${idx + 1}`}
                      />
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="text-[11px] font-semibold text-gray-300 w-6 flex-shrink-0">Q{idx + 1}</span>
                        <p className="text-sm text-gray-700 flex-1 truncate">{q.question_text || '(no text)'}</p>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => openEditCheck(q)} className="px-2.5 h-8 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 border transition-colors" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>Edit</button>
                          <button onClick={() => deleteCheck(q.id)} className="px-2.5 h-8 rounded-lg text-xs font-medium text-red-400 hover:bg-red-50 border border-red-100 transition-colors">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {expandedCheckId === 'new' && (
                  <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                    <CheckQuestionForm
                      draft={checkDraft}
                      onChange={setCheckDraft}
                      onSave={saveCheck}
                      onCancel={() => setExpandedCheckId(null)}
                      saving={savingCheck}
                      label={`Q${checkQuestions.length + 1}`}
                    />
                  </div>
                )}

                {expandedCheckId !== 'new' && checkQuestions.length < 5 && (
                  <button onClick={openNewCheck}
                    className="w-full border-2 border-dashed rounded-xl p-4 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
                    style={{ borderColor: 'rgba(0,0,0,0.10)' }}>
                    <Plus size={14} /> Add check question
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CheckQuestionForm ────────────────────────────────────────────────────────

interface CheckQuestionFormProps {
  draft: Omit<CheckQuestion, 'id' | 'subtopic_id' | 'question_order'>;
  onChange: (d: Omit<CheckQuestion, 'id' | 'subtopic_id' | 'question_order'>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  label: string;
}

function CheckQuestionForm({ draft, onChange, onSave, onCancel, saving, label }: CheckQuestionFormProps) {
  function setOption(i: number, v: string) {
    const opts = [...draft.options];
    opts[i] = v;
    onChange({ ...draft, options: opts });
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Question text</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-y min-h-[60px] focus:outline-none"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          placeholder="Use $…$ for inline LaTeX"
          value={draft.question_text}
          onChange={e => onChange({ ...draft, question_text: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-400 block">Options — select the correct answer</label>
        {draft.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={draft.correct_index === i}
              onChange={() => onChange({ ...draft, correct_index: i })}
              className="w-4 h-4 flex-shrink-0 accent-green-600" />
            <input
              className="flex-1 border rounded-lg px-3 h-9 text-sm focus:outline-none"
              style={{ borderColor: draft.correct_index === i ? '#16a34a' : 'rgba(0,0,0,0.12)' }}
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={e => setOption(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Explanation (shown after answering)</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-y min-h-[50px] focus:outline-none"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          placeholder="Why is the correct answer correct?"
          value={draft.explanation}
          onChange={e => onChange({ ...draft, explanation: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 h-9 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 border transition-colors" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving || !draft.question_text.trim()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium text-white disabled:opacity-40"
          style={{ background: '#E23D28' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save question
        </button>
      </div>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: Section; sectionIndex: number; total: number;
  allSections: Section[];
  onUpdateHeading: (v: string) => void;
  onUpdateParaText: (pi: number, v: string) => void;
  onUpdateParaStyle: (pi: number, v: string) => void;
  onAddParagraph: () => void;
  onDeleteParagraph: (pi: number) => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onAddIndexItem: () => void;
  onDeleteIndexItem: (ii: number) => void;
  onUpdateIndexLabel: (ii: number, v: string) => void;
  onUpdateIndexTarget: (ii: number, v: number) => void;
}

function SectionCard({
  section, sectionIndex, total, allSections,
  onUpdateHeading, onUpdateParaText, onUpdateParaStyle,
  onAddParagraph, onDeleteParagraph, onDelete, onMoveUp, onMoveDown,
  onAddIndexItem, onDeleteIndexItem, onUpdateIndexLabel, onUpdateIndexTarget,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isIndex = section.type === 'index';

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.015)' }}>
        <span className="text-[11px] font-semibold text-gray-300 w-5 flex-shrink-0">§{sectionIndex + 1}</span>
        {isIndex && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#F5A623', color: 'white' }}>Index</span>}
        <input type="text" value={section.heading} onChange={e => onUpdateHeading(e.target.value)}
          className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-gray-50 px-1 py-0.5 rounded"
          placeholder="Section heading…" />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onMoveUp}   disabled={sectionIndex === 0}          title="Move up"      className="p-1.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"><ChevronUp   size={13} /></button>
          <button onClick={onMoveDown} disabled={sectionIndex === total - 1}  title="Move down"    className="p-1.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"><ChevronDown size={13} /></button>
          <button onClick={onDelete}                                           title="Delete section" className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"><Trash2      size={13} /></button>
          <button onClick={() => setCollapsed(c => !c)}                       title={collapsed ? 'Expand' : 'Collapse'} className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors">
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {!collapsed && isIndex && (
        <div className="p-4 space-y-2">
          <p className="text-[11px] text-gray-400 mb-3">Each item links to a section by number. Section numbers update when you reorder.</p>
          {(section.items ?? []).map((item, ii) => (
            <div key={ii} className="flex items-center gap-2">
              <input type="text" value={item.label} onChange={e => onUpdateIndexLabel(ii, e.target.value)}
                className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 transition"
                style={{ borderColor: 'rgba(0,0,0,0.10)' }} placeholder="Menu label…" />
              <select value={item.section_index} onChange={e => onUpdateIndexTarget(ii, Number(e.target.value))}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none bg-white"
                style={{ borderColor: 'rgba(0,0,0,0.10)' }}>
                {allSections.map((s, i) => (
                  <option key={i} value={i}>§{i + 1} {s.heading}</option>
                ))}
              </select>
              <button onClick={() => onDeleteIndexItem(ii)} className="p-1 text-gray-200 hover:text-red-400 transition-colors flex-shrink-0"><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={onAddIndexItem} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <Plus size={12} /> Add menu item
          </button>
        </div>
      )}

      {!collapsed && !isIndex && (
        <div className="p-4 space-y-3">
          {(section.paragraphs ?? []).map((para, pi) => (
            <ParagraphRow key={pi} para={para} paraIndex={pi}
              onUpdateText={v => onUpdateParaText(pi, v)}
              onUpdateStyle={v => onUpdateParaStyle(pi, v)}
              onDelete={() => onDeleteParagraph(pi)}
            />
          ))}
          <button onClick={onAddParagraph}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <Plus size={12} /> Add paragraph
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ParagraphRow ─────────────────────────────────────────────────────────────

interface ParagraphRowProps {
  para: Paragraph; paraIndex: number;
  onUpdateText: (v: string) => void;
  onUpdateStyle: (v: string) => void;
  onDelete: () => void;
}

function ParagraphRow({ para, onUpdateText, onUpdateStyle, onDelete }: ParagraphRowProps) {
  const sv = styleValue(para);
  const colour = STYLE_COLOURS[sv] ?? 'transparent';

  return (
    <div className="flex gap-2 items-start">
      <div className="w-1 rounded-full mt-2 flex-shrink-0 self-stretch min-h-[2.5rem]"
        style={{ background: colour === 'transparent' ? '#e5e7eb' : colour, opacity: colour === 'transparent' ? 0.3 : 1 }} />
      <div className="flex-1">
        <textarea value={para.text} onChange={e => onUpdateText(e.target.value)} rows={3}
          className="w-full text-sm text-gray-700 border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 transition"
          style={{ borderColor: 'rgba(0,0,0,0.10)' }}
          placeholder="Paragraph text… (use $…$ for inline LaTeX, $$…$$ for display)" />
        {para.diagram_url && (
          <p className="text-[11px] text-gray-400 mt-0.5">📎 Has diagram — edit in Diagram CMS</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0 pt-1">
        <select value={sv} onChange={e => onUpdateStyle(e.target.value)}
          className="text-[11px] border rounded px-1.5 py-1 text-gray-600 focus:outline-none bg-white"
          style={{ borderColor: 'rgba(0,0,0,0.10)' }}>
          {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={onDelete} title="Delete paragraph"
          className="p-1 text-gray-200 hover:text-red-400 transition-colors self-end">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
