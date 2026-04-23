import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QuestionCard } from './QuestionCard';
import { FeedbackCard, MarkingFeedback } from './FeedbackCard';
import { SessionConfig } from './SessionSetup';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  Send,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface QuestionPart {
  part_label: string;
  part_text: string;
  marks: number;
}

interface Question {
  id: string;
  question_text: string;
  marks: number;
  question_order: number;
  parts: QuestionPart[];
  mark_scheme: unknown;
  worked_solution: string;
  diagram_type?: string | null;
  diagram_params?: Record<string, unknown> | null;
  diagram_url?: string | null;
}

interface PracticeRoomProps {
  config: SessionConfig;
  onExit: () => void;
}

type SessionPhase = 'answering' | 'marking' | 'review';

const CARD_SHADOW = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)';

/* ------------------------------------------------------------------ */
/*  Session progress pills                                             */
/* ------------------------------------------------------------------ */

function SessionProgress({
  questions,
  currentIndex,
  feedbacks,
  hasAnswer,
  goTo,
}: {
  questions: Question[];
  currentIndex: number;
  feedbacks: Record<string, MarkingFeedback>;
  hasAnswer: (q: Question) => boolean;
  goTo: (i: number) => void;
}) {
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const totalAwarded = Object.values(feedbacks).reduce(
    (s, f) => s + f.marks_awarded,
    0
  );
  const hasFeedback = Object.keys(feedbacks).length > 0;

  return (
    <div className="flex items-center gap-4 px-1 mb-4">
      <div className="flex gap-1.5 items-center">
        {questions.map((q, i) => {
          const isActive = i === currentIndex;
          const fb = feedbacks[q.id];
          const answered = hasAnswer(q);

          let bg = '#D4CEC6';
          if (isActive) bg = '#4A4540';
          else if (fb) {
            const pct = fb.marks_awarded / fb.marks_available;
            if (pct >= 0.7) bg = '#2D9A5F';
            else if (pct >= 0.3) bg = '#F5A623';
            else bg = '#E23D28';
          } else if (answered) bg = '#A09A92';

          return (
            <button
              key={q.id}
              onClick={() => goTo(i)}
              className="flex items-center justify-center transition-all duration-200"
              style={{
                width: isActive ? 30 : 24,
                height: 24,
                borderRadius: 7,
                background: bg,
                boxShadow: isActive
                  ? '0 2px 8px rgba(74,69,64,0.30)'
                  : fb
                    ? '0 1px 4px rgba(0,0,0,0.15)'
                    : 'none',
              }}
              aria-label={`Go to question ${i + 1}`}
            >
              <span
                className="text-[10px] font-semibold"
                style={{
                  color: isActive || fb || answered ? '#fff' : '#8C857C',
                }}
              >
                {fb ? fb.marks_awarded : `Q${i + 1}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {hasFeedback && (
        <div className="flex items-baseline gap-1">
          <span
            className="text-lg font-semibold"
            style={{
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {totalAwarded}
          </span>
          <span className="text-xs text-muted-foreground">/ {totalMarks}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PracticeRoom({ config, onExit }: PracticeRoomProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [partAnswers, setPartAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [phase, setPhase] = useState<SessionPhase>('answering');
  const [feedbacks, setFeedbacks] = useState<Record<string, MarkingFeedback>>(
    {}
  );
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [markingGuidance, setMarkingGuidance] = useState<string | null>(null);

  // Timer: records when questions first become available
  const sessionStartTime = useRef<number | null>(null);

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.subtopicId]);

  const loadQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);
    try {
      const [seededRes, subtopicRes] = await Promise.all([
        supabase
          .from('seeded_questions')
          .select(
            'id, question_text, marks, question_order, mark_scheme, worked_solution, diagram_url'
          )
          .eq('subtopic_id', config.subtopicId)
          .order('question_order'),
        supabase
          .from('subtopics')
          .select('prompt_config')
          .eq('id', config.subtopicId)
          .single(),
      ]);

      const guidance =
        (subtopicRes.data?.prompt_config as any)?.marking_guidance || null;
      setMarkingGuidance(guidance);

      if (seededRes.data && seededRes.data.length > 0) {
        setQuestions(
          seededRes.data.map((q) => ({
            ...q,
            parts: [],
            diagram_type: null,
            diagram_params: null,
            diagram_url: (q as any).diagram_url || null,
          }))
        );
        setCurrentIndex(0);
        setAnswers({});
        setPartAnswers({});
        setFeedbacks({});
        setPhase('answering');
        setGeneratingQuestions(false);
        sessionStartTime.current = Date.now();
      } else {
        await generateAIQuestions();
      }
    } catch (e: any) {
      await generateAIQuestions();
    }
  };

  const generateAIQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-questions',
        {
          body: { subtopicId: config.subtopicId, count: 4 },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuestions(
        data.questions.map((q: any) => ({
          ...q,
          parts: q.parts || [],
          diagram_type: q.diagram_type || null,
          diagram_params: q.diagram_params || null,
          diagram_url: q.diagram_url || null,
        }))
      );
      setCurrentIndex(0);
      setAnswers({});
      setPartAnswers({});
      setFeedbacks({});
      setPhase('answering');
      sessionStartTime.current = Date.now();
    } catch (e: any) {
      toast({
        title: 'Question generation failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const goTo = (index: number) => setCurrentIndex(index);

  const handleAnswerChange = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handlePartAnswerChange = (partLabel: string, value: string) => {
    if (!currentQuestion) return;
    setPartAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || {}),
        [partLabel]: value,
      },
    }));
  };

  const buildAnswerForMarking = (q: Question): string => {
    const isMultiPart = q.parts && q.parts.length > 0;
    if (isMultiPart) {
      const parts = partAnswers[q.id] || {};
      return q.parts
        .map(
          (p) =>
            `Part (${p.part_label}): ${parts[p.part_label] || '(no answer)'}`
        )
        .join('\n\n');
    }
    return answers[q.id] || '';
  };

  const hasAnswer = (q: Question): boolean => {
    const isMultiPart = q.parts && q.parts.length > 0;
    if (isMultiPart) {
      const parts = partAnswers[q.id] || {};
      return q.parts.some((p) => parts[p.part_label]?.trim());
    }
    return !!answers[q.id]?.trim();
  };

  const markAnswer = async (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q || !hasAnswer(q)) return;
    const studentAnswer = buildAnswerForMarking(q);

    setMarkingId(questionId);
    try {
      const { data, error } = await supabase.functions.invoke('mark-answer', {
        body: {
          questionText: q.question_text,
          parts: q.parts,
          markScheme: q.mark_scheme,
          workedSolution: q.worked_solution,
          studentAnswer,
          marks: q.marks,
          markingGuidance,
          subject: config.subject,
          examBoard: config.examBoard,
          tier: config.tier,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFeedbacks((prev) => ({ ...prev, [questionId]: data.feedback }));
    } catch (e: any) {
      toast({
        title: 'Marking failed',
        description: e.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMarkingId(null);
    }
  };

  const saveSession = async (
    finalFeedbacks: Record<string, MarkingFeedback>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const durationSeconds = sessionStartTime.current
        ? Math.round((Date.now() - sessionStartTime.current) / 1000)
        : 0;

      const marksAwarded = Object.values(finalFeedbacks).reduce(
        (s, f) => s + f.marks_awarded,
        0
      );
      const marksAvailable = Object.values(finalFeedbacks).reduce(
        (s, f) => s + f.marks_available,
        0
      );

      const questionResults = questions.map((q, i) => {
        const fb = finalFeedbacks[q.id];
        return {
          question_order: i + 1,
          marks_awarded: fb?.marks_awarded ?? 0,
          marks_available: fb?.marks_available ?? q.marks,
          question_text: q.question_text,
        };
      });

      await supabase.from('session_results').insert({
        user_id: user.id,
        subtopic_id: config.subtopicId,
        marks_awarded: marksAwarded,
        marks_available: marksAvailable,
        questions_attempted: questions.filter((q) => hasAnswer(q)).length,
        duration_seconds: durationSeconds,
        question_results: questionResults,
      });
    } catch (e) {
      // Fail silently — don't interrupt the student's review experience
      console.error('Failed to save session result:', e);
    }
  };

  const handleFinish = async () => {
    setPhase('marking');
    const updatedFeedbacks = { ...feedbacks };
    for (const q of questions) {
      if (hasAnswer(q) && !feedbacks[q.id]) {
        await markAnswer(q.id);
        // markAnswer updates state but we need the latest value for saveSession
        // so we re-read from the ref after each mark
      }
    }
    setPhase('review');
    setCurrentIndex(0);
    // Use a short timeout to ensure feedbacks state has fully updated before saving
    setTimeout(async () => {
      setFeedbacks((prev) => {
        saveSession(prev);
        return prev;
      });
    }, 100);
  };

  const allAnswered = questions.every((q) => hasAnswer(q));
  const currentFeedback = currentQuestion
    ? feedbacks[currentQuestion.id]
    : null;
  const isMarking = markingId === currentQuestion?.id;
  const totalAwarded = Object.values(feedbacks).reduce(
    (s, f) => s + f.marks_awarded,
    0
  );
  const totalAvailable = Object.values(feedbacks).reduce(
    (s, f) => s + f.marks_available,
    0
  );

  const progressPct =
    phase === 'review' ? 100 : ((currentIndex + 1) / questions.length) * 100;

  if (loading || generatingQuestions) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        {/* Branded loading state */}
        <div className="w-full max-w-[480px] space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-6 h-6 rounded-full animate-spin flex-shrink-0"
              style={{
                background:
                  'conic-gradient(from 0deg, #E23D28, #F5A623, #E23D28)',
                maskImage:
                  'radial-gradient(farthest-side, transparent 60%, black 61%)',
                WebkitMaskImage:
                  'radial-gradient(farthest-side, transparent 60%, black 61%)',
              }}
            />
            <p className="text-sm text-muted-foreground">
              Preparing your questions...
            </p>
          </div>
          {/* Skeleton lines */}
          <div
            className="bg-card rounded-xl p-8 space-y-4"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="h-3 bg-muted rounded-full w-1/4 animate-pulse" />
            <div className="h-4 bg-muted rounded-full w-full animate-pulse" />
            <div className="h-4 bg-muted rounded-full w-5/6 animate-pulse" />
            <div className="h-4 bg-muted rounded-full w-4/5 animate-pulse" />
            <div className="mt-6 h-[80px] bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <div
          className="bg-card rounded-xl p-8 text-center max-w-sm w-full"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <p className="text-muted-foreground text-sm mb-4">
            We couldn't load questions for this subtopic. Please try again.
          </p>
          <button
            onClick={loadQuestions}
            className="flex items-center gap-1.5 text-sm font-medium mx-auto transition-all duration-150 px-4 py-2 rounded-lg"
            style={{
              color: '#fff',
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              boxShadow: '0 2px 10px rgba(226,61,40,0.28)',
            }}
          >
            <Sparkles size={13} /> Try again
          </button>
          <button
            onClick={onExit}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors block mx-auto"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/60">
        <div className="max-w-[720px] mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-tight">
            <span className="font-medium text-foreground/70">
              {config.subtopicName}
            </span>
            <span className="mx-2 text-border">·</span>
            {phase === 'review'
              ? `${totalAwarded}/${totalAvailable} marks`
              : `${totalMarks} marks total`}
          </span>
          <div className="flex items-center gap-3">
            {phase === 'answering' && (
              <button
                onClick={generateAIQuestions}
                disabled={generatingQuestions}
                className="text-xs text-muted-foreground/60 hover:text-[#E23D28] transition-colors flex items-center gap-1"
                title="Generate new questions"
              >
                <Sparkles size={12} /> New set
              </button>
            )}
            <button
              onClick={onExit}
              className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
              aria-label="Exit session"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Brand gradient progress bar */}
      <div className="h-[3px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            background:
              'linear-gradient(90deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
          }}
        />
      </div>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-6">
        {/* Session progress pills */}
        <SessionProgress
          questions={questions}
          currentIndex={currentIndex}
          feedbacks={feedbacks}
          hasAnswer={hasAnswer}
          goTo={goTo}
        />

        {/* Main content card */}
        <div
          className="bg-card rounded-xl p-8 sm:p-10 relative overflow-hidden"
          style={{ boxShadow: CARD_SHADOW }}
        >
          {/* Gradient top accent */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{
              background:
                'linear-gradient(90deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
            }}
          />

          {phase === 'review' && currentFeedback ? (
            <FeedbackCard
              feedback={currentFeedback}
              questionNumber={currentIndex + 1}
            />
          ) : phase === 'marking' && isMarking ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div
                className="w-6 h-6 rounded-full animate-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, #E23D28, #F5A623, #E23D28)',
                  maskImage:
                    'radial-gradient(farthest-side, transparent 60%, black 61%)',
                  WebkitMaskImage:
                    'radial-gradient(farthest-side, transparent 60%, black 61%)',
                }}
              />
              <p className="text-sm text-muted-foreground">
                Marking question {currentIndex + 1}...
              </p>
            </div>
          ) : (
            <>
              <QuestionCard
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                questionText={currentQuestion?.question_text ?? ''}
                marks={currentQuestion?.marks ?? 0}
                parts={currentQuestion?.parts}
                answer={answers[currentQuestion?.id ?? ''] ?? ''}
                onAnswerChange={handleAnswerChange}
                diagramType={currentQuestion?.diagram_type}
                diagramParams={currentQuestion?.diagram_params}
                diagramUrl={currentQuestion?.diagram_url}
                partAnswers={partAnswers[currentQuestion?.id ?? ''] ?? {}}
                onPartAnswerChange={handlePartAnswerChange}
              />

              {/* Mark this question button */}
              {phase === 'answering' &&
                currentQuestion &&
                hasAnswer(currentQuestion) &&
                !feedbacks[currentQuestion.id] && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => markAnswer(currentQuestion.id)}
                      disabled={!!markingId}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 disabled:opacity-40 active:scale-[0.97]"
                      style={{
                        color: '#fff',
                        background:
                          'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                        boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
                      }}
                    >
                      {markingId === currentQuestion.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Mark this question
                    </button>
                  </div>
                )}

              {/* Inline feedback */}
              {phase === 'answering' &&
                currentQuestion &&
                feedbacks[currentQuestion.id] && (
                  <div className="mt-8 pt-6 border-t border-border/40">
                    <FeedbackCard
                      feedback={feedbacks[currentQuestion.id]}
                      questionNumber={currentIndex + 1}
                    />
                  </div>
                )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 px-1">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors py-1"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div />

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => goTo(currentIndex + 1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : phase === 'answering' ? (
            <button
              onClick={handleFinish}
              disabled={!allAnswered}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-default active:scale-[0.97]"
              style={{
                color: allAnswered ? '#fff' : undefined,
                background: allAnswered
                  ? 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)'
                  : undefined,
                boxShadow: allAnswered
                  ? '0 2px 10px rgba(226,61,40,0.28)'
                  : undefined,
              }}
            >
              Finish & mark all
            </button>
          ) : (
            <button
              onClick={onExit}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-[0.97]"
              style={{
                color: '#fff',
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                boxShadow: '0 2px 10px rgba(226,61,40,0.28)',
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
