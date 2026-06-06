// src/pages/admin/AdminContentPipeline.tsx
//
// Content Pipeline — subtopic setup, status tracking and activation
// Route: /admin/content-pipeline
//
// Gives a single view of every subtopic's readiness:
// prompt config, learning content, check questions, practice questions, active state.
// Create new subtopics and edit prompt config here.
// Deep-links into existing editors (Learning Content, Review Queue) pre-filtered.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Layers, X, ArrowLeft, Plus, ChevronDown, ChevronUp,
  BookOpen, Loader2, Save, Copy, Check, ExternalLink,
} from 'lucide-react';

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subtopic {
  id: string;
  subject: string;
  topic: string;
  subtopic_name: string;
  slug: string;
  tier: string;
  exam_board: string;
  sort_order: number;
  active: boolean;
  prompt_config: Record<string, string> | null;
}

interface SubtopicRow extends Subtopic {
  hasLearningContent: boolean;
  checkCount: number;
  questionCount: number;
}

interface PromptDraft {
  system_prompt: string;
  marking_guidance: string;
}

interface CreateForm {
  subject: string;
  topic: string;
  subtopic_name: string;
  slug: string;
  tier: string;
  sort_order: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminContentPipeline() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [rows, setRows] = useState<SubtopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<'All' | 'Maths' | 'Physics'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [promptDrafts, setPromptDrafts] = useState<Record<string, PromptDraft>>({});
  const [savingPrompt, setSavingPrompt] = useState<Set<string>>(new Set());
  const [savedPrompt, setSavedPrompt] = useState<Set<string>>(new Set());
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [savingName, setSavingName] = useState<Set<string>>(new Set());
  const [savedName, setSavedName] = useState<Set<string>>(new Set());
  const [togglingActive, setTogglingActive] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const emptyCreate: CreateForm = { subject: 'Physics', topic: '', subtopic_name: '', slug: '', tier: 'Both', sort_order: '100' };
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email === ADMIN_EMAIL) setAuthed(true);
      else navigate('/');
      setAuthChecked(true);
    });
  }, [navigate]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const [subtopicsRes, lcRes, cqRes, qRes] = await Promise.all([
      supabase.from('subtopics').select('id, subject, topic, subtopic_name, slug, tier, exam_board, sort_order, active, prompt_config').order('subject').order('topic').order('sort_order'),
      supabase.from('learning_content').select('subtopic_id'),
      supabase.from('check_questions').select('subtopic_id'),
      supabase.from('questions').select('subtopic_id'),
    ]);

    const lcSet = new Set((lcRes.data ?? []).map(r => r.subtopic_id));

    const cqCounts = new Map<string, number>();
    (cqRes.data ?? []).forEach(r => cqCounts.set(r.subtopic_id, (cqCounts.get(r.subtopic_id) ?? 0) + 1));

    const qCounts = new Map<string, number>();
    (qRes.data ?? []).forEach(r => qCounts.set(r.subtopic_id, (qCounts.get(r.subtopic_id) ?? 0) + 1));

    const built: SubtopicRow[] = (subtopicsRes.data ?? []).map(s => ({
      ...s,
      prompt_config: s.prompt_config as Record<string, string> | null,
      hasLearningContent: lcSet.has(s.id),
      checkCount: cqCounts.get(s.id) ?? 0,
      questionCount: qCounts.get(s.id) ?? 0,
    }));

    setRows(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  // ── Expand / prompt draft ─────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  useEffect(() => {
    if (!expandedId) return;
    const row = rows.find(r => r.id === expandedId);
    if (!row) return;
    if (!promptDrafts[expandedId]) {
      const pc = row.prompt_config ?? {};
      setPromptDrafts(prev => ({
        ...prev,
        [expandedId]: {
          system_prompt: pc.system_prompt ?? '',
          marking_guidance: pc.marking_guidance ?? '',
        },
      }));
    }
    if (nameDrafts[expandedId] === undefined) {
      setNameDrafts(prev => ({ ...prev, [expandedId]: row.subtopic_name }));
    }
  }, [expandedId, rows, promptDrafts, nameDrafts]);

  function updateDraft(id: string, field: keyof PromptDraft, value: string) {
    setPromptDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  // ── Save prompt config ────────────────────────────────────────────────────

  async function savePromptConfig(row: SubtopicRow) {
    const draft = promptDrafts[row.id];
    if (!draft) return;
    setSavingPrompt(prev => new Set([...prev, row.id]));
    const merged = { ...(row.prompt_config ?? {}), ...draft };
    const { error } = await supabase.from('subtopics').update({ prompt_config: merged }).eq('id', row.id);
    setSavingPrompt(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    if (!error) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, prompt_config: merged } : r));
      setSavedPrompt(prev => new Set([...prev, row.id]));
      setTimeout(() => setSavedPrompt(prev => { const s = new Set(prev); s.delete(row.id); return s; }), 2000);
    }
  }

  // ── Save subtopic name ────────────────────────────────────────────────────

  async function saveSubtopicName(row: SubtopicRow) {
    const name = nameDrafts[row.id]?.trim();
    if (!name || name === row.subtopic_name) return;
    setSavingName(prev => new Set([...prev, row.id]));
    const { error } = await supabase.from('subtopics').update({ subtopic_name: name }).eq('id', row.id);
    setSavingName(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    if (!error) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, subtopic_name: name } : r));
      setSavedName(prev => new Set([...prev, row.id]));
      setTimeout(() => setSavedName(prev => { const s = new Set(prev); s.delete(row.id); return s; }), 2000);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function toggleActive(row: SubtopicRow) {
    setTogglingActive(prev => new Set([...prev, row.id]));
    const next = !row.active;
    const { error } = await supabase.from('subtopics').update({ active: next }).eq('id', row.id);
    setTogglingActive(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    if (!error) setRows(prev => prev.map(r => r.id === row.id ? { ...r, active: next } : r));
  }

  // ── Copy UUID ─────────────────────────────────────────────────────────────

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Create subtopic ───────────────────────────────────────────────────────

  async function handleCreate() {
    if (!createForm.topic.trim() || !createForm.subtopic_name.trim() || !createForm.slug.trim()) return;
    setCreating(true);
    const examBoard = createForm.subject === 'Maths' ? 'Edexcel' : 'AQA';
    const { data, error } = await supabase.from('subtopics').insert({
      subject: createForm.subject,
      topic: createForm.topic.trim(),
      subtopic_name: createForm.subtopic_name.trim(),
      slug: createForm.slug.trim(),
      tier: createForm.tier,
      exam_board: examBoard,
      sort_order: parseInt(createForm.sort_order) || 100,
      active: false,
      prompt_config: {},
    }).select('id, subject, topic, subtopic_name, slug, tier, exam_board, sort_order, active, prompt_config').single();
    setCreating(false);
    if (!error && data) {
      setRows(prev => [...prev, { ...data, prompt_config: null, hasLearningContent: false, checkCount: 0, questionCount: 0 }]);
      setShowCreate(false);
      setCreateForm(emptyCreate);
    }
  }

  // ── Filter + group ────────────────────────────────────────────────────────

  const filtered = rows.filter(r => subjectFilter === 'All' || r.subject === subjectFilter);

  const grouped: Map<string, SubtopicRow[]> = new Map();
  for (const row of filtered) {
    const key = `${row.subject}::${row.topic}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  if (!authChecked || !authed) return null;

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b" style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#E23D28' }}>
              <Layers size={14} color="white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">Content Pipeline</span>
              <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: '#F5A623', color: 'white' }}>CMS</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Admin Hub
            </button>
            <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
              <X size={12} /> Exit
            </button>
          </div>
        </div>

        {/* Filter + New */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {(['All', 'Maths', 'Physics'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSubjectFilter(f)}
                className="px-3 h-8 rounded-lg text-xs font-medium transition-colors"
                style={subjectFilter === f
                  ? { background: '#E23D28', color: 'white' }
                  : { background: 'white', color: '#6b7280', border: '1px solid rgba(0,0,0,0.08)' }
                }
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors"
            style={{ background: showCreate ? '#6b7280' : '#E23D28', color: 'white' }}
          >
            {showCreate ? <X size={12} /> : <Plus size={12} />}
            {showCreate ? 'Cancel' : 'New Subtopic'}
          </button>
        </div>
      </div>

      {/* ── Create form ── */}
      {showCreate && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            <p className="text-sm font-semibold text-gray-800 mb-4">New Subtopic</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                <select className="w-full border rounded-lg px-3 h-10 text-sm" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.subject}
                  onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value, slug: toSlug(f.subtopic_name) }))}>
                  <option>Maths</option>
                  <option>Physics</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tier</label>
                <select className="w-full border rounded-lg px-3 h-10 text-sm" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.tier}
                  onChange={e => setCreateForm(f => ({ ...f, tier: e.target.value }))}>
                  <option>Both</option>
                  <option>Foundation</option>
                  <option>Higher</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sort order</label>
                <input type="number" className="w-full border rounded-lg px-3 h-10 text-sm" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.sort_order}
                  onChange={e => setCreateForm(f => ({ ...f, sort_order: e.target.value }))} />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className="text-xs text-gray-500 mb-1 block">Topic (e.g. The Particle Model)</label>
                <input className="w-full border rounded-lg px-3 h-10 text-sm" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.topic}
                  onChange={e => setCreateForm(f => ({ ...f, topic: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Subtopic name</label>
                <input className="w-full border rounded-lg px-3 h-10 text-sm" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.subtopic_name}
                  onChange={e => setCreateForm(f => ({ ...f, subtopic_name: e.target.value, slug: toSlug(e.target.value) }))} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-gray-500 mb-1 block">Slug (URL)</label>
                <input className="w-full border rounded-lg px-3 h-10 text-sm font-mono" style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={createForm.slug}
                  onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCreate}
                disabled={creating || !createForm.topic.trim() || !createForm.subtopic_name.trim() || !createForm.slug.trim()}
                className="flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
                style={{ background: '#E23D28' }}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create subtopic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No subtopics found.</p>
        ) : (
          Array.from(grouped.entries()).map(([key, group]) => {
            const [subject, topic] = key.split('::');
            return (
              <div key={key}>
                {/* Topic group header */}
                <div className="flex items-center gap-2 mb-2">
                  {subjectFilter === 'All' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: subject === 'Physics' ? '#dbeafe' : '#fef9c3', color: subject === 'Physics' ? '#1d4ed8' : '#92400e' }}>
                      {subject}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-gray-500">{topic}</span>
                </div>

                <div className="space-y-2">
                  {group.map(row => (
                    <SubtopicCard
                      key={row.id}
                      row={row}
                      expanded={expandedId === row.id}
                      onToggleExpand={() => toggleExpand(row.id)}
                      onToggleActive={() => toggleActive(row)}
                      toggling={togglingActive.has(row.id)}
                      promptDraft={promptDrafts[row.id]}
                      onUpdateDraft={(field, value) => updateDraft(row.id, field, value)}
                      onSavePrompt={() => savePromptConfig(row)}
                      savingPrompt={savingPrompt.has(row.id)}
                      savedPrompt={savedPrompt.has(row.id)}
                      nameDraft={nameDrafts[row.id] ?? ''}
                      onUpdateName={v => setNameDrafts(prev => ({ ...prev, [row.id]: v }))}
                      onSaveName={() => saveSubtopicName(row)}
                      savingName={savingName.has(row.id)}
                      savedName={savedName.has(row.id)}
                      copiedId={copiedId}
                      onCopy={() => copyId(row.id)}
                      onEditContent={() => navigate(`/admin/learning-content?subtopicId=${row.id}`)}
                      onReviewQueue={() => navigate(`/admin/review-queue?subject=${encodeURIComponent(row.subject)}&subtopicId=${row.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── SubtopicCard ─────────────────────────────────────────────────────────────

interface SubtopicCardProps {
  row: SubtopicRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  toggling: boolean;
  promptDraft: PromptDraft | undefined;
  onUpdateDraft: (field: keyof PromptDraft, value: string) => void;
  onSavePrompt: () => void;
  savingPrompt: boolean;
  savedPrompt: boolean;
  nameDraft: string;
  onUpdateName: (v: string) => void;
  onSaveName: () => void;
  savingName: boolean;
  savedName: boolean;
  copiedId: string | null;
  onCopy: () => void;
  onEditContent: () => void;
  onReviewQueue: () => void;
}

function SubtopicCard({
  row, expanded, onToggleExpand, onToggleActive, toggling,
  promptDraft, onUpdateDraft, onSavePrompt, savingPrompt, savedPrompt,
  nameDraft, onUpdateName, onSaveName, savingName, savedName,
  copiedId, onCopy, onEditContent, onReviewQueue,
}: SubtopicCardProps) {
  const hasPrompt = !!(row.prompt_config?.system_prompt?.trim());

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
      {/* ── Row summary ── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: name + tier */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{row.subtopic_name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: '#f3f4f6', color: '#6b7280' }}>
                {row.tier}
              </span>
            </div>
            {/* Status chips */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusChip label="Prompt" ok={hasPrompt} />
              <StatusChip label="Content" ok={row.hasLearningContent} />
              <CountChip label="Checks" count={row.checkCount} />
              <CountChip label="Questions" count={row.questionCount} />
            </div>
          </div>

          {/* Right: active toggle + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onToggleActive}
              disabled={toggling}
              title={row.active ? 'Click to deactivate' : 'Click to activate'}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={row.active
                ? { background: '#dcfce7', color: '#16a34a' }
                : { background: '#f3f4f6', color: '#9ca3af' }
              }
            >
              {toggling
                ? <Loader2 size={11} className="animate-spin" />
                : <span className="w-2 h-2 rounded-full" style={{ background: row.active ? '#16a34a' : '#d1d5db' }} />
              }
              {row.active ? 'Live' : 'Draft'}
            </button>

            <button onClick={onToggleExpand} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors">
              {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-4 space-y-4" style={{ borderColor: 'rgba(0,0,0,0.06)', background: '#fafafa' }}>
          {/* UUID */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">ID</span>
            <code className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border flex-1 truncate" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              {row.id}
            </code>
            <button
              onClick={onCopy}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium transition-colors"
              style={copiedId === row.id ? { background: '#dcfce7', color: '#16a34a' } : { background: 'white', color: '#6b7280', border: '1px solid rgba(0,0,0,0.1)' }}
            >
              {copiedId === row.id ? <Check size={11} /> : <Copy size={11} />}
              {copiedId === row.id ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Subtopic name */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Subtopic name</p>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 h-9 text-sm"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                value={nameDraft}
                onChange={e => onUpdateName(e.target.value)}
              />
              <button
                onClick={onSaveName}
                disabled={savingName || !nameDraft.trim() || nameDraft.trim() === row.subtopic_name}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                style={{ background: savedName ? '#16a34a' : '#E23D28' }}
              >
                {savingName ? <Loader2 size={12} className="animate-spin" /> : savedName ? <Check size={12} /> : <Save size={12} />}
                {savedName ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* Prompt config */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-600">Prompt Config</p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">system_prompt</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-y min-h-[80px]"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                placeholder="AQA spec statements, key vocabulary, specific constraints..."
                value={promptDraft?.system_prompt ?? ''}
                onChange={e => onUpdateDraft('system_prompt', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">marking_guidance</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-y min-h-[80px]"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                placeholder="Mark scheme priorities, common student errors, acceptable alternatives..."
                value={promptDraft?.marking_guidance ?? ''}
                onChange={e => onUpdateDraft('marking_guidance', e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={onSavePrompt}
                disabled={savingPrompt}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                style={{ background: savedPrompt ? '#16a34a' : '#E23D28' }}
              >
                {savingPrompt ? <Loader2 size={12} className="animate-spin" /> : savedPrompt ? <Check size={12} /> : <Save size={12} />}
                {savedPrompt ? 'Saved' : 'Save prompt config'}
              </button>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex flex-wrap gap-2 pt-1">
            <NavLink label="Edit Learning Content" icon={<BookOpen size={12} />} onClick={onEditContent} />
            <NavLink label="Review Queue" icon={<ExternalLink size={12} />} onClick={onReviewQueue} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={ok ? { background: '#dcfce7', color: '#15803d' } : { background: '#fee2e2', color: '#b91c1c' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ok ? '#16a34a' : '#ef4444' }} />
      {label}
    </span>
  );
}

function CountChip({ label, count }: { label: string; count: number }) {
  const ok = count > 0;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={ok ? { background: '#dbeafe', color: '#1d4ed8' } : { background: '#f3f4f6', color: '#9ca3af' }}>
      <span className="font-bold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

function NavLink({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors"
      style={{ background: 'white', color: '#374151', border: '1px solid rgba(0,0,0,0.1)' }}
    >
      {icon}
      {label}
    </button>
  );
}
