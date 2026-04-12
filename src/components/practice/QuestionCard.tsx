import { useEffect, useRef } from 'react';
import {
  CircleTheoremDiagram,
  TheoremType,
  DiagramParams,
} from '@/components/diagrams';
import katex from 'katex';

export interface QuestionPart {
  part_label: string;
  part_text: string;
  marks: number;
}

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  marks: number;
  parts?: QuestionPart[];
  answer: string;
  onAnswerChange: (value: string) => void;
  diagramType?: string | null;
  diagramParams?: Record<string, unknown> | null;
  diagramUrl?: string | null;
  partAnswers?: Record<string, string>;
  onPartAnswerChange?: (partLabel: string, value: string) => void;
}

function renderMathInText(text: string): string {
  if (!text) return '';
  let html = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
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
  html = html
    .split('\n\n')
    .map((block) => `<p>${block.replace(/\n/g, '<br/>')}</p>`)
    .join('');
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
      el.style.height = 'auto';
      el.style.height = Math.max(120, el.scrollHeight) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="exam-textarea"
      style={{
        borderColor: value.trim() ? 'rgba(245,166,35,0.5)' : undefined,
        boxShadow: value.trim() ? '0 0 0 3px rgba(245,166,35,0.12)' : undefined,
      }}
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
  diagramType,
  diagramParams,
  diagramUrl,
  partAnswers = {},
  onPartAnswerChange,
}: QuestionCardProps) {
  const isMultiPart = parts && parts.length > 0;

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
          {marks} mark{marks !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Question stem */}
      <div
        className="text-foreground leading-[1.85] text-[15px] question-text"
        dangerouslySetInnerHTML={{ __html: renderMathInText(questionText) }}
      />

      {/* Diagram — image from Supabase Storage */}
      {diagramUrl && (
        <div className="flex justify-center py-2">
          <div
            className="bg-[#FAF7F2] border border-border/40 rounded-xl p-5 w-full"
            style={{
              maxWidth: 400,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <img
              src={diagramUrl}
              alt="Diagram for this question"
              className="w-full h-auto"
              style={{ maxHeight: 320, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* Diagram — programmatic SVG */}
      {diagramType && !diagramUrl && (
        <CircleTheoremDiagram
          theoremType={diagramType as TheoremType}
          params={(diagramParams ?? {}) as DiagramParams}
        />
      )}

      {isMultiPart ? (
        <div className="space-y-6">
          {parts.map((part) => (
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
                    color: '#E23D28',
                    background: 'rgba(226,61,40,0.08)',
                  }}
                >
                  {part.marks} mark{part.marks !== 1 ? 's' : ''}
                </span>
              </div>
              <div
                className="text-foreground leading-[1.85] text-[15px] question-text"
                dangerouslySetInnerHTML={{
                  __html: renderMathInText(part.part_text),
                }}
              />
              <AutoTextarea
                value={partAnswers[part.part_label] ?? ''}
                onChange={(v) => onPartAnswerChange?.(part.part_label, v)}
                placeholder={`Working for part (${part.part_label})… Use ^ for powers (e.g. x^2), or just write in words`}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="border-t border-border/50" />
          <AutoTextarea
            value={answer}
            onChange={onAnswerChange}
            placeholder="Show your working here… Use ^ for powers (e.g. x^2), or just write in words"
          />
        </>
      )}
    </div>
  );
}
