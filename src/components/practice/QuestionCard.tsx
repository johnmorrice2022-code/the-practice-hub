import { useEffect, useRef } from "react";
import katex from "katex";

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  marks: number;
  answer: string;
  onAnswerChange: (value: string) => void;
}

function renderMathInText(text: string): string {
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

  html = html
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return html;
}

export function QuestionCard({
  questionNumber,
  totalQuestions,
  questionText,
  marks,
  answer,
  onAnswerChange,
}: QuestionCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(140, el.scrollHeight) + "px";
    }
  }, [answer]);

  const renderedQuestion = renderMathInText(questionText);

  return (
    <div className="space-y-8">
      {/* Question header — like a printed exam page header */}
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

      {/* Question body */}
      <div
        className="text-foreground leading-[1.8] text-[15px] question-text"
        dangerouslySetInnerHTML={{ __html: renderedQuestion }}
      />

      {/* Thin rule — like a section divider on printed paper */}
      <div className="border-t border-border/50" />

      {/* Answer area — feels like lined writing space, not a form */}
      <div>
        <textarea
          ref={textareaRef}
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Show your working here…"
          className="exam-textarea"
        />
      </div>
    </div>
  );
}
