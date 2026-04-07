import { useState } from "react";
import { CheckCircle2, XCircle, ChevronRight, X } from "lucide-react";

interface CheckQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  question_order: number;
}

interface CheckQuestionsProps {
  subtopicName: string;
  questions: CheckQuestion[];
  onComplete: () => void;
  onExit: () => void;
}

export function CheckQuestions({ subtopicName, questions, onComplete, onExit }: CheckQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean[]>(new Array(questions.length).fill(false));
  const [scores, setScores] = useState<boolean[]>(new Array(questions.length).fill(false));

  const current = questions[currentIndex];
  const isAnswered = answered[currentIndex];
  const isCorrect = scores[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const totalCorrect = scores.filter(Boolean).length;

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelected(index);
    const correct = index === current.correct_index;
    const newAnswered = [...answered];
    const newScores = [...scores];
    newAnswered[currentIndex] = true;
    newScores[currentIndex] = correct;
    setAnswered(newAnswered);
    setScores(newScores);
  };

  const handleNext = () => {
    setSelected(null);
    setCurrentIndex(i => i + 1);
  };

  const getButtonStyle = (index: number) => {
    if (!isAnswered) {
      return selected === index
        ? "border-primary bg-primary/5 text-foreground"
        : "border-border/40 bg-card text-foreground hover:border-primary/40 hover:bg-primary/5";
    }
    if (index === current.correct_index) {
      return "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10 text-foreground";
    }
    if (index === selected && index !== current.correct_index) {
      return "border-destructive bg-destructive/10 text-foreground";
    }
    return "border-border/40 bg-card text-muted-foreground opacity-50";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border/60">
        <div className="max-w-[720px] mx-auto px-6 h-11 flex items-center justify-between">
          <span className="text-xs text-muted-foreground tracking-wide">
            {subtopicName}
            <span className="mx-2 text-border">·</span>
            Check
            <span className="mx-2 text-border">·</span>
            {currentIndex + 1} / {questions.length}
          </span>
          <button onClick={onExit} className="text-muted-foreground/60 hover:text-foreground transition-colors p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="bg-card rounded-xl p-8 sm:p-10 space-y-6" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>

          {/* Question */}
          <p className="text-[15px] leading-[1.8] text-foreground font-medium">{current.question_text}</p>

          {/* Options */}
          <div className="space-y-3">
            {current.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isAnswered}
                className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-150 text-sm leading-relaxed ${getButtonStyle(i)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs font-semibold mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option}</span>
                  {isAnswered && i === current.correct_index && (
                    <CheckCircle2 size={16} className="text-[hsl(var(--success))] shrink-0 ml-auto mt-0.5" />
                  )}
                  {isAnswered && i === selected && i !== current.correct_index && (
                    <XCircle size={16} className="text-destructive shrink-0 ml-auto mt-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Explanation */}
          {isAnswered && (
            <div className={`rounded-lg px-4 py-3.5 border text-sm leading-relaxed ${
              isCorrect
                ? "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30 text-foreground"
                : "bg-primary/10 border-primary/30 text-foreground"
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                {isCorrect
                  ? <CheckCircle2 size={14} className="text-[hsl(var(--success))] shrink-0" />
                  : <XCircle size={14} className="text-primary shrink-0" />
                }
                <span className="font-semibold text-xs tracking-wide uppercase">
                  {isCorrect ? "Correct" : "Not quite"}
                </span>
              </div>
              <p>{current.explanation}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        {isAnswered && (
          <div className="flex justify-end">
            {isLast ? (
              <button
                onClick={onComplete}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {totalCorrect === questions.length ? "Perfect score! " : ""}
                Start Practising
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Next question <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
