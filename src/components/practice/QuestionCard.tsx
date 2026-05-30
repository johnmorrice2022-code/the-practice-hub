import {
  CircleTheoremDiagram,
  TheoremType,
  DiagramParams,
} from '@/components/diagrams';
import { getQuestionDiagram } from '@/components/diagrams/questionDiagramRegistry';
import {
  InteractiveProbabilityTree,
  TreeAnswers,
} from '@/components/diagrams/InteractiveProbabilityTree';
import { MathLiveInput } from './MathLiveInput';
import { renderMathInText } from '@/lib/renderMathInText';

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
  diagramComponent?: string | null;
  partAnswers?: Record<string, string>;
  onPartAnswerChange?: (partLabel: string, value: string) => void;
  /** Current tree answers for interactive probability trees */
  treeAnswers?: TreeAnswers;
  /** Called when the student fills in a hidden branch */
  onTreeAnswerChange?: (values: TreeAnswers) => void;
  /** When true, interactive tree inputs are disabled (review mode) */
  treeDisabled?: boolean;
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
  return <MathLiveInput value={value} onChange={onChange} placeholder={placeholder} />;
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
  diagramComponent,
  partAnswers = {},
  onPartAnswerChange,
  treeAnswers = {},
  onTreeAnswerChange,
  treeDisabled = false,
}: QuestionCardProps) {
  const isMultiPart = parts && parts.length > 0;

  // Determine whether this is an interactive probability tree question.
  // A question is interactive if it has hidden branches (at least one branch
  // with hidden: true in the diagram_params stages).
  const isProbabilityTree = diagramComponent === 'probability-tree';
  const hasHiddenBranches =
    isProbabilityTree &&
    diagramParams != null &&
    (() => {
      try {
        const cfg = diagramParams as {
          stages?: Array<{ branches?: Array<{ hidden?: boolean }> }>;
        };
        return (
          cfg.stages?.some((s) => s.branches?.some((b) => b.hidden === true)) ??
          false
        );
      } catch {
        return false;
      }
    })();

  // For non-interactive probability trees (no hidden branches), fall through
  // to the registry path as before.
  const RegisteredDiagram =
    isProbabilityTree && !hasHiddenBranches
      ? getQuestionDiagram(diagramComponent)
      : !isProbabilityTree
        ? getQuestionDiagram(diagramComponent)
        : null;

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

      {/* Interactive probability tree (hidden branches) */}
      {hasHiddenBranches && diagramParams && (
        <div className="flex justify-center py-2">
          <div
            className="bg-[#FAF7F2] border border-border/40 rounded-xl p-5 w-full"
            style={{ maxWidth: 680, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            {onTreeAnswerChange ? (
              <InteractiveProbabilityTree
                config={diagramParams as any}
                values={treeAnswers}
                onChange={onTreeAnswerChange}
                disabled={treeDisabled}
              />
            ) : (
              // Fallback: non-interactive render (e.g. in admin preview)
              <InteractiveProbabilityTree
                config={diagramParams as any}
                values={{}}
                onChange={() => {}}
                disabled
              />
            )}
            {!treeDisabled && (
              <p className="text-[11px] text-gray-400 mt-3 text-center">
                Fill in the missing probabilities on the tree.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Non-interactive registered diagram (probability-tree with no hidden branches, or other types) */}
      {RegisteredDiagram && diagramParams && (
        <div className="flex justify-center py-2">
          <div
            className="bg-[#FAF7F2] border border-border/40 rounded-xl p-5 w-full"
            style={{ maxWidth: 680, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <RegisteredDiagram params={diagramParams} />
          </div>
        </div>
      )}

      {/* Diagram — image from Supabase Storage */}
      {!hasHiddenBranches && !RegisteredDiagram && diagramUrl && (
        <div className="flex justify-center py-2">
          <div
            className="bg-[#FAF7F2] border border-border/40 rounded-xl p-5 w-full"
            style={{ maxWidth: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
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

      {/* Legacy CircleTheoremDiagram */}
      {!hasHiddenBranches &&
        !RegisteredDiagram &&
        !diagramUrl &&
        diagramType && (
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
                placeholder={`Working for part (${part.part_label})…`}
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
            placeholder="Show your working here…"
          />
        </>
      )}
    </div>
  );
}
