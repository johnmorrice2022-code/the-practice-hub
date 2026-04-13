import { useState } from 'react';
import katex from 'katex';
import {
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import InteractiveSection from '@/components/learn/InteractiveSection';

interface Paragraph {
  text: string;
  diagram_url?: string | null;
  is_non_example?: boolean;
  style?: 'key-point' | 'exam-tip' | 'watch-out' | 'subheading';
}

interface IndexItem {
  label: string;
  section_index: number;
}

interface Section {
  heading: string;
  paragraphs: Paragraph[];
  type?: string;
  component?: string;
  items?: IndexItem[];
}

interface LearningContentProps {
  subtopicName: string;
  sections: Section[];
  onComplete: () => void;
  onExit: () => void;
}

/* ------------------------------------------------------------------ */
/*  KaTeX rendering — matches FeedbackCard.tsx                        */
/* ------------------------------------------------------------------ */
function renderMath(text: string): string {
  if (!text) return '';

  const placeholders: string[] = [];

  // Replace $$...$$ with placeholders before inline pass
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

  // Now safe to run inline pass — no $$...$$ left in string
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

  // Restore display math placeholders
  placeholders.forEach((rendered, idx) => {
    html = html.replace(`%%DISPLAY_MATH_${idx}%%`, rendered);
  });

  return html;
}
/* ------------------------------------------------------------------ */
/*  Styled paragraph components                                       */
/* ------------------------------------------------------------------ */

function KeyPoint({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg px-5 py-4"
      style={{
        background: 'linear-gradient(135deg, #FEF9F0 0%, #FDF3E4 100%)',
        borderLeft: '3px solid #F5A623',
      }}
    >
      <div
        className="text-[15px] leading-[1.85] text-foreground font-medium m-0 question-text"
        dangerouslySetInnerHTML={{ __html: renderMath(text) }}
      />
    </div>
  );
}

function ExamTip({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg px-5 py-4"
      style={{
        background: '#F4F8F6',
        border: '1px solid #C8DDD2',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs">✎</span>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: '#4A7C63' }}
        >
          Exam tip
        </span>
      </div>
      <div
        className="text-[14.5px] leading-[1.85] text-foreground m-0 question-text"
        dangerouslySetInnerHTML={{ __html: renderMath(text) }}
      />
    </div>
  );
}

function WatchOut({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg px-5 py-4"
      style={{
        background: '#FDF5F3',
        border: '1px solid #EAC9C1',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={13} style={{ color: '#B5564D' }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: '#B5564D' }}
        >
          Watch out
        </span>
      </div>
      <div
        className="text-[14.5px] leading-[1.85] text-foreground m-0 question-text"
        dangerouslySetInnerHTML={{ __html: renderMath(text) }}
      />
    </div>
  );
}

function Subheading({ text }: { text: string }) {
  return (
    <h3
      className="text-[15px] font-semibold mt-2 mb-0 question-text"
      style={{ color: '#4A4540', letterSpacing: '-0.01em' }}
      dangerouslySetInnerHTML={{ __html: renderMath(text) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Paragraph renderer — routes by style field                        */
/* ------------------------------------------------------------------ */

function StyledParagraph({ para }: { para: Paragraph }) {
  // Diagram (rendered before text, regardless of style)
  const diagram = para.diagram_url ? (
    <div className="flex justify-center py-2">
      <div
        className="bg-[#FAF7F2] border border-border/40 rounded-lg p-4 w-full"
        style={{ maxWidth: 400 }}
      >
        <img
          src={para.diagram_url}
          alt="Diagram"
          className="w-full h-auto"
          style={{ maxHeight: 300, objectFit: 'contain' }}
        />
      </div>
    </div>
  ) : null;

  // Legacy is_non_example support — treat as watch-out
  const effectiveStyle = para.is_non_example ? 'watch-out' : para.style;

  const content = (() => {
    switch (effectiveStyle) {
      case 'key-point':
        return <KeyPoint text={para.text} />;
      case 'exam-tip':
        return <ExamTip text={para.text} />;
      case 'watch-out':
        return <WatchOut text={para.text} />;
      case 'subheading':
        return <Subheading text={para.text} />;
      default:
        return (
          <div
            className="text-[15px] leading-[1.9] text-foreground question-text"
            dangerouslySetInnerHTML={{ __html: renderMath(para.text) }}
          />
        );
    }
  })();

  return (
    <div className="space-y-4">
      {diagram}
      {content}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function LearningContent({
  subtopicName,
  sections,
  onComplete,
  onExit,
}: LearningContentProps) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const currentSection = sections[sectionIndex];
  const isLast = sectionIndex === sections.length - 1;
  const isFirst = sectionIndex === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/60">
        <div className="max-w-[720px] mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-wide">
            {subtopicName}
            <span className="mx-2 text-border">·</span>
            Learn
            <span className="mx-2 text-border">·</span>
            {sectionIndex + 1} / {sections.length}
          </span>
          <button
            onClick={onExit}
            className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((sectionIndex + 1) / sections.length) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div
          className="bg-card rounded-xl p-8 sm:p-10 space-y-8"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Section heading */}
          <h2 className="text-xl font-semibold text-foreground">
            {currentSection.heading}
          </h2>

          {/* Index section */}
          {currentSection.type === 'index' && currentSection.items ? (
            <div className="space-y-2">
              {currentSection.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => setSectionIndex(item.section_index)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border/50 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
                >
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                  />
                </button>
              ))}
            </div>
          ) : currentSection.type === 'interactive' &&
            currentSection.component ? (
            /* Interactive section */
            <InteractiveSection component={currentSection.component} />
          ) : (
            /* Standard paragraphs — now with style routing */
            currentSection.paragraphs?.map((para, i) => (
              <StyledParagraph key={i} para={para} />
            ))
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => setSectionIndex((i) => i - 1)}
            disabled={isFirst}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default transition-colors py-1"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div className="flex items-center gap-1.5">
            {sections.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === sectionIndex
                    ? 'w-2.5 h-2.5 bg-foreground/50'
                    : i < sectionIndex
                      ? 'w-1.5 h-1.5 bg-primary'
                      : 'w-1.5 h-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors py-1"
            >
              <CheckCircle2 size={13} /> Done - ready to practise
            </button>
          ) : (
            <button
              onClick={() => setSectionIndex((i) => i + 1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
