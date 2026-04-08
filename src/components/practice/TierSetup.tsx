import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface TierSetupProps {
  subject: 'Maths' | 'Physics';
  userId: string;
  onComplete: (tier: string) => void;
}

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

export function TierSetup({ subject, userId, onComplete }: TierSetupProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = async (tier: 'Higher' | 'Foundation') => {
    setSaving(true);
    setError('');

    const column = subject === 'Maths' ? 'maths_tier' : 'physics_tier';

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: userId, [column]: tier }, { onConflict: 'id' });

    if (upsertError) {
      setError(
        'Something went wrong saving your preference. Please try again.'
      );
      setSaving(false);
      return;
    }

    onComplete(tier);
  };

  return (
    <div className="max-w-[720px] mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {subject} —{' '}
          <span className="text-accent-amber">
            Which tier are you studying?
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          This helps us show you the right questions. You can change this later
          in settings.
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
            onClick={() => handleSelect(tier)}
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
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0 mt-1" />
              ) : null}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
