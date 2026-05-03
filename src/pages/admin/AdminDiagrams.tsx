import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  ImagePlus,
  Trash2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  BookOpen,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Subtopic {
  id: string;
  subject: string;
  topic: string;
  subtopic_name: string;
  slug: string;
  exam_board: string;
}

interface Paragraph {
  text: string;
  diagram_url?: string | null;
  is_non_example?: boolean;
  style?: 'key-point' | 'exam-tip' | 'watch-out' | 'subheading';
}

interface Section {
  heading: string;
  paragraphs: Paragraph[];
  type?: string;
  component?: string;
}

interface LearningRow {
  id: string;
  section_index: number;
  sections: Section[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';
const ALLOWED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = '.svg,.png,.jpg,.jpeg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function styleLabel(para: Paragraph): string {
  if (para.is_non_example) return 'watch-out';
  return para.style ?? 'normal';
}

function truncate(text: string, max = 80): string {
  const plain = text.replace(/\$.*?\$/g, '[math]').replace(/<[^>]+>/g, '');
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}

// ─── Upload state per paragraph ───────────────────────────────────────────────

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDiagrams() {
  const navigate = useNavigate();

  // Auth gate
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  // Data
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState<Subtopic | null>(
    null
  );
  const [learningRows, setLearningRows] = useState<LearningRow[]>([]);

  // UI state
  const [loadingSubtopics, setLoadingSubtopics] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>(
    {}
  );

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Auth check ──────────────────────────────────────────────────────────────

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

  // ── Load subtopics ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authed) return;
    supabase
      .from('subtopics')
      .select('id, subject, topic, subtopic_name, slug, exam_board')
      .order('subject')
      .order('topic')
      .order('subtopic_name')
      .then(({ data, error }) => {
        if (!error && data) setSubtopics(data);
        setLoadingSubtopics(false);
      });
  }, [authed]);

  // ── Load learning content when subtopic changes ─────────────────────────────

  useEffect(() => {
    if (!selectedSlug) {
      setLearningRows([]);
      setSelectedSubtopic(null);
      return;
    }
    const sub = subtopics.find((s) => s.slug === selectedSlug) ?? null;
    setSelectedSubtopic(sub);
    setLoadingContent(true);
    setUploadStates({});

    supabase
      .from('learning_content')
      .select('id, section_index, sections')
      .eq('subtopic_slug', selectedSlug)
      .order('section_index')
      .then(({ data, error }) => {
        if (!error && data) {
          setLearningRows(data as LearningRow[]);
        }
        setLoadingContent(false);
      });
  }, [selectedSlug, subtopics]);

  // ── Upload handler ──────────────────────────────────────────────────────────

  async function handleUpload(
    file: File,
    rowId: string,
    sectionIdx: number,
    paraIdx: number
  ) {
    const key = `${rowId}-${sectionIdx}-${paraIdx}`;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadStates((s) => ({
        ...s,
        [key]: { status: 'error', message: 'File must be SVG, PNG, or JPG.' },
      }));
      return;
    }

    setUploadStates((s) => ({ ...s, [key]: { status: 'uploading' } }));

    // Build storage path: diagrams/[subject]/[topic]/[slug]/[filename]
    const subject = selectedSubtopic!.subject
      .toLowerCase()
      .replace(/\s+/g, '-');
    const topic = selectedSubtopic!.topic.toLowerCase().replace(/\s+/g, '-');
    const slug = selectedSubtopic!.slug;
    const ext = file.name.split('.').pop();
    const filename = `para-${sectionIdx}-${paraIdx}-${Date.now()}.${ext}`;
    const storagePath = `diagrams/${subject}/${topic}/${slug}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('diagrams')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      setUploadStates((s) => ({
        ...s,
        [key]: { status: 'error', message: uploadError.message },
      }));
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('diagrams')
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Write diagram_url back: fetch sections, patch, update
    const { data: current } = await supabase
      .from('learning_content')
      .select('sections')
      .eq('id', rowId)
      .single();

    if (current) {
      const updatedSections = JSON.parse(JSON.stringify(current.sections));
      if (
        updatedSections[sectionIdx] &&
        updatedSections[sectionIdx].paragraphs &&
        updatedSections[sectionIdx].paragraphs[paraIdx] !== undefined
      ) {
        updatedSections[sectionIdx].paragraphs[paraIdx].diagram_url = publicUrl;
        const { error: updateError } = await supabase
          .from('learning_content')
          .update({ sections: updatedSections })
          .eq('id', rowId);

        if (updateError) {
          setUploadStates((s) => ({
            ...s,
            [key]: { status: 'error', message: updateError.message },
          }));
          return;
        }
      }
    }

    // Optimistic local update
    setLearningRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const updated = JSON.parse(JSON.stringify(row.sections));
        if (updated[sectionIdx]?.paragraphs?.[paraIdx] !== undefined) {
          updated[sectionIdx].paragraphs[paraIdx].diagram_url = publicUrl;
        }
        return { ...row, sections: updated };
      })
    );

    setUploadStates((s) => ({ ...s, [key]: { status: 'success' } }));

    setTimeout(() => {
      setUploadStates((s) => ({ ...s, [key]: { status: 'idle' } }));
    }, 3000);
  }

  // ── Remove diagram handler ───────────────────────────────────────────────────

  async function handleRemove(
    rowId: string,
    sectionIdx: number,
    paraIdx: number
  ) {
    const key = `${rowId}-${sectionIdx}-${paraIdx}`;
    setUploadStates((s) => ({ ...s, [key]: { status: 'uploading' } }));

    const { data: current } = await supabase
      .from('learning_content')
      .select('sections')
      .eq('id', rowId)
      .single();

    if (current) {
      const updatedSections = JSON.parse(JSON.stringify(current.sections));
      if (updatedSections[sectionIdx]?.paragraphs?.[paraIdx] !== undefined) {
        updatedSections[sectionIdx].paragraphs[paraIdx].diagram_url = null;
        await supabase
          .from('learning_content')
          .update({ sections: updatedSections })
          .eq('id', rowId);
      }
    }

    setLearningRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const updated = JSON.parse(JSON.stringify(row.sections));
        if (updated[sectionIdx]?.paragraphs?.[paraIdx] !== undefined) {
          updated[sectionIdx].paragraphs[paraIdx].diagram_url = null;
        }
        return { ...row, sections: updated };
      })
    );

    setUploadStates((s) => ({ ...s, [key]: { status: 'idle' } }));
  }

  // ── Group subtopics for the dropdown ────────────────────────────────────────

  const grouped = subtopics.reduce<Record<string, Record<string, Subtopic[]>>>(
    (acc, sub) => {
      const subj = sub.subject;
      const topic = sub.topic;
      if (!acc[subj]) acc[subj] = {};
      if (!acc[subj][topic]) acc[subj][topic] = [];
      acc[subj][topic].push(sub);
      return acc;
    },
    {}
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!authChecked) return null;
  if (!authed) return null;

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
              style={{ background: '#F5A623' }}
            >
              <ImagePlus size={14} color="white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">
                Diagram CMS
              </span>
              <span
                className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#F5A623', color: 'white' }}
              >
                Admin
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Exit
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Subtopic picker */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-black/5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Select subtopic
          </label>
          {loadingSubtopics ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading subtopics…
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all cursor-pointer"
              >
                <option value="">— Choose a subtopic —</option>
                {Object.entries(grouped).map(([subject, topics]) =>
                  Object.entries(topics).map(([topic, subs]) => (
                    <optgroup
                      key={`${subject}-${topic}`}
                      label={`${subject} — ${topic}`}
                    >
                      {subs.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.subtopic_name} ({s.exam_board})
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          )}

          {selectedSubtopic && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-400">
                {selectedSubtopic.subject} → {selectedSubtopic.topic} →{' '}
                {selectedSubtopic.subtopic_name}
              </span>
              <span className="text-[10px] font-mono text-gray-300">
                slug: {selectedSubtopic.slug}
              </span>
            </div>
          )}
        </div>

        {/* Content area */}
        {loadingContent && (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading learning content…</span>
          </div>
        )}

        {!loadingContent && selectedSlug && learningRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <BookOpen size={28} strokeWidth={1.5} />
            <p className="text-sm">
              No learning content found for this subtopic.
            </p>
          </div>
        )}

        {!loadingContent &&
          learningRows.map((row) =>
            row.sections.map((section, sIdx) => {
              if (section.type === 'index' || section.type === 'interactive')
                return null;
              if (!section.paragraphs?.length) return null;

              return (
                <div
                  key={`${row.id}-${sIdx}`}
                  className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden"
                >
                  {/* Section header */}
                  <div
                    className="px-6 py-4 border-b"
                    style={{
                      background:
                        'linear-gradient(135deg, #fffbf5 0%, #fef6ec 100%)',
                      borderColor: 'rgba(245,166,35,0.2)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: '#F5A623', color: 'white' }}
                      >
                        Section {sIdx + 1}
                      </span>
                      <h2 className="text-sm font-semibold text-gray-700">
                        {section.heading}
                      </h2>
                    </div>
                  </div>

                  {/* Paragraphs */}
                  <div className="divide-y divide-gray-50">
                    {section.paragraphs.map((para, pIdx) => {
                      const key = `${row.id}-${sIdx}-${pIdx}`;
                      const uploadState = uploadStates[key] ?? {
                        status: 'idle',
                      };
                      const label = styleLabel(para);
                      const hasDiagram = !!para.diagram_url;

                      return (
                        <div key={pIdx} className="px-6 py-5 space-y-4">
                          {/* Style badge + preview text */}
                          <div className="flex items-start gap-3">
                            <StyleBadge label={label} />
                            <p className="text-xs text-gray-500 leading-relaxed flex-1 mt-0.5">
                              {truncate(para.text)}
                            </p>
                          </div>

                          {/* Existing diagram */}
                          {hasDiagram && (
                            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-100">
                              <img
                                src={para.diagram_url!}
                                alt="Current diagram"
                                className="w-32 h-24 object-contain rounded border border-gray-200 bg-white flex-shrink-0"
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2
                                    size={12}
                                    className="text-green-500"
                                  />
                                  <span className="text-[11px] font-medium text-green-700">
                                    Diagram uploaded
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400 font-mono break-all leading-relaxed">
                                  {para.diagram_url}
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() =>
                                      fileInputRefs.current[key]?.click()
                                    }
                                    className="text-[11px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors"
                                  >
                                    <Upload size={11} /> Replace
                                  </button>
                                  <span className="text-gray-200">|</span>
                                  <button
                                    onClick={() =>
                                      handleRemove(row.id, sIdx, pIdx)
                                    }
                                    className="text-[11px] text-red-400 hover:text-red-600 font-medium flex items-center gap-1 transition-colors"
                                  >
                                    <Trash2 size={11} /> Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upload button */}
                          {!hasDiagram && (
                            <button
                              onClick={() =>
                                fileInputRefs.current[key]?.click()
                              }
                              disabled={uploadState.status === 'uploading'}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-xs font-medium transition-all disabled:opacity-50"
                              style={{
                                borderColor:
                                  uploadState.status === 'success'
                                    ? '#22c55e'
                                    : uploadState.status === 'error'
                                      ? '#ef4444'
                                      : '#e5c99a',
                                color:
                                  uploadState.status === 'success'
                                    ? '#22c55e'
                                    : uploadState.status === 'error'
                                      ? '#ef4444'
                                      : '#b07d36',
                                background:
                                  uploadState.status === 'success'
                                    ? '#f0fdf4'
                                    : uploadState.status === 'error'
                                      ? '#fef2f2'
                                      : '#fffbf5',
                              }}
                            >
                              {uploadState.status === 'uploading' ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Uploading…
                                </>
                              ) : uploadState.status === 'success' ? (
                                <>
                                  <CheckCircle2 size={12} />
                                  Uploaded successfully
                                </>
                              ) : uploadState.status === 'error' ? (
                                <>
                                  <AlertTriangle size={12} />
                                  {uploadState.message ?? 'Upload failed'} — try
                                  again
                                </>
                              ) : (
                                <>
                                  <ImagePlus size={12} />
                                  Add diagram (SVG, PNG, JPG)
                                </>
                              )}
                            </button>
                          )}

                          {/* Hidden file input */}
                          <input
                            type="file"
                            accept={ALLOWED_EXTENSIONS}
                            className="hidden"
                            ref={(el) => {
                              fileInputRefs.current[key] = el;
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(file, row.id, sIdx, pIdx);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
      </div>
    </div>
  );
}

// ─── Style badge ──────────────────────────────────────────────────────────────

function StyleBadge({ label }: { label: string }) {
  const map: Record<string, { bg: string; text: string; color: string }> = {
    normal: { bg: '#f3f4f6', text: 'normal', color: '#6b7280' },
    'key-point': { bg: '#FEF9F0', text: 'key point', color: '#d97706' },
    'exam-tip': { bg: '#F4F8F6', text: 'exam tip', color: '#4A7C63' },
    'watch-out': { bg: '#FDF5F3', text: 'watch out', color: '#B5564D' },
    subheading: { bg: '#f0f4ff', text: 'subheading', color: '#4f6bbf' },
  };
  const style = map[label] ?? map.normal;
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
      style={{ background: style.bg, color: style.color }}
    >
      {style.text}
    </span>
  );
}
