import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.subtopicId]);

  const loadQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);
    try {
      // Fetch subtopic marking guidance alongside questions
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

      // Store marking guidance if present
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

  const handleFinish = async () => {
    setPhase('marking');
    for (const q of questions) {
      if (hasAnswer(q) && !feedbacks[q.id]) {
        await markAnswer(q.id);
      }
    }
    setPhase('review');
    setCurrentIndex(0);
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

  if (loading || generatingQuestions) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your questions…</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">
          Could not load questions. Please try again.
        </p>
        <button
          onClick={loadQuestions}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
        >
          <Sparkles size={14} /> Try again
        </button>
        <button
          onClick={onExit}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-border/60">
        <div className="max-w-[720px] mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-wide">
            {config.subtopicName}
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
                className="text-xs text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1"
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

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10">
        <div
          className="bg-card rounded-xl p-8 sm:p-10"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          {phase === 'review' && currentFeedback ? (
            <FeedbackCard
              feedback={currentFeedback}
              questionNumber={currentIndex + 1}
            />
          ) : phase === 'marking' && isMarking ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Marking question {currentIndex + 1}…
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

              {phase === 'answering' &&
                currentQuestion &&
                hasAnswer(currentQuestion) &&
                !feedbacks[currentQuestion.id] && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => markAnswer(currentQuestion.id)}
                      disabled={!!markingId}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
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

        <div className="flex items-center justify-between mt-8 px-1">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors py-1"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div className="flex items-center gap-1.5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? 'w-2.5 h-2.5 bg-foreground/50'
                    : feedbacks[q.id]
                      ? `w-1.5 h-1.5 ${feedbacks[q.id].marks_awarded / feedbacks[q.id].marks_available >= 0.7 ? 'bg-[hsl(var(--success))]' : 'bg-primary'}`
                      : hasAnswer(q)
                        ? 'w-1.5 h-1.5 bg-foreground/25'
                        : 'w-1.5 h-1.5 bg-border'
                }`}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>

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
              className="text-xs text-primary hover:text-primary/80 transition-colors py-1 disabled:opacity-30 disabled:cursor-default"
            >
              Finish & mark all
            </button>
          ) : (
            <button
              onClick={onExit}
              className="text-xs text-primary hover:text-primary/80 transition-colors py-1"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
