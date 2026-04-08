import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft } from 'lucide-react';

export interface SubjectPreferences {
  examBoard: string;
  tier: string;
}

interface SubjectSetupProps {
  subject: 'Maths' | 'Physics';
  userId: string;
  onComplete: (prefs: SubjectPreferences) => void;
}

// Default exam board pre-selected per subject
const SUBJECT_DEFAULTS: Record<string, string> = {
  Maths: 'Edexcel',
  Physics: 'AQA',
};

const EXAM_BOARDS = ['Edexcel', 'AQA', 'OCR', 'WJEC'];

const EXAM_BOARD_DESCRIPTIONS: Record<string, string> = {
  Edexcel: 'Pearson Edexcel — most common for Maths',
  AQA: 'AQA — most common for Physics',
  OCR: 'OCR — Gateway or Twenty First Century',
  WJEC: 'WJEC — primarily Wales',
};

const TIER_INFO = {
  Higher: {
    label: 'Higher',
    description:
      'Grades 4–9. Includes more demanding topics and harder problem types.',
  },
  Foundation: {
    label: 'Foundation',
    description:
      'Grades 1–5. Builds core skills with accessible question styles.',
  },
};

type SetupStep = 'exam-board' | 'tier';

export function SubjectSetup({
  subject,
  userId,
  onComplete,
}: SubjectSetupProps) {
  const [setupStep, setSetupStep] = useState<SetupStep>('exam-board');
  const [selectedBoard, setSelectedBoard] = useState<string>(
    SUBJECT_DEFAULTS[subject]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBoardConfirm = () => {
    setSetupStep('tier');
  };

  const handleTierSelect = async (tier: 'Higher' | 'Foundation') => {
    setSaving(true);
    setError('');

    const boardColumn =
      subject === 'Maths' ? 'maths_exam_board' : 'physics_exam_board';
    const tierColumn = subject === 'Maths' ? 'maths_tier' : 'physics_tier';

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, [boardColumn]: selectedBoard, [tierColumn]: tier },
        { onConflict: 'id' }
      );

    if (upsertError) {
      setError(
        'Something went wrong saving your preferences. Please try again.'
      );
      setSaving(false);
      return;
    }

    onComplete({ examBoard: selectedBoard, tier });
  };

  return (
    <div className="max-w-[720px] mx-auto space-y-8">
      {/* Exam board step */}
      {setupStep === 'exam-board' && (
        <>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">
              {subject} —{' '}
              <span className="text-accent-amber">Which exam board?</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              We've selected the most common board for {subject}. Change it if
              needed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EXAM_BOARDS.map((board) => (
              <button
                key={board}
                onClick={() => setSelectedBoard(board)}
                className={`bg-card rounded-xl p-6 text-left transition-all duration-200 border group ${
                  selectedBoard === board
                    ? 'border-primary shadow-md'
                    : 'border-border/40 hover:border-primary/40 hover:shadow-md'
                }`}
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">
                      {board}
                    </h2>
                    {selectedBoard === board && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {EXAM_BOARD_DESCRIPTIONS[board]}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleBoardConfirm}
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-150"
            style={{ background: '#F5A623', color: '#fff' }}
          >
            Continue with {selectedBoard}
          </button>
        </>
      )}

      {/* Tier step */}
      {setupStep === 'tier' && (
        <>
          <div className="space-y-1">
            <button
              onClick={() => setSetupStep('exam-board')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <h1 className="text-2xl font-bold">
              {subject} —{' '}
              <span className="text-accent-amber">
                Which tier are you studying?
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              This helps us show you the right questions. You can change this
              later in settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              Object.entries(TIER_INFO) as [
                keyof typeof TIER_INFO,
                (typeof TIER_INFO)[keyof typeof TIER_INFO],
              ][]
            ).map(([tier, info]) => (
              <button
                key={tier}
                onClick={() => handleTierSelect(tier)}
                disabled={saving}
                className="bg-card rounded-xl p-8 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/40 group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {info.label}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {info.description}
                    </p>
                  </div>
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-1" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
