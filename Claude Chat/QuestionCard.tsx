import { useEffect, useRef } from "react";
import katex from "katex";

export interface QuestionPart {
  part_label: string; // "a", "b", "c"
  part_text: string;
  marks: number;
}

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  marks: number;
  parts?: QuestionPart[];
  // Single-part answer
  answer: string;
  onAnswerChange: (value: string) => void;
  // Multi-part answers
  partAnswers?: Record<string, string>;
  onPartAnswerChange?: (partLabel: string, value: string) => void;
}

function renderMathInText(text: string): string {
  if (!text) return "";
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
  html = html.split("\n\n").map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`).join("");
  return html;
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(120, el.scrollHeight) + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="exam-textarea"
    />
  );
}

export function QuestionCard({
  questionNumber,
  totalQuestions,
  questionText,
  marks,
  parts,
  answer,
  onAnswerChange,
  partAnswers = {},
  onPartAnswerChange,
}: QuestionCardProps) {
  const isMultiPart = parts && parts.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground tracking-wide">
          Question {questionNumber}
          <span className="text-border mx-1.5">/</span>
          {totalQuestions}
        </span>
        <span className="text-xs text-muted-foreground">
          [{marks} mark{marks !== 1 ? "s" : ""}]
        </span>
      </div>

      {/* Question stem */}
      <div
        className="text-foreground leading-[1.8] text-[15px] question-text"
        dangerouslySetInnerHTML={{ __html: renderMathInText(questionText) }}
      />

      {isMultiPart ? (
        /* Multi-part question */
        <div className="space-y-6">
          {parts.map((part) => (
            <div key={part.part_label} className="space-y-3">
              <div className="border-t border-border/50" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">
                  ({part.part_label})
                </span>
                <span className="text-xs text-muted-foreground">
                  [{part.marks} mark{part.marks !== 1 ? "s" : ""}]
                </span>
              </div>
              <div
                className="text-foreground leading-[1.8] text-[15px] question-text"
                dangerouslySetInnerHTML={{ __html: renderMathInText(part.part_text) }}
              />
              <AutoTextarea
                value={partAnswers[part.part_label] ?? ""}
                onChange={(v) => onPartAnswerChange?.(part.part_label, v)}
                placeholder={`Working for part (${part.part_label})…`}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Single-part question */
        <>
          <div className="border-t border-border/50" />
          <AutoTextarea
            value={answer}
            onChange={onAnswerChange}
            placeholder="Show your working here…"
          />
        </>
      )}
    </div>
  );
}
