import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QuestionCard } from './QuestionCard';
import { FeedbackCard, MarkingFeedback } from './FeedbackCard';
import { JamHelpPanel } from './JamHelpPanel';
import { SteppedPlayer } from './SteppedPlayer';
import { MathEditor } from './MathEditor';
import { SessionConfig } from './SessionSetup';
import { TreeAnswers } from '@/components/diagrams/InteractiveProbabilityTree';
import {
  buildWorking,
  type SteppedQuestion,
  type SelectRevealEntry,
} from '@/lib/steppedQuestion';
import { renderMathInText } from '@/lib/renderMathInText';
import {
  getQuestionDiagram,
  isQuestionSafe,
} from '@/components/diagrams/questionDiagramRegistry';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  Send,
  MessageCircle,
  Check,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface QuestionPart {
  part_label: string;
  part_text: string;
  marks: number;
  mark_scheme?: any[];
  worked_solution?: string;
  answer_model?: string;
  steps?: SteppedQuestion | null;
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
  answer_model?: string | null;
  steps?: SteppedQuestion | null;
}
interface PracticeRoomProps {
  config: SessionConfig;
  calculatorAllowed: boolean;
  onExit: () => void;
}
type SessionPhase = 'answering' | 'marking' | 'review';
const CARD_SHADOW = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)';
const FREE_QUESTION_LIMIT = 10;
const FREE_JAM_HELP_TURNS = 2;
const SUBSCRIBER_JAM_HELP_TURNS = 5;

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

// ─── Multi-part question with some stepped (calc) parts ─────────────────────
// Renders the shared stem + diagram, then each part as either a SteppedPlayer
// (for calc parts) or a text input (for non-calc parts). JAM Help + "Provide
// stepped help" are available on every calc part.

