import { useEffect, useRef } from "react";
import katex from "katex";
import { CheckCircle2, Circle, AlertCircle, BookOpen, Lightbulb } from "lucide-react";

interface StepBreakdown {
  criterion: string;
  status: "awarded" | "partial" | "not_awarded";
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
  let html = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `$$${math}$$`;
    }
  });
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${math}$`;
    }
  });
  html = html.split("\n\n").map((b) => `<p>${b.replace(/\n/g, "<br/>")}</p>`).join("");
  return html;
}

const statusIcon = (status: string) => {
  if (status === "awarded") return <CheckCircle2 size={14} className="text-[hsl(var(--success))] shrink-0 mt-0.5" />;
  if (status === "partial") return <AlertCircle size={14} className="text-primary shrink-0 mt-0.5" />;
  return <Circle size={14} className="text-muted-foreground/40 shrink-0 mt-0.5" />;
};

export function FeedbackCard({ feedback, questionNumber }: FeedbackCardProps) {
  const solutionRef = useRef<HTMLDivElement>(null);
  const percentage = Math.round((feedback.marks_awarded / feedback.marks_available) * 100);

  return (
    <div className="space-y-8">
      {/* Header with score */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground tracking-wide">
          Question {questionNumber} — Feedback
        </span>
        <span className="text-sm font-medium">
          <span className={percentage >= 70 ? "text-[hsl(var(--success))]" : percentage >= 40 ? "text-primary" : "text-destructive"}>
            {feedback.marks_awarded}
          </span>
          <span className="text-muted-foreground">/{feedback.marks_available}</span>
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            percentage >= 70 ? "bg-[hsl(var(--success))]" : percentage >= 40 ? "bg-primary" : "bg-destructive"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Summary */}
      <p className="text-[15px] leading-[1.8] text-foreground">{feedback.feedback_summary}</p>

      <div className="border-t border-border/50" />

      {/* Step breakdown */}
      <div className="space-y-3">
        <span className="text-xs text-muted-foreground tracking-wide uppercase">Mark breakdown</span>
        <div className="space-y-2.5">
          {feedback.step_breakdown.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {statusIcon(step.status)}
              <div className="min-w-0">
                <span className="text-sm text-foreground">{step.criterion}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{step.comment}</p>
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
          <span className="text-xs text-muted-foreground tracking-wide uppercase">Worked solution</span>
        </div>
        <div
          className="text-[15px] leading-[1.8] text-foreground question-text"
          dangerouslySetInnerHTML={{ __html: renderMath(feedback.worked_solution) }}
        />
      </div>

      {/* Revision focus */}
      {feedback.revision_focus && (
        <>
          <div className="border-t border-border/50" />
          <div className="flex items-start gap-2.5">
            <Lightbulb size={14} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-muted-foreground tracking-wide uppercase">Focus for revision</span>
              <p className="text-sm text-foreground mt-1">{feedback.revision_focus}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
