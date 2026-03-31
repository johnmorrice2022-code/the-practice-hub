import { BookOpen, Zap, ArrowLeft } from "lucide-react";

interface SubtopicLandingProps {
  subtopicName: string;
  topic: string;
  subject: string;
  tier: string;
  gradeBand: string;
  h5pUrl?: string | null;
  onPractise: () => void;
  onBack: () => void;
}

export function SubtopicLanding({
  subtopicName,
  topic,
  subject,
  tier,
  gradeBand,
  h5pUrl,
  onPractise,
  onBack,
}: SubtopicLandingProps) {
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
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground tracking-wide uppercase">
          {subject} · {topic} · {tier} · Grade {gradeBand}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{subtopicName}</h1>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Learn card */}
        {h5pUrl ? (
          <a
            href={h5pUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group block"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <BookOpen size={18} className="text-primary" />
              </div>
              <span className="font-medium text-foreground">Learn</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Work through the teaching resource before you practise.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">Opens in a new tab — come back here to practise</p>
          </a>
        ) : (
          <div
            className="bg-card rounded-xl p-6 text-left border border-border/40 opacity-50 cursor-not-allowed"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
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

        {/* Practise card */}
        <button
          onClick={onPractise}
          className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/30 group"
          style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Zap size={18} className="text-primary" />
            </div>
            <span className="font-medium text-foreground">Practise</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Test your understanding with AI-generated exam questions and instant marking.
          </p>
        </button>
      </div>
    </div>
  );
}

