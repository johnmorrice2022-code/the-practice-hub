import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Flag, Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

interface FeedbackRow {
  id: string;
  question_id: string;
  subtopic_id: string;
  student_answer: string;
  marks_awarded: number;
  marks_available: number;
  feedback_type: 'wrong_marking' | 'unclear_question' | 'other';
  student_comment: string | null;
  created_at: string;
  subtopics?: { subtopic_name: string } | null;
}

const feedbackTypeLabel: Record<string, string> = {
  wrong_marking: 'Marked wrong',
  unclear_question: 'Unclear question',
  other: 'Other',
};

const feedbackTypeColour: Record<string, string> = {
  wrong_marking: '#E23D28',
  unclear_question: '#F5A623',
  other: '#888',
};

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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

  useEffect(() => {
    if (!authed) return;
    loadFeedback();
  }, [authed]);

  const loadFeedback = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('question_feedback')
      .select('*, subtopics(subtopic_name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRows(data as FeedbackRow[]);
    }
    setLoading(false);
  };

  const deleteFeedback = async (id: string) => {
    await supabase.from('question_feedback').delete().eq('id', id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (!authChecked || !authed) return null;

  const filtered =
    filter === 'all' ? rows : rows.filter((r) => r.feedback_type === filter);

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Admin Hub
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <Flag size={14} color="#E23D28" />
              <span className="text-sm font-semibold text-gray-800">
                Question Feedback
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-400">{rows.length} total</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'wrong_marking', 'unclear_question', 'other'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: filter === f ? '#E23D28' : 'rgba(0,0,0,0.1)',
                background: filter === f ? 'rgba(226,61,40,0.08)' : 'white',
                color: filter === f ? '#E23D28' : '#888',
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f === 'all' ? 'All' : feedbackTypeLabel[f]}
              {f === 'all'
                ? ` (${rows.length})`
                : ` (${rows.filter((r) => r.feedback_type === f).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading feedback...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            No feedback yet.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="bg-white rounded-xl border p-5 space-y-3"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${feedbackTypeColour[row.feedback_type]}18`,
                        color: feedbackTypeColour[row.feedback_type],
                      }}
                    >
                      {feedbackTypeLabel[row.feedback_type]}
                    </span>
                    {row.subtopics?.subtopic_name && (
                      <span className="text-[11px] text-gray-400 font-medium">
                        {row.subtopics.subtopic_name}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-300">
                      {new Date(row.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: '#E23D28' }}
                    >
                      {row.marks_awarded}/{row.marks_available}
                    </span>
                    <button
                      onClick={() => deleteFeedback(row.id)}
                      className="text-[11px] text-gray-300 hover:text-red-400 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Student answer */}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-300 font-medium mb-1">
                    Student answer
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2">
                    {row.student_answer || '(no answer recorded)'}
                  </p>
                </div>

                {/* Comment */}
                {row.student_comment && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-300 font-medium mb-1">
                      Student comment
                    </p>
                    <p className="text-sm text-gray-600 italic">
                      "{row.student_comment}"
                    </p>
                  </div>
                )}

                {/* Question ID for reference */}
                <p className="text-[10px] text-gray-300 font-mono">
                  Q: {row.question_id}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
