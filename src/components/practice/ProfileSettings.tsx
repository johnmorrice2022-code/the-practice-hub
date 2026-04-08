import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings, X, Check, Loader2 } from 'lucide-react';

interface ProfileSettingsProps {
  userId: string;
  mathsTier: string | null;
  physicsTier: string | null;
  mathsExamBoard: string | null;
  physicsExamBoard: string | null;
  onUpdate: (
    mathsTier: string | null,
    physicsTier: string | null,
    mathsExamBoard: string | null,
    physicsExamBoard: string | null
  ) => void;
}

type TierValue = 'Higher' | 'Foundation' | null;

const TIERS: ('Higher' | 'Foundation')[] = ['Higher', 'Foundation'];
const EXAM_BOARDS = ['Edexcel', 'AQA', 'OCR', 'WJEC'];

export function ProfileSettings({
  userId,
  mathsTier,
  physicsTier,
  mathsExamBoard,
  physicsExamBoard,
  onUpdate,
}: ProfileSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localMathsTier, setLocalMathsTier] = useState<TierValue>(
    mathsTier as TierValue
  );
  const [localPhysicsTier, setLocalPhysicsTier] = useState<TierValue>(
    physicsTier as TierValue
  );
  const [localMathsBoard, setLocalMathsBoard] = useState<string | null>(
    mathsExamBoard
  );
  const [localPhysicsBoard, setLocalPhysicsBoard] = useState<string | null>(
    physicsExamBoard
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        maths_tier: localMathsTier,
        physics_tier: localPhysicsTier,
        maths_exam_board: localMathsBoard,
        physics_exam_board: localPhysicsBoard,
      },
      { onConflict: 'id' }
    );

    setSaving(false);

    if (upsertError) {
      setError("Couldn't save changes. Please try again.");
      return;
    }

    onUpdate(
      localMathsTier,
      localPhysicsTier,
      localMathsBoard,
      localPhysicsBoard
    );
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1000);
  };

  const hasChanges =
    localMathsTier !== mathsTier ||
    localPhysicsTier !== physicsTier ||
    localMathsBoard !== mathsExamBoard ||
    localPhysicsBoard !== physicsExamBoard;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open settings"
      >
        <Settings size={13} />
        Settings
      </button>

      {open && (
        <div
          className="absolute right-0 top-7 z-50 bg-card border border-border/60 rounded-xl shadow-lg p-5 w-80 space-y-5"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Your Settings
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close settings"
            >
              <X size={14} />
            </button>
          </div>

          {/* Maths */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Maths
            </p>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Exam Board</p>
              <div className="flex flex-wrap gap-2">
                {EXAM_BOARDS.map((board) => (
                  <button
                    key={board}
                    onClick={() => setLocalMathsBoard(board)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-150 ${
                      localMathsBoard === board
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {board}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Tier</p>
              <div className="flex gap-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setLocalMathsTier(tier)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                      localMathsTier === tier
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
                <button
                  onClick={() => setLocalMathsTier(null)}
                  className={`px-3 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                    localMathsTier === null
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                  title="Clear Maths tier"
                >
                  —
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border/40" />

          {/* Physics */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Physics
            </p>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Exam Board</p>
              <div className="flex flex-wrap gap-2">
                {EXAM_BOARDS.map((board) => (
                  <button
                    key={board}
                    onClick={() => setLocalPhysicsBoard(board)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-150 ${
                      localPhysicsBoard === board
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {board}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Tier</p>
              <div className="flex gap-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setLocalPhysicsTier(tier)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                      localPhysicsTier === tier
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
                <button
                  onClick={() => setLocalPhysicsTier(null)}
                  className={`px-3 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                    localPhysicsTier === null
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                  title="Clear Physics tier"
                >
                  —
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full rounded-lg py-2 text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: hasChanges && !saving ? '#F5A623' : undefined,
              color: hasChanges && !saving ? '#fff' : undefined,
            }}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <>
                <Check size={12} /> Saved
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