function MultiPartSteppedView({
  question,
  questionNumber,
  totalQuestions,
  tier,
  phase,
  partResults,
  partAnswers: textAnswers,
  markingId,
  onPartAnswerChange,
  onSteppedPartComplete,
  onJamHelp,
  onSteppedJamHelp,
  onMark,
  hasAnswer: hasAny,
}: {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  tier?: string;
  phase: SessionPhase;
  partResults: Record<string, { marksAwarded: number; stepBreakdown: any[]; workedSolution: string }>;
  partAnswers: Record<string, string>;
  markingId: string | null;
  onPartAnswerChange: (partLabel: string, value: string) => void;
  onSteppedPartComplete: (partLabel: string, part: QuestionPart, marksAwarded: number) => void;
  onJamHelp: (answer: string, feedback?: MarkingFeedback | null) => void;
  onSteppedJamHelp: (args: { studentAttempt: string; criterion: string }) => void;
  onMark: () => void;
  hasAnswer: boolean;
}) {
  const q = question;

  const questionSafe = isQuestionSafe(q.diagram_component, q.diagram_params);
  const RegisteredDiagram = questionSafe
    ? getQuestionDiagram(q.diagram_component)
    : null;

  const isPartCalc = (p: QuestionPart): boolean =>
    p.answer_model === 'stepped_calculation' &&
    !!p.steps &&
    typeof p.steps === 'object' &&
    Array.isArray((p.steps as any).steps) &&
    (p.steps as any).steps.length > 0;

  const hasTextParts = q.parts.some((p) => !isPartCalc(p));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Question {questionNumber}
          <span className="mx-1.5 opacity-40">/</span>
          {totalQuestions}
        </span>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            color: '#E23D28',
            background: 'rgba(226,61,40,0.08)',
            letterSpacing: '0.02em',
          }}
        >
          {q.marks} mark{q.marks !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Shared question stem */}
      <div
        className="text-foreground leading-[1.85] text-[15px] question-text"
        dangerouslySetInnerHTML={{ __html: renderMathInText(q.question_text) }}
      />

      {/* Shared diagram */}
      {RegisteredDiagram && q.diagram_params && (
        <div className="flex justify-center py-2">
          <div
            className="bg-[#FAF7F2] border border-border/40 rounded-xl p-5 w-full"
            style={{ maxWidth: 680, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <RegisteredDiagram params={q.diagram_params} mode="question" />
          </div>
        </div>
      )}

      {/* Parts */}
      <div className="space-y-6">
        {q.parts.map((part) => {
          const calc = isPartCalc(part);
          const completed = calc && !!partResults[part.part_label];

          return (
            <div key={part.part_label} className="space-y-3">
              <div className="border-t border-border/50" />
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: '#78716C' }}
                >
                  Part ({part.part_label})
                </span>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: completed ? '#2D9A5F' : '#E23D28',
                    background: completed
                      ? 'rgba(45,154,95,0.08)'
                      : 'rgba(226,61,40,0.08)',
                  }}
                >
                  {completed
                    ? `${partResults[part.part_label].marksAwarded}/${part.marks} marks`
                    : `${part.marks} mark${part.marks !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div
                className="text-foreground leading-[1.85] text-[15px] question-text"
                dangerouslySetInnerHTML={{
                  __html: renderMathInText(part.part_text),
                }}
              />

              {calc ? (
                completed ? (
                  <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-emerald-50 border border-emerald-100">
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-700">
                      Complete — {partResults[part.part_label].marksAwarded}/{part.marks} marks
                    </span>
                  </div>
                ) : (
                  <SteppedPlayer
                    compact
                    questionText=""
                    marks={part.marks}
                    data={part.steps as SteppedQuestion}
                    tier={tier}
                    onComplete={(m) =>
                      onSteppedPartComplete(part.part_label, part, m)
                    }
                    onJamHelp={onSteppedJamHelp}
                  />
                )
              ) : (
                <MathEditor
                  value={textAnswers[part.part_label] ?? ''}
                  onChange={(v) => onPartAnswerChange(part.part_label, v)}
                  placeholder={`Working for part (${part.part_label})…`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mark button + JAM Help — only shown during answering phase */}
      {phase === 'answering' && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => onJamHelp('', null)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#E23D28] transition-colors"
          >
            <MessageCircle size={12} /> JAM Help
          </button>

          {hasAny && hasTextParts && (
            <button
              onClick={onMark}
              disabled={!!markingId}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-150 disabled:opacity-40 active:scale-[0.97]"
              style={{
                color: '#fff',
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                boxShadow: '0 2px 10px rgba(226,61,40,0.30)',
              }}
            >
              {markingId ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Mark this question
            </button>
          )}
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
  const { isSubscribed, questionsUsed, refreshProfile, user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [partAnswers, setPartAnswers] = useState<Record<string, Record<string, string>>>({});
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

  const [jamHelpOpen, setJamHelpOpen] = useState(false);
  const [jamHelpQuestion, setJamHelpQuestion] = useState<Question | null>(null);
  const [jamHelpAnswer, setJamHelpAnswer] = useState<string>('');
  const [jamHelpFeedback, setJamHelpFeedback] =
    useState<MarkingFeedback | null>(null);

  // Per-part stepped results for multi-part questions with stepped calc parts.
  // questionId → partLabel → { marksAwarded, stepBreakdown, workedSolution }
  const [steppedPartResults, setSteppedPartResults] = useState<
    Record<string, Record<string, {
      marksAwarded: number;
      stepBreakdown: any[];
      workedSolution: string;
    }>>
  >({});

  useEffect(() => {
    loadQuestions();
  }, [config.subtopicId]);

  function resetSession() {
    setCurrentIndex(0);
    setAnswers({});
    setPartAnswers({});
    setSteppedPartResults({});
    setTreeAnswers({});
    setFeedbacks({});
    setPhase('answering');
    sessionStartTime.current = Date.now();
  }

  const incrementQuestionsUsed = async () => {
    if (isSubscribed) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('profiles')
      .update({
        questions_used: questionsUsed + 1,
        questions_used_date: today,
      })
      .eq('id', user.id);
    await refreshProfile();
  };

  const loadQuestions = async () => {
    setGeneratingQuestions(true);
    setLoading(false);

    try {
      const [seededRes, reviewedRes, subtopicRes, profileRes] = await Promise.all([
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
            'id, question_text, marks, mark_scheme, worked_solution, parts, calculator_allowed, diagram_component, diagram_params, answer_model, steps, tier'
          )
          .eq('subtopic_id', config.subtopicId),
        supabase
          .from('subtopics')
          .select('prompt_config')
          .eq('id', config.subtopicId)
          .single(),
        user
          ? supabase
              .from('profiles')
              .select('maths_tier, physics_tier')
              .eq('id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const guidance =
        (subtopicRes.data?.prompt_config as any)?.marking_guidance || null;
      setMarkingGuidance(guidance);

      // Student's tier for this subject — used to filter "Both" subtopics so
      // Foundation students only see Foundation questions and vice versa.
      const studentTier =
        config.subject === 'Maths'
          ? profileRes.data?.maths_tier
          : profileRes.data?.physics_tier;

      const seededNormalised = (seededRes.data ?? []).map((q) => ({
        ...q,
        parts: [],
        diagram_type: null,
        diagram_params: (q as any).diagram_params || null,
        diagram_url: (q as any).diagram_url || null,
        diagram_component: (q as any).diagram_component || null,
      }));

      const reviewedPool = (reviewedRes.data ?? []).filter(
        (q) =>
          // Stepped questions are calculator-agnostic — never filter them out on
          // the calculator flag (otherwise Physics' always-"no calculator" mode
          // would hide every stepped question).
          ((q as any).answer_model === 'stepped_calculation' ||
          q.calculator_allowed === null ||
          q.calculator_allowed === calculatorAllowed) &&
          // Tier filter: for "Both" subtopics, only show questions matching the
          // student's tier. Questions with null tier (pre-tagging) or tier "Both"
          // are shown to all students.
          (config.tier !== 'Both' ||
           !studentTier ||
           !(q as any).tier ||
           (q as any).tier === 'Both' ||
           (q as any).tier === studentTier)
      );
      const reviewedNormalised = reviewedPool.map((q, i) => ({
        ...q,
        question_order: i + 1,
        parts: q.parts || [],
        diagram_type: null,
        diagram_params: (q as any).diagram_params || null,
        diagram_url: null,
        diagram_component: (q as any).diagram_component || null,
        answer_model: (q as any).answer_model || null,
        steps: (q as any).steps || null,
      }));

      const combined = [...seededNormalised, ...reviewedNormalised];

      if (combined.length > 0) {
        const shuffled = [...combined].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, Math.min(4, shuffled.length));
        setQuestions(picked as Question[]);
        resetSession();
        setGeneratingQuestions(false);
        incrementQuestionsUsed();
        return;
      }

      await generateAIQuestions();
    } catch {
      await generateAIQuestions();
    }
  };

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
              incrementQuestionsUsed();
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
      // For multi-part with stepped calc parts, only include non-stepped parts
      // in the answer string sent to the AI marker — stepped parts are checked
      // deterministically and their results are merged in separately.
      const partsToMark = hasSteppedParts(q)
        ? q.parts.filter((p) => !isPartStepped(p))
        : q.parts;
      return partsToMark
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
    // A stepped question counts as answered only once it has been completed
    // (its deterministic feedback has been recorded).
    if (q.answer_model === 'stepped_calculation') return !!feedbacks[q.id];

    const isMultiPart = q.parts && q.parts.length > 0;
    if (isMultiPart) {
      if (hasSteppedParts(q)) {
        const partResults = steppedPartResults[q.id] || {};
        const textParts = partAnswers[q.id] || {};
        return (
          q.parts.some((p) => isPartStepped(p) && partResults[p.part_label]) ||
          q.parts.some((p) => !isPartStepped(p) && textParts[p.part_label]?.trim())
        );
      }
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
    // Stepped questions are never sent to the AI marker — they are checked
    // deterministically by SteppedPlayer.
    if (isStepped(q)) return;

    // Multi-part with ALL parts stepped — combine stepped results directly,
    // no AI call needed.
    if (hasSteppedParts(q) && q.parts.every(isPartStepped)) {
      buildCombinedFeedbackForSteppedParts(q);
      return;
    }

    setMarkingId(questionId);
    try {
      const isMultiPart = q.parts && q.parts.length > 0;
      const hasMixedStepped = isMultiPart && hasSteppedParts(q);

      let effectiveMarkScheme = q.mark_scheme;
      let effectiveWorkedSolution = q.worked_solution;
      if (isMultiPart) {
        const topScheme = Array.isArray(q.mark_scheme) ? q.mark_scheme as any[] : [];
        if (topScheme.filter((m: any) => m.mark !== 'TOTAL').length === 0) {
          const aggregated: any[] = [];
          // For hybrid multi-part, only send non-stepped parts' schemes to AI
          const partsToAggregate = hasMixedStepped
            ? q.parts.filter((p) => !isPartStepped(p))
            : q.parts;
          for (const p of partsToAggregate as any[]) {
            const ps = Array.isArray(p.mark_scheme) ? p.mark_scheme : [];
            for (const entry of ps) {
              if (entry.mark === 'TOTAL') continue;
              aggregated.push({ ...entry, part: p.part_label });
            }
          }
          effectiveMarkScheme = aggregated;
        }
        if (!q.worked_solution?.trim()) {
          const partsForSolution = hasMixedStepped
            ? q.parts.filter((p) => !isPartStepped(p))
            : q.parts;
          effectiveWorkedSolution = (partsForSolution as any[])
            .filter((p: any) => p.worked_solution?.trim())
            .map((p: any) => `Part (${p.part_label}):\n${p.worked_solution}`)
            .join('\n\n');
        }
      }

      // For hybrid multi-part, only send non-stepped parts to AI
      const partsForAi = hasMixedStepped
        ? q.parts.filter((p) => !isPartStepped(p))
        : q.parts;
      const marksForAi = hasMixedStepped
        ? partsForAi.reduce((s, p) => s + p.marks, 0)
        : q.marks;

      const { data, error } = await supabase.functions.invoke('mark-answer', {
        body: {
          questionText: q.question_text,
          parts: partsForAi,
          markScheme: effectiveMarkScheme,
          workedSolution: effectiveWorkedSolution,
          studentAnswer: buildAnswerForMarking(q),
          marks: marksForAi,
          markingGuidance,
          subject: config.subject,
          examBoard: config.examBoard,
          tier: config.tier,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (hasMixedStepped) {
        // Merge AI feedback (text parts) with stepped results (calc parts)
        const aiFeedback = data.feedback as MarkingFeedback;
        const partResults = steppedPartResults[questionId] || {};

        const steppedBreakdown: any[] = [];
        let steppedMarks = 0;
        let steppedWorkedSolution = '';
        for (const p of q.parts.filter(isPartStepped)) {
          const res = partResults[p.part_label];
          if (res) {
            steppedMarks += res.marksAwarded;
            steppedBreakdown.push(...res.stepBreakdown.map((s: any) => ({
              ...s, part: p.part_label,
            })));
            if (res.workedSolution) {
              steppedWorkedSolution += `Part (${p.part_label}):\n${res.workedSolution}\n\n`;
            }
          }
        }

        setFeedbacks((prev) => ({
          ...prev,
          [questionId]: {
            marks_awarded: steppedMarks + aiFeedback.marks_awarded,
            marks_available: q.marks,
            step_breakdown: [
              ...steppedBreakdown,
              ...aiFeedback.step_breakdown,
            ],
            error_type: aiFeedback.error_type,
            feedback_summary: aiFeedback.feedback_summary,
            worked_solution: steppedWorkedSolution + (aiFeedback.worked_solution || ''),
            revision_focus: aiFeedback.revision_focus,
          },
        }));
      } else {
        setFeedbacks((prev) => ({ ...prev, [questionId]: data.feedback }));
      }
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

  const isStepped = (q: Question | null | undefined): boolean =>
    !!q &&
    q.answer_model === 'stepped_calculation' &&
    !!q.steps &&
    Array.isArray(q.steps.steps) &&
    q.steps.steps.length > 0;

  const isPartStepped = (p: QuestionPart): boolean =>
    p.answer_model === 'stepped_calculation' &&
    !!p.steps &&
    typeof p.steps === 'object' &&
    Array.isArray((p.steps as any).steps) &&
    (p.steps as any).steps.length > 0;

  const hasSteppedParts = (q: Question | null | undefined): boolean =>
    !!q &&
    q.parts.length > 0 &&
    q.parts.some(isPartStepped);

  // A stepped question is checked deterministically by SteppedPlayer; on
  // completion we record a feedback so progress, session saving and the review
  // phase all work through the existing feedback path. Calculations award full
  // marks (completing the scaffold / a correct Direct answer); select_steps award
  // partial marks and reveal the correct method points in order (§7).
  const completeStepped = (
    q: Question,
    marksAwarded: number,
    reveal?: SelectRevealEntry[]
  ) => {
    setFeedbacks((prev) => ({
      ...prev,
      [q.id]: reveal
        ? {
            marks_awarded: marksAwarded,
            marks_available: q.marks,
            // §7 reveal: correct points in order (hit/missed) + flagged wrong picks.
            step_breakdown: reveal.map((r) => ({
              criterion: r.text,
              status: r.status,
              comment: r.wronglySelected
                ? 'You selected this — it is not a marking point.'
                : '',
            })),
            error_type: 'none',
            feedback_summary: '',
            worked_solution: '',
            revision_focus: '',
          }
        : {
            marks_awarded: marksAwarded,
            marks_available: q.marks,
            // Prefer the authored examiner breakdown (mark_scheme) — the question
            // has ONE final answer; this shows the full method. Fall back to the
            // step prompts only if no mark scheme was stored.
            step_breakdown:
              Array.isArray(q.mark_scheme) && q.mark_scheme.length > 0
                ? q.mark_scheme
                    .filter((m: any) => (m?.mark ?? m?.mark_type) !== 'TOTAL')
                    .map((m: any) => ({
                      mark_type: m?.mark_type ?? m?.mark,
                      criterion: m?.criterion ?? '',
                      status: 'awarded' as const,
                      comment: '',
                    }))
                : (q.steps?.steps ?? []).map((s) => ({
                    criterion: s.prompt,
                    status: 'awarded' as const,
                    comment: '',
                  })),
            error_type: 'none',
            feedback_summary: '',
            // Prefer the authored worked solution (the multi-equation breakdown);
            // fall back to assembling it from the steps. STEPPED_QUESTIONS.md §7.
            worked_solution:
              q.worked_solution?.trim() ||
              (q.steps ? buildWorking(q.steps) : ''),
            revision_focus: '',
          },
    }));
  };

  // "I'm stuck" on a step → open JAM Help with that step's target as context.
  const handleSteppedJamHelp = (
    q: Question,
    args: { studentAttempt: string; criterion: string }
  ) => {
    handleJamHelp(q, args.studentAttempt, {
      marks_awarded: 0,
      marks_available: q.marks,
      step_breakdown: [
        { criterion: args.criterion, status: 'not_awarded', comment: '' },
      ],
      error_type: '',
      feedback_summary: '',
      worked_solution: '',
      revision_focus: '',
    });
  };

  // Record the completion of a single stepped part within a multi-part question.
  const completeSteppedPart = (
    q: Question,
    partLabel: string,
    part: QuestionPart,
    marksAwarded: number,
  ) => {
    const steppedData = part.steps as SteppedQuestion;
    const breakdown = Array.isArray(part.mark_scheme) && part.mark_scheme.length > 0
      ? part.mark_scheme
          .filter((m: any) => (m?.mark ?? m?.mark_type) !== 'TOTAL')
          .map((m: any) => ({
            mark_type: m?.mark_type ?? m?.mark,
            criterion: m?.criterion ?? '',
            status: 'awarded' as const,
            comment: '',
            part: partLabel,
          }))
      : (steppedData?.steps ?? []).map((s) => ({
          criterion: s.prompt,
          status: 'awarded' as const,
          comment: '',
          part: partLabel,
        }));

    const workedSolution =
      part.worked_solution?.trim() ||
      (steppedData ? buildWorking(steppedData) : '');

    setSteppedPartResults((prev) => ({
      ...prev,
      [q.id]: {
        ...(prev[q.id] || {}),
        [partLabel]: { marksAwarded, stepBreakdown: breakdown, workedSolution },
      },
    }));

    // If every part of this question is now accounted for (all stepped parts
    // complete, and no text parts exist), auto-create combined feedback.
    const updatedResults = {
      ...(steppedPartResults[q.id] || {}),
      [partLabel]: { marksAwarded, stepBreakdown: breakdown, workedSolution },
    };
    const allSteppedDone = q.parts
      .filter(isPartStepped)
      .every((p) => updatedResults[p.part_label]);
    const hasTextParts = q.parts.some((p) => !isPartStepped(p));

    if (allSteppedDone && !hasTextParts) {
      buildCombinedFeedbackForSteppedParts(q, updatedResults);
    }
  };

  // Combine all per-part stepped results into a single feedback entry.
  const buildCombinedFeedbackForSteppedParts = (
    q: Question,
    results?: Record<string, { marksAwarded: number; stepBreakdown: any[]; workedSolution: string }>,
  ) => {
    const partResults = results || steppedPartResults[q.id] || {};
    let totalMarksAwarded = 0;
    const allBreakdown: any[] = [];
    let allWorkedSolution = '';

    for (const p of q.parts.filter(isPartStepped)) {
      const res = partResults[p.part_label];
      if (res) {
        totalMarksAwarded += res.marksAwarded;
        allBreakdown.push(...res.stepBreakdown);
        if (res.workedSolution) {
          allWorkedSolution += `Part (${p.part_label}):\n${res.workedSolution}\n\n`;
        }
      }
    }

    setFeedbacks((prev) => ({
      ...prev,
      [q.id]: {
        marks_awarded: totalMarksAwarded,
        marks_available: q.marks,
        step_breakdown: allBreakdown,
        error_type: 'none',
        feedback_summary: '',
        worked_solution: allWorkedSolution.trim(),
        revision_focus: '',
      },
    }));
  };

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

  if (!isSubscribed && questionsUsed >= FREE_QUESTION_LIMIT) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 py-12">
        <div
          className="bg-card rounded-xl p-8 text-center max-w-sm w-full"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)' }}
          >
            <Sparkles size={20} style={{ color: '#fff' }} />
          </div>
          <h2 className="text-base font-bold text-foreground mb-2">
            You've reached today's limit
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Free accounts get {FREE_QUESTION_LIMIT} questions per day. Unlock unlimited practice with a subscription.
          </p>
          <div className="space-y-2 mb-6">
            {[
              { label: 'The Practice Hub', price: '£10.99/mo', url: 'https://buy.stripe.com/test_7sY9AM1Ua34U89q0DMf7i04' },
              { label: 'Practice Hub + Maths Livestreams', price: '£18.99/mo', url: 'https://buy.stripe.com/test_eVq6oA42i20Q75meuCf7i05' },
              { label: 'Practice Hub + Physics Livestreams', price: '£18.99/mo', url: 'https://buy.stripe.com/test_eVq5kw7eu5d2blCgCKf7i06' },
              { label: 'Practice Hub + Maths & Physics Livestreams', price: '£24.99/mo', url: 'https://buy.stripe.com/test_28E9AMdCSaxm75mfyGf7i07' },
            ].map((plan) => {
              const href = user?.id ? `${plan.url}?client_reference_id=${user.id}` : plan.url;
              return (
                <a
                  key={plan.url}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-gray-200 hover:border-[#E23D28] hover:bg-[#E23D28]/5 transition-all text-left"
                >
                  <span className="text-sm font-medium text-foreground">{plan.label}</span>
                  <span className="text-sm font-bold text-[#E23D28] ml-2 shrink-0">{plan.price}</span>
                </a>
              );
            })}
          </div>
          <button
            onClick={onExit}
            className="w-full h-10 rounded-lg text-sm font-medium text-muted-foreground border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Back to hub
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            Come back tomorrow for {FREE_QUESTION_LIMIT} more free questions.
          </p>
        </div>
      </div>
    );
  }

  if (loading || generatingQuestions) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-full max-w-[480px] space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-6 h-6 rounded-full animate-spin flex-shrink-0"
              style={{
                background: 'conic-gradient(from 0deg, #E23D28, #F5A623, #E23D28)',
                maskImage: 'radial-gradient(farthest-side, transparent 60%, black 61%)',
                WebkitMaskImage: 'radial-gradient(farthest-side, transparent 60%, black 61%)',
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
              background: 'linear-gradient(90deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
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
                background: 'linear-gradient(90deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
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
                questionId={currentQuestion?.id}
                subtopicId={config.subtopicId}
                questionText={currentQuestion?.question_text}
                studentAnswer={buildAnswerForMarking(currentQuestion)}
                diagramComponent={currentQuestion?.diagram_component}
                diagramParams={currentQuestion?.diagram_params}
              />
            ) : phase === 'marking' && isMarking ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div
                  className="w-6 h-6 rounded-full animate-spin"
                  style={{
                    background: 'conic-gradient(from 0deg, #E23D28, #F5A623, #E23D28)',
                    maskImage: 'radial-gradient(farthest-side, transparent 60%, black 61%)',
                    WebkitMaskImage: 'radial-gradient(farthest-side, transparent 60%, black 61%)',
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Marking question {currentIndex + 1}...
                </p>
              </div>
            ) : currentQuestion && isStepped(currentQuestion) ? (
              feedbacks[currentQuestion.id] ? (
                <FeedbackCard
                  feedback={feedbacks[currentQuestion.id]}
                  questionNumber={currentIndex + 1}
                  questionId={currentQuestion.id}
                  subtopicId={config.subtopicId}
                  questionText={currentQuestion.question_text}
                />
              ) : (
                <SteppedPlayer
                  questionText={currentQuestion.question_text}
                  marks={currentQuestion.marks}
                  data={currentQuestion.steps as SteppedQuestion}
                  tier={config.tier}
                  diagramComponent={currentQuestion.diagram_component}
                  diagramParams={currentQuestion.diagram_params}
                  onComplete={(m, reveal) =>
                    completeStepped(currentQuestion, m, reveal)
                  }
                  onJamHelp={(args) =>
                    handleSteppedJamHelp(currentQuestion, args)
                  }
                />
              )
            ) : currentQuestion && hasSteppedParts(currentQuestion) ? (
              feedbacks[currentQuestion.id] ? (
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
                  questionId={currentQuestion.id}
                  subtopicId={config.subtopicId}
                  questionText={currentQuestion.question_text}
                  studentAnswer={buildAnswerForMarking(currentQuestion)}
                  diagramComponent={currentQuestion.diagram_component}
                  diagramParams={currentQuestion.diagram_params}
                />
              ) : (
                <MultiPartSteppedView
                  key={currentQuestion.id}
                  question={currentQuestion}
                  questionNumber={currentIndex + 1}
                  totalQuestions={questions.length}
                  tier={config.tier}
                  phase={phase}
                  partResults={steppedPartResults[currentQuestion.id] || {}}
                  partAnswers={partAnswers[currentQuestion.id] || {}}
                  markingId={markingId}
                  onPartAnswerChange={(label, val) =>
                    handlePartAnswerChange(label, val)
                  }
                  onSteppedPartComplete={(partLabel, part, marks) =>
                    completeSteppedPart(currentQuestion, partLabel, part, marks)
                  }
                  onJamHelp={(answer, feedback) =>
                    handleJamHelp(currentQuestion, answer, feedback)
                  }
                  onSteppedJamHelp={(args) =>
                    handleSteppedJamHelp(currentQuestion, args)
                  }
                  onMark={() => markAnswer(currentQuestion.id)}
                  hasAnswer={hasAnswer(currentQuestion)}
                />
              )
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
                            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
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
                        questionId={currentQuestion.id}
                        subtopicId={config.subtopicId}
                        questionText={currentQuestion.question_text}
                        studentAnswer={buildAnswerForMarking(currentQuestion)}
                        diagramComponent={currentQuestion.diagram_component}
                        diagramParams={currentQuestion.diagram_params}
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

      {jamHelpQuestion && (
        <JamHelpPanel
          isOpen={jamHelpOpen}
          onClose={() => setJamHelpOpen(false)}
          questionId={jamHelpQuestion.id}
          questionText={jamHelpQuestion.question_text}
          studentAnswer={jamHelpAnswer}
          feedback={jamHelpFeedback}
          subject={config.subject}
          tier={config.tier}
          examBoard={config.examBoard}
          maxTurns={isSubscribed ? SUBSCRIBER_JAM_HELP_TURNS : FREE_JAM_HELP_TURNS}
        />
      )}
    </>
  );
}