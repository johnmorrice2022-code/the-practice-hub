import { useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FlagFeedbackProps {
  questionId: string;
  subtopicId: string;
  studentAnswer: string;
  marksAwarded: number;
  marksAvailable: number;
}

type FeedbackType = 'wrong_marking' | 'unclear_question' | 'other';

const options: { type: FeedbackType; label: string }[] = [
  { type: 'wrong_marking', label: 'My working was marked wrong' },
  { type: 'unclear_question', label: "The question wasn't clear" },
  { type: 'other', label: 'Something else' },
];

export function FlagFeedback({
  questionId,
  subtopicId,
  studentAnswer,
  marksAwarded,
  marksAvailable,
}: FlagFeedbackProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FeedbackType | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await supabase.from('question_feedback').insert({
        question_id: questionId,
        subtopic_id: subtopicId,
        user_id: user?.id ?? null,
        student_answer: studentAnswer,
        marks_awarded: marksAwarded,
        marks_available: marksAvailable,
        feedback_type: selected,
        student_comment: comment.trim() || null,
      });
      setSubmitted(true);
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Thanks — we'll take a look.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#E23D28] transition-colors"
      >
        <Flag size={12} />
        not sure this is right? let us know
      </button>
    );
  }

  return (
    <div className="space-y-3 w-full">
      <p className="text-xs text-muted-foreground">What's the issue?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => setSelected(opt.type)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={{
              borderColor: selected === opt.type ? '#E23D28' : undefined,
              background:
                selected === opt.type ? 'rgba(226,61,40,0.08)' : undefined,
              color: selected === opt.type ? '#E23D28' : undefined,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything to add? (optional)"
        rows={2}
        className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-[#E23D28]/40"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!selected || submitting}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
          style={{
            color: '#fff',
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
          }}
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
