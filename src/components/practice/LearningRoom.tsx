import { X, ArrowLeft } from "lucide-react";

interface LearningRoomProps {
  subtopicName: string;
  h5pUrl: string;
  onExit: () => void;
  onPractise: () => void;
}

export function LearningRoom({ subtopicName, h5pUrl, onExit, onPractise }: LearningRoomProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/60">
        <div className="max-w-[900px] mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-wide">
            {subtopicName} · Teaching Resource
          </span>
          <button
            onClick={onExit}
            className="text-muted-foreground/60 hover:text-foreground transition-colors p-1"
            aria-label="Exit"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* H5P iframe */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-card rounded-xl overflow-hidden border border-border/40"
          style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
          <iframe
            src={h5pUrl}
            width="100%"
            height="520"
            frameBorder="0"
            allowFullScreen
            title={subtopicName}
            className="w-full"
          />
        </div>

        {/* Practise button */}
        <div className="flex justify-center">
          <button
            onClick={onPractise}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Ready? Start Practising →
          </button>
        </div>
      </div>
    </div>
  );
}
