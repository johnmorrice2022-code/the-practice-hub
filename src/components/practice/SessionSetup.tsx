import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronRight, BookOpen, Zap, ArrowLeft } from 'lucide-react';
import { TierSetup } from './TierSetup';
import { ProfileSettings } from './ProfileSettings';

export interface SessionConfig {
  subject: string;
  topic: string;
  subtopicId: string;
  subtopicName: string;
  tier: string;
  gradeBand: string;
}

interface Subtopic {
  id: string;
  subject: string;
  topic: string;
  subtopic_name: string;
  tier: string;
  grade_band: string;
  h5p_url?: string | null;
  slug?: string | null;
}

interface Profile {
  id: string;
  maths_tier: string | null;
  physics_tier: string | null;
}

interface SessionSetupProps {
  onStart: (config: SessionConfig, h5pUrl?: string | null) => void;
}

type Step = 'subject' | 'tier-setup' | 'topic' | 'subtopic';

const SUBJECT_ICONS: Record<string, string> = {
  Maths: '∑',
  Physics: '⚡',
};

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  Maths: 'Algebra, geometry, statistics and more',
  Physics: 'Forces, energy, waves and beyond',
};

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>('subject');
  const [selectedSubject, setSelectedSubject] = useState<
    'Maths' | 'Physics' | ''
  >('');
  const [selectedTopic, setSelectedTopic] = useState('');

  // ── Load subtopics and profile ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [
        { data: subtopicData },
        {
          data: { user },
        },
      ] = await Promise.all([
        supabase
          .from('subtopics')
          .select(
            'id, subject, topic, subtopic_name, tier, grade_band, h5p_url, slug'
          )
          .eq('active', true)
          .order('sort_order'),
        supabase.auth.getUser(),
      ]);

      setSubtopics(subtopicData ?? []);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, maths_tier, physics_tier')
          .eq('id', user.id)
          .single();

        setProfile(
          profileData ?? { id: user.id, maths_tier: null, physics_tier: null }
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  // ── Derived tier for current subject ───────────────────────────────────────
  const tierForSubject = (subject: string): string | null => {
    if (!profile) return null;
    return subject === 'Maths' ? profile.maths_tier : profile.physics_tier;
  };

  // ── Filtered subtopics: match tier exactly OR tier === "Both" ──────────────
  const filteredSubtopics = subtopics.filter((s) => {
    if (s.subject !== selectedSubject) return false;
    const tier = tierForSubject(selectedSubject);
    if (!tier) return true; // no tier set yet — show all (shouldn't reach here in normal flow)
    return s.tier === tier || s.tier === 'Both';
  });

  const subjects = [...new Set(subtopics.map((s) => s.subject))];
  const topics = [...new Set(filteredSubtopics.map((s) => s.topic))];
  const availableSubtopics = filteredSubtopics.filter(
    (s) => s.topic === selectedTopic
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubjectSelect = (subject: 'Maths' | 'Physics') => {
    setSelectedSubject(subject);
    const tier = tierForSubject(subject);
    if (!tier) {
      // First time for this subject — collect tier before proceeding
      setStep('tier-setup');
    } else {
      setStep('topic');
    }
  };

  const handleTierComplete = (tier: string) => {
    if (!profile) return;
    const updated: Profile = {
      ...profile,
      maths_tier: selectedSubject === 'Maths' ? tier : profile.maths_tier,
      physics_tier: selectedSubject === 'Physics' ? tier : profile.physics_tier,
    };
    setProfile(updated);
    setStep('topic');
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setStep('subtopic');
  };

  const handleSubtopicSelect = (subtopic: Subtopic) => {
    onStart(
      {
        subject: subtopic.subject,
        topic: subtopic.topic,
        subtopicId: subtopic.id,
        subtopicName: subtopic.subtopic_name,
        tier: subtopic.tier,
        gradeBand: subtopic.grade_band,
      },
      subtopic.h5p_url
    );
  };

  const handleBack = () => {
    if (step === 'subtopic') {
      setStep('topic');
      setSelectedTopic('');
    } else if (step === 'topic') {
      setStep('subject');
      setSelectedSubject('');
    } else if (step === 'tier-setup') {
      setStep('subject');
      setSelectedSubject('');
    }
  };

  const handleSettingsUpdate = (
    mathsTier: string | null,
    physicsTier: string | null
  ) => {
    if (!profile) return;
    setProfile({
      ...profile,
      maths_tier: mathsTier,
      physics_tier: physicsTier,
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Tier setup (lazy — shown inline when tier not yet set) ─────────────────
  if (step === 'tier-setup' && selectedSubject && profile) {
    return (
      <div className="max-w-[720px] mx-auto space-y-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <TierSetup
          subject={selectedSubject as 'Maths' | 'Physics'}
          userId={profile.id}
          onComplete={handleTierComplete}
        />
      </div>
    );
  }

  // ── Main flow ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[720px] mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start justify-between">
          <div>
            {step !== 'subject' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft size={13} />
                Back
              </button>
            )}
            <h1 className="text-2xl font-bold">
              {step === 'subject' && (
                <>
                  Start a <span className="text-accent-amber">Jam Session</span>
                </>
              )}
              {step === 'topic' && (
                <>
                  {selectedSubject} —{' '}
                  <span className="text-accent-amber">Choose a Topic</span>
                </>
              )}
              {step === 'subtopic' && (
                <>
                  {selectedTopic} —{' '}
                  <span className="text-accent-amber">Choose a Subtopic</span>
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'subject' && 'Choose a subject to get started.'}
              {step === 'topic' && 'Select a topic to practise.'}
              {step === 'subtopic' && 'Pick a subtopic and start your session.'}
            </p>
          </div>

          {/* Settings — only show when profile is loaded */}
          {profile && step === 'subject' && (
            <div className="mt-1">
              <ProfileSettings
                userId={profile.id}
                mathsTier={profile.maths_tier}
                physicsTier={profile.physics_tier}
                onUpdate={handleSettingsUpdate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Subject step */}
      {step === 'subject' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map((subject) => {
            const tier = tierForSubject(subject);
            return (
              <button
                key={subject}
                onClick={() =>
                  handleSubjectSelect(subject as 'Maths' | 'Physics')
                }
                className="bg-card rounded-xl p-8 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/40 group"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">
                  {SUBJECT_ICONS[subject] ?? '📚'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {subject}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tier ? (
                        <span className="text-primary/70 font-medium">
                          {tier} tier
                        </span>
                      ) : (
                        (SUBJECT_DESCRIPTIONS[subject] ?? '')
                      )}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Topic step */}
      {step === 'topic' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topics.map((topic) => {
            const count = filteredSubtopics.filter(
              (s) => s.topic === topic
            ).length;
            return (
              <button
                key={topic}
                onClick={() => handleTopicSelect(topic)}
                className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/40 group"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{topic}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {count} subtopic{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground/40 group-hover:text-primary transition-colors"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Subtopic step */}
      {step === 'subtopic' && (
        <div className="grid grid-cols-1 gap-3">
          {availableSubtopics.map((subtopic) => (
            <button
              key={subtopic.id}
              onClick={() => handleSubtopicSelect(subtopic)}
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-primary/40 group"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    {subtopic.subtopic_name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {subtopic.tier} · Grade {subtopic.grade_band}
                    </span>
                    <div className="flex items-center gap-2">
                      {subtopic.h5p_url && (
                        <span className="flex items-center gap-1 text-[10px] text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                          <BookOpen size={9} /> Learn
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                        <Zap size={9} /> Practise
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
