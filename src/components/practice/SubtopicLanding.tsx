import { BookOpen, Zap, Calculator, ArrowLeft } from 'lucide-react';

interface SubtopicLandingProps {
  subtopicName: string;
  topic: string;
  subject: string;
  tier: string;
  gradeBand: string;
  tagline?: string | null;
  h5pUrl?: string | null;
  hasLearningContent?: boolean;
  onLearn?: () => void;
  onPractise: (calculatorAllowed: boolean) => void;
  onBack: () => void;
}

export function SubtopicLanding({
  subtopicName,
  topic,
  subject,
  tier,
  gradeBand,
  tagline,
  h5pUrl,
  hasLearningContent,
  onLearn,
  onPractise,
  onBack,
}: SubtopicLandingProps) {
  const showLearn = hasLearningContent || h5pUrl;
  const isFoundationMaths =
    subject?.toLowerCase().includes('maths') &&
    tier?.toLowerCase() === 'foundation';

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={13} />
        Back to topics
      </button>

      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground tracking-wide uppercase">
          {subject} · {topic} · {tier} · Grade {gradeBand}
        </p>
        <h1
          className="text-2xl font-semibold"
          style={{
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {subtopicName}
        </h1>
        {tagline && (
          <p className="text-[15px] text-muted-foreground leading-relaxed italic">
            {tagline}
          </p>
        )}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Learn card */}
        {showLearn ? (
          hasLearningContent && onLearn ? (
            <button
              onClick={onLearn}
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group relative overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                  }}
                >
                  <BookOpen size={18} className="text-[#E23D28]" />
                </div>
                <span className="font-medium text-foreground">Learn</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Work through the teaching resource before you practise.
              </p>
            </button>
          ) : h5pUrl ? (
            
              href={h5pUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group block relative overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                  }}
                >
                  <BookOpen size={18} className="text-[#E23D28]" />
                </div>
                <span className="font-medium text-foreground">Learn</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Work through the teaching resource before you practise.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Opens in a new tab - come back here to practise
              </p>
            </a>
          ) : null
        ) : (
          <div
            className="bg-card rounded-xl p-6 text-left border border-border/40 opacity-40 cursor-not-allowed relative overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-muted" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <BookOpen size={18} className="text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Learn</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Teaching resource coming soon.
            </p>
          </div>
        )}

        {/* Practise card(s) */}
        {isFoundationMaths ? (
          <>
            {/* Non-calculator practise */}
            <button
              onClick={() => onPractise(false)}
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group relative overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                  }}
                >
                  <Zap size={18} className="text-[#E23D28]" />
                </div>
                <span className="font-medium text-foreground">
                  Practise — No Calculator
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paper 1 style. Exam questions without a calculator.
              </p>
            </button>

            {/* Calculator practise */}
            <button
              onClick={() => onPractise(true)}
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group relative overflow-hidden"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                  }}
                >
                  <Calculator size={18} className="text-[#E23D28]" />
                </div>
                <span className="font-medium text-foreground">
                  Practise — Calculator
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Papers 2 & 3 style. Exam questions with a calculator.
              </p>
            </button>
          </>
        ) : (
          /* Standard single practise card for Higher and Physics */
          <button
            onClick={() => onPractise(false)}
            className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group relative overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background:
                  'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              }}
            />
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                }}
              >
                <Zap size={18} className="text-[#E23D28]" />
              </div>
              <span className="font-medium text-foreground">Practise</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Exam-style questions with instant AI marking.
            </p>
          </button>
        )}
      </div>
    </div>
  );
}