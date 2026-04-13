import { useEffect, useRef } from 'react';
import katex from 'katex';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  BookOpen,
  Lightbulb,
} from 'lucide-react';

interface StepBreakdown {
  mark_type?: string;
  criterion: string;
  status: 'awarded' | 'partial' | 'not_awarded';
  comment: string;
}

export interface MarkingFeedback {
  marks_awarded: number;
  marks_available: number;
  step_breakdown: StepBreakdown[];
  error_type: string;
  feedback_summary: string;
  worked_solution: string;
  revision_focus: string;
}

interface FeedbackCardProps {
  feedback: MarkingFeedback;
  questionNumber: number;
}

function renderMath(text: string): string {
  if (!text) return '';

  const placeholders: string[] = [];

  let html = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      const idx = placeholders.length;
      placeholders.push(rendered);
      return `%%DISPLAY_MATH_${idx}%%`;
    } catch {
      return `$$${math}$$`;
    }
  });

  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `$${math}$`;
    }
  });

  placeholders.forEach((rendered, idx) => {
    html = html.replace(`%%DISPLAY_MATH_${idx}%%`, rendered);
  });

  return html;
}

const statusIcon = (status: string) => {
  if (status === 'awarded')
    return (
      <CheckCircle2 size={14} className="text-[#2D9A5F] shrink-0 mt-0.5" />
    );
  if (status === 'partial')
    return <AlertCircle size={14} className="text-[#F5A623] shrink-0 mt-0.5" />;
  return (
    <Circle size={14} className="text-muted-foreground/40 shrink-0 mt-0.5" />
  );
};

const markTypeBadge = (markType?: string) => {
  if (!markType) return null;
  const colours: Record<string, string> = {
    M: 'bg-blue-50 text-blue-600',
    A: 'bg-green-50 text-green-600',
    B: 'bg-purple-50 text-purple-600',
    ECF: 'bg-amber-50 text-amber-600',
  };
  const colour = colours[markType] || 'bg-muted text-muted-foreground';
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colour} shrink-0`}
    >
      {markType}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Colour tier helpers                                                */
/* ------------------------------------------------------------------ */

function getScoreTier(awarded: number, available: number) {
  const pct = available > 0 ? awarded / available : 0;
  if (pct >= 0.7) {
    return {
      accentColor: '#2D9A5F',
      bgStyle:
        'linear-gradient(135deg, rgba(45,154,95,0.06) 0%, rgba(45,154,95,0.02) 100%)',
      barColor: '#2D9A5F',
      headlineColor: '#2D9A5F',
      headline: awarded === available ? 'Full marks' : 'Strong answer',
    };
  }
  if (pct >= 0.3) {
    return {
      accentColor: '#F5A623',
      bgStyle:
        'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.02) 100%)',
      barColor: '#F5A623',
      headlineColor: '#C78B1A',
      headline: 'Partial marks - keep going',
    };
  }
  return {
    accentColor: '#E23D28',
    bgStyle:
      'linear-gradient(135deg, rgba(226,61,40,0.06) 0%, rgba(226,61,40,0.02) 100%)',
    barColor: '#E23D28',
    headlineColor: '#E23D28',
    headline: awarded === 0 ? 'Revisit this topic' : 'Needs more work',
  };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function FeedbackCard({ feedback, questionNumber }: FeedbackCardProps) {
  const percentage = Math.round(
    (feedback.marks_awarded / feedback.marks_available) * 100
  );
  const tier = getScoreTier(feedback.marks_awarded, feedback.marks_available);

  return (
    <div className="space-y-8">
      {/* Colour-coded score header */}
      <div
        className="rounded-xl px-6 py-5"
        style={{
          background: tier.bgStyle,
          borderLeft: `3px solid ${tier.accentColor}`,
        }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <span
            className="text-sm font-semibold"
            style={{ color: tier.headlineColor }}
          >
            {tier.headline}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-semibold"
              style={{ color: tier.accentColor }}
            >
              {feedback.marks_awarded}
            </span>
            <span className="text-sm text-muted-foreground">
              / {feedback.marks_available} marks
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${percentage}%`,
              background: tier.barColor,
            }}
          />
        </div>

        {/* Question label */}
        <p className="text-xs text-muted-foreground mt-3">
          Question {questionNumber}
        </p>
      </div>

      {/* Summary */}
      <div
        className="text-[15px] leading-[1.8] text-foreground question-text"
        dangerouslySetInnerHTML={{
          __html: renderMath(feedback.feedback_summary),
        }}
      />

      <div className="border-t border-border/50" />

      {/* Step breakdown */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground tracking-wide uppercase">
          Mark breakdown
        </span>
        <div className="space-y-3">
          {feedback.step_breakdown.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {statusIcon(step.status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {markTypeBadge(step.mark_type)}
                  <span
                    className="text-sm text-foreground question-text"
                    dangerouslySetInnerHTML={{
                      __html: renderMath(step.criterion),
                    }}
                  />
                </div>
                <div
                  className="text-xs text-muted-foreground mt-0.5 question-text"
                  dangerouslySetInnerHTML={{ __html: renderMath(step.comment) }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border/50" />

      {/* Worked solution */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <BookOpen size={13} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground tracking-wide uppercase">
            Worked solution
          </span>
        </div>
        <div
          className="text-[15px] leading-[1.8] text-foreground question-text"
          dangerouslySetInnerHTML={{
            __html: renderMath(feedback.worked_solution),
          }}
        />
      </div>

      {/* Revision focus */}
      {feedback.revision_focus && (
        <>
          <div className="border-t border-border/50" />
          <div className="flex items-start gap-2.5">
            <Lightbulb size={14} className="text-[#F5A623] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-muted-foreground tracking-wide uppercase">
                Focus for revision
              </span>
              <div
                className="text-sm text-foreground mt-1 question-text"
                dangerouslySetInnerHTML={{
                  __html: renderMath(feedback.revision_focus),
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
