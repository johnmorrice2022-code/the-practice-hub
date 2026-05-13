import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QuestionCard } from './QuestionCard';
import { FeedbackCard, MarkingFeedback } from './FeedbackCard';
import { JamHelpPanel } from './JamHelpPanel';
import { SessionConfig } from './SessionSetup';
import { TreeAnswers } from '@/components/diagrams/InteractiveProbabilityTree';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  Send,
  MessageCircle,
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
  diagram_component?: string | null;
}
interface PracticeRoomProps {
  config: SessionConfig;
  calculatorAllowed: boolean;
  onExit: () => void;
}
type SessionPhase = 'answering' | 'marking' | 'review';
const CARD_SHADOW = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)';

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

export function PracticeRoom({
  config,
  calculatorAllowed,
  onExit,
}: PracticeRoomProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [partAnswers, setPartAnswers] = useState<
    Record<string, Record<string, string>>
  >({});
  const [treeAnswers, setTreeAnswers] = useState<Record<string, TreeAnswers>>(
    {}
  );
  const [phase, setPhase] = useState<SessionPhase>('answering');
  const [feedbacks, setFeedbacks] = useState<Record<string, MarkingFeedback>>(
    {}
  );
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [markingGuidance, setMarkingGuidance] = useState<string | null>(null);
  const sessionStartTime = useRef<number | null>(null);

  // JAM Help state
  const [jamHelpOpen, setJamHelpOpen] = useState(false);
  const [jamHelpQuestion, setJamHelpQuestion] = useState<Question | null>(null);
  const [jamHelpAnswer, setJamHelpAnswer] = useState<string>('');
  const [jamHelpFeedback, setJamHelpFeedback] =
    useState<MarkingFeedback | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [config.subtopicId]);

  // ── Reset session state ───────────────────────────────────────────────────

  function resetSession() {
    setCurrentIndex(0);
    setAnswers({});
    setPartAnswers({});
    setTreeAnswers({});
    setFeedbacks({});
    setPhase('answering');
    sessionStartTime.current = Date.now();
  }

  // ── Load questions — three-tier priority ─────────────────────────────────
  //
  // Priority 1: seeded_questions (hand-authored, diagram topics)
  // Priority 2: questions table (teacher-reviewed AI questions)
  // Priority 3: live AI generation (fallback)

  const loadQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);

    try {
      const [seededRes, reviewedRes, subtopicRes] = await Promise.all([
        supabase
          .from('seeded_questions')
          .select(
            'id, question_text, marks, question_order, mark_scheme, worked_solution, diagram_url, diagram_component, diagram_params'
          )
          .eq('subtopic_id', config.subtopicId)
          .order('question_order'),
        supabase
          .from('questions')
          .select(
            'id, question_text, marks, mark_scheme, worked_solution, parts, calculator_allowed'
          )
          .eq('subtopic_id', config.subtopicId),
        supabase
          .from('subtopics')
          .select('prompt_config')
          .eq('id', config.subtopicId)
          .single(),
      ]);

      const guidance =
        (subtopicRes.data?.prompt_config as any)?.marking_guidance || null;
      setMarkingGuidance(guidance);

      // ── Priority 1: seeded questions ──────────────────────────────────────
      if (seededRes.data && seededRes.data.length > 0) {
        const shuffled = [...seededRes.data].sort(() => Math.random() - 0.5);
        setQuestions(
          shuffled.map((q) => ({
            ...q,
            parts: [],
            diagram_type: null,
            diagram_params: (q as any).diagram_params || null,
            diagram_url: (q as any).diagram_url || null,
            diagram_component: (q as any).diagram_component || null,
          }))
        );
        resetSession();
        setGeneratingQuestions(false);
        return;
      }

      // ── Priority 2: reviewed question bank ────────────────────────────────
      if (reviewedRes.data && reviewedRes.data.length >= 4) {
        // Prefer questions matching the current calculator mode
        const filtered = reviewedRes.data.filter(
          (q) =>
            q.calculator_allowed === null ||
            q.calculator_allowed === calculatorAllowed
        );
        const pool = filtered.length >= 4 ? filtered : reviewedRes.data;
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
        setQuestions(
          shuffled.map((q, i) => ({
            ...q,
            question_order: i + 1,
            parts: q.parts || [],
            diagram_type: null,
            diagram_params: null,
            diagram_url: null,
            diagram_component: null,
          }))
        );
        resetSession();
        setGeneratingQuestions(false);
        return;
      }

      // ── Priority 3: live AI generation ────────────────────────────────────
      await generateAIQuestions();
    } catch {
      await generateAIQuestions();
    }
  };

  // ── Live AI generation ────────────────────────────────────────────────────

  const generateAIQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);
    setQuestions([]);
    resetSession();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            subtopicId: config.subtopicId,
            count: 4,
            calculatorAllowed,
          }),
        }
      );

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstQuestion = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const q = JSON.parse(trimmed);
            setQuestions((prev) => [
              ...prev,
              {
                ...q,
                parts: q.parts || [],
                diagram_type: q.diagram_type || null,
                diagram_params: q.diagram_params || null,
                diagram_url: q.diagram_url || null,
                diagram_component: q.diagram_component || null,
              },
            ]);
            if (firstQuestion) {
              firstQuestion = false;
              setGeneratingQuestions(false);
            }
          } catch {
            console.error('Failed to parse question line:', trimmed);
          }
        }
      }
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

  // ── Session helpers ───────────────────────────────────────────────────────

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

  const handleTreeAnswerChange = (questionId: string, values: TreeAnswers) => {
    setTreeAnswers((prev) => ({ ...prev, [questionId]: values }));
  };

  function serialiseTreeAnswers(questionId: string): string {
    const ta = treeAnswers[questionId];
    if (!ta || Object.keys(ta).length === 0) return '';
    const entries = Object.entries(ta)
      .filter(([, v]) => v.num.trim() || v.den.trim())
      .map(([id, v]) => `${id} = ${v.num || '?'}/${v.den || '?'}`);
    if (entries.length === 0) return '';
    return `Filled branches: ${entries.join(', ')}`;
  }

  const buildAnswerForMarking = (q: Question): string => {
    const isMultiPart = q.parts && q.parts.length > 0;

    const hasHiddenBranches =
      q.diagram_component === 'probability-tree' &&
      q.diagram_params != null &&
      (() => {
        try {
          const cfg = q.diagram_params as {
            stages?: Array<{ branches?: Array<{ hidden?: boolean }> }>;
          };
          return (
            cfg.stages?.some((s) =>
              s.branches?.some((b) => b.hidden === true)
            ) ?? false
          );
        } catch {
          return false;
        }
      })();

    if (isMultiPart) {
      const parts = partAnswers[q.id] || {};
      return q.parts
        .map(
          (p) =>
            `Part (${p.part_label}): ${parts[p.part_label] || '(no answer)'}`
        )
        .join('\n\n');
    }

    if (hasHiddenBranches) {
      const treePart = serialiseTreeAnswers(q.id);
      const writtenPart = answers[q.id]?.trim() || '';
      if (treePart && writtenPart) return `${treePart}\n\n${writtenPart}`;
      if (treePart) return treePart;
      if (writtenPart) return writtenPart;
      return '';
    }

    return answers[q.id] || '';
  };

  const hasAnswer = (q: Question): boolean => {
    const isMultiPart = q.parts && q.parts.length > 0;
    if (isMultiPart) {
      const parts = partAnswers[q.id] || {};
      return q.parts.some((p) => parts[p.part_label]?.trim());
    }

    const hasHiddenBranches =
      q.diagram_component === 'probability-tree' &&
      q.diagram_params != null &&
      (() => {
        try {
          const cfg = q.diagram_params as {
            stages?: Array<{ branches?: Array<{ hidden?: boolean }> }>;
          };
          return (
            cfg.stages?.some((s) =>
              s.branches?.some((b) => b.hidden === true)
            ) ?? false
          );
        } catch {
          return false;
        }
      })();

    if (hasHiddenBranches) {
      const ta = treeAnswers[q.id];
      if (ta && Object.values(ta).some((v) => v.num.trim() || v.den.trim()))
        return true;
      return !!answers[q.id]?.trim();
    }

    return !!answers[q.id]?.trim();
  };

  const markAnswer = async (questionId: string) => {
    const q = questions.find((q) => q.id === questionId);
    if (!q || !hasAnswer(q)) return;
    setMarkingId(questionId);
    try {
      const { data, error } = await supabase.functions.invoke('mark-answer', {
        body: {
          questionText: q.question_text,
          parts: q.parts,
          markScheme: q.mark_scheme,
          workedSolution: q.worked_solution,
          studentAnswer: buildAnswerForMarking(q),
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
      console.error('Failed to save session result:', e);
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
    setTimeout(async () => {
      setFeedbacks((prev) => {
        saveSession(prev);
        return prev;
      });
    }, 100);
  };

  const handleJamHelp = (
    q: Question,
    answer: string,
    feedback?: MarkingFeedback | null
  ) => {
    setJamHelpQuestion(q);
    setJamHelpAnswer(answer);
    setJamHelpFeedback(feedback ?? null);
    setJamHelpOpen(true);
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const allAnswered =
    questions.length > 0 && questions.every((q) => hasAnswer(q));
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
    phase === 'review'
      ? 100
      : ((currentIndex + 1) / Math.max(questions.length, 1)) * 100;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || generatingQuestions) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
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
    <>
      <div className="min-h-screen bg-background">
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
              <span className="mx-2 text-border">·</span>
              <span
                className={
                  calculatorAllowed ? 'text-[#2D9A5F]' : 'text-[#E23D28]'
                }
              >
                {calculatorAllowed ? 'Calculator' : 'No calculator'}
              </span>
            </span>
            <div className="flex items-center gap-3">
              {phase === 'answering' && (
                <button
                  onClick={loadQuestions}
                  disabled={generatingQuestions}
                  className="text-xs text-muted-foreground/60 hover:text-[#E23D28] transition-colors flex items-center gap-1"
                  title="New set of questions"
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
          <SessionProgress
            questions={questions}
            currentIndex={currentIndex}
            feedbacks={feedbacks}
            hasAnswer={hasAnswer}
            goTo={goTo}
          />

          <div
            className="bg-card rounded-xl p-8 sm:p-10 relative overflow-hidden"
            style={{ boxShadow: CARD_SHADOW }}
          >
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
                onJamHelp={() =>
                  handleJamHelp(
                    currentQuestion,
                    buildAnswerForMarking(currentQuestion),
                    currentFeedback
                  )
                }
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
                  diagramComponent={currentQuestion?.diagram_component}
                  partAnswers={partAnswers[currentQuestion?.id ?? ''] ?? {}}
                  onPartAnswerChange={handlePartAnswerChange}
                  treeAnswers={treeAnswers[currentQuestion?.id ?? ''] ?? {}}
                  onTreeAnswerChange={(values) =>
                    handleTreeAnswerChange(currentQuestion?.id ?? '', values)
                  }
                  treeDisabled={phase !== 'answering'}
                />

                {phase === 'answering' &&
                  currentQuestion &&
                  !feedbacks[currentQuestion.id] && (
                    <div className="mt-4 flex items-center justify-between">
                      <button
                        onClick={() =>
                          handleJamHelp(
                            currentQuestion,
                            buildAnswerForMarking(currentQuestion),
                            null
                          )
                        }
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#E23D28] transition-colors"
                      >
                        <MessageCircle size={12} /> JAM Help
                      </button>

                      {hasAnswer(currentQuestion) && (
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
                      )}
                    </div>
                  )}

                {phase === 'answering' &&
                  currentQuestion &&
                  feedbacks[currentQuestion.id] && (
                    <div className="mt-8 pt-6 border-t border-border/40">
                      <FeedbackCard
                        feedback={feedbacks[currentQuestion.id]}
                        questionNumber={currentIndex + 1}
                        onJamHelp={() =>
                          handleJamHelp(
                            currentQuestion,
                            buildAnswerForMarking(currentQuestion),
                            feedbacks[currentQuestion.id]
                          )
                        }
                      />
                    </div>
                  )}
              </>
            )}
          </div>

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
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                  boxShadow: '0 2px 10px rgba(226,61,40,0.28)',
                }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      {jamHelpQuestion && (
        <JamHelpPanel
          isOpen={jamHelpOpen}
          onClose={() => setJamHelpOpen(false)}
          questionText={jamHelpQuestion.question_text}
          studentAnswer={jamHelpAnswer}
          feedback={jamHelpFeedback}
          subject={config.subject}
          tier={config.tier}
          examBoard={config.examBoard}
        />
      )}
    </>
  );
}
