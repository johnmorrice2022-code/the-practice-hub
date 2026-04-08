import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings, X, Check, Loader2 } from 'lucide-react';

interface ProfileSettingsProps {
  userId: string;
  mathsTier: string | null;
  physicsTier: string | null;
  onUpdate: (mathsTier: string | null, physicsTier: string | null) => void;
}

type TierValue = 'Higher' | 'Foundation' | null;

const TIERS: ('Higher' | 'Foundation')[] = ['Higher', 'Foundation'];

export function ProfileSettings({
  userId,
  mathsTier,
  physicsTier,
  onUpdate,
}: ProfileSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localMaths, setLocalMaths] = useState<TierValue>(
    mathsTier as TierValue
  );
  const [localPhysics, setLocalPhysics] = useState<TierValue>(
    physicsTier as TierValue
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, maths_tier: localMaths, physics_tier: localPhysics },
        { onConflict: 'id' }
      );

    setSaving(false);

    if (upsertError) {
      setError("Couldn't save changes. Please try again.");
      return;
    }

    onUpdate(localMaths, localPhysics);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 1000);
  };

  const hasChanges = localMaths !== mathsTier || localPhysics !== physicsTier;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open settings"
      >
        <Settings size={13} />
        Settings
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-7 z-50 bg-card border border-border/60 rounded-xl shadow-lg p-5 w-72 space-y-5"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
        >
          {/* Panel header */}
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

          {/* Maths tier */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Maths Tier</p>
            <div className="flex gap-2">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setLocalMaths(tier)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                    localMaths === tier
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {tier}
                </button>
              ))}
              <button
                onClick={() => setLocalMaths(null)}
                className={`px-3 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                  localMaths === null
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
                title="Clear Maths tier"
              >
                —
              </button>
            </div>
          </div>

          {/* Physics tier */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Physics Tier</p>
            <div className="flex gap-2">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setLocalPhysics(tier)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                    localPhysics === tier
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {tier}
                </button>
              ))}
              <button
                onClick={() => setLocalPhysics(null)}
                className={`px-3 rounded-lg py-2 text-xs font-medium border transition-all duration-150 ${
                  localPhysics === null
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
                title="Clear Physics tier"
              >
                —
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Save button */}
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
