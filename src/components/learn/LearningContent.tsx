import { useState } from 'react';
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
            /* Standard paragraphs */
            currentSection.paragraphs?.map((para, i) => (
              <div key={i} className="space-y-4">
                {para.is_non_example && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                    <AlertTriangle
                      size={14}
                      className="text-destructive shrink-0"
                    />
                    <span className="text-xs font-semibold text-destructive tracking-wide uppercase">
                      Watch out - Non-Example
                    </span>
                  </div>
                )}

                {para.diagram_url && (
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
                )}

                <p className="text-[15px] leading-[1.9] text-foreground">
                  {para.text}
                </p>
              </div>
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
