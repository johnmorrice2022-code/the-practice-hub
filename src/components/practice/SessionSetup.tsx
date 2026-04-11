import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronRight, BookOpen, Zap, ArrowLeft } from 'lucide-react';
import { SubjectSetup, SubjectPreferences } from './SubjectSetup';
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
  exam_board: string;
  h5p_url?: string | null;
  slug?: string | null;
}

interface Profile {
  id: string;
  full_name?: string | null;
  maths_tier: string | null;
  physics_tier: string | null;
  maths_exam_board: string | null;
  physics_exam_board: string | null;
}

interface SessionSetupProps {
  onStart: (config: SessionConfig, h5pUrl?: string | null) => void;
}

type Step = 'subject' | 'subject-setup' | 'topic' | 'subtopic';

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function MathsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="mathsGrad"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#E23D28" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      <text
        x="28"
        y="27"
        textAnchor="middle"
        fontFamily="Helvetica Neue, sans-serif"
        fontSize="24"
        fontWeight="600"
        fontStyle="italic"
        fill="url(#mathsGrad)"
      >
        a
      </text>
      <text
        x="40"
        y="20"
        textAnchor="middle"
        fontFamily="Helvetica Neue, sans-serif"
        fontSize="13"
        fontWeight="600"
        fill="url(#mathsGrad)"
      >
        2
      </text>
      <line
        x1="12"
        y1="34"
        x2="52"
        y2="34"
        stroke="url(#mathsGrad)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x="32"
        y="54"
        textAnchor="middle"
        fontFamily="Helvetica Neue, sans-serif"
        fontSize="24"
        fontWeight="600"
        fontStyle="italic"
        fill="url(#mathsGrad)"
      >
        b
      </text>
    </svg>
  );
}

function PhysicsIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="physicsGrad"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#E23D28" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="10"
        stroke="url(#physicsGrad)"
        strokeWidth="2.5"
        fill="none"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="10"
        stroke="url(#physicsGrad)"
        strokeWidth="2.5"
        fill="none"
        transform="rotate(60 32 32)"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="10"
        stroke="url(#physicsGrad)"
        strokeWidth="2.5"
        fill="none"
        transform="rotate(120 32 32)"
      />
      <circle cx="32" cy="32" r="4.5" fill="url(#physicsGrad)" />
      <circle cx="58" cy="32" r="3" fill="url(#physicsGrad)" />
      <circle cx="19" cy="54.5" r="3" fill="url(#physicsGrad)" />
      <circle cx="19" cy="9.5" r="3" fill="url(#physicsGrad)" />
    </svg>
  );
}

const SUBJECT_ICONS: Record<string, React.ReactNode> = {
  Maths: <MathsIcon size={24} />,
  Physics: <PhysicsIcon size={24} />,
};

const SUBJECT_ICONS_LARGE: Record<string, React.ReactNode> = {
  Maths: <MathsIcon size={44} />,
  Physics: <PhysicsIcon size={44} />,
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
            'id, subject, topic, subtopic_name, tier, grade_band, exam_board, h5p_url, slug'
          )
          .eq('active', true)
          .order('sort_order'),
        supabase.auth.getUser(),
      ]);

      setSubtopics(subtopicData ?? []);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select(
            'id, full_name, maths_tier, physics_tier, maths_exam_board, physics_exam_board'
          )
          .eq('id', user.id)
          .single();

        setProfile(
          profileData ?? {
            id: user.id,
            full_name: null,
            maths_tier: null,
            physics_tier: null,
            maths_exam_board: null,
            physics_exam_board: null,
          }
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  const prefsForSubject = (subject: string) => {
    if (!profile) return { tier: null, examBoard: null };
    return subject === 'Maths'
      ? { tier: profile.maths_tier, examBoard: profile.maths_exam_board }
      : { tier: profile.physics_tier, examBoard: profile.physics_exam_board };
  };

  const filteredSubtopics = subtopics.filter((s) => {
    if (s.subject !== selectedSubject) return false;
    const { tier, examBoard } = prefsForSubject(selectedSubject);
    if (!tier || !examBoard) return true;
    return s.exam_board === examBoard && (s.tier === tier || s.tier === 'Both');
  });

  const subjects = [...new Set(subtopics.map((s) => s.subject))];
  const topics = [...new Set(filteredSubtopics.map((s) => s.topic))];
  const availableSubtopics = filteredSubtopics.filter(
    (s) => s.topic === selectedTopic
  );

  const handleSubjectSelect = (subject: 'Maths' | 'Physics') => {
    setSelectedSubject(subject);
    const { tier, examBoard } = prefsForSubject(subject);
    if (!tier || !examBoard) {
      setStep('subject-setup');
    } else {
      setStep('topic');
    }
  };

  const handleSubjectSetupComplete = (prefs: SubjectPreferences) => {
    if (!profile) return;
    const updated: Profile = {
      ...profile,
      maths_tier: selectedSubject === 'Maths' ? prefs.tier : profile.maths_tier,
      physics_tier:
        selectedSubject === 'Physics' ? prefs.tier : profile.physics_tier,
      maths_exam_board:
        selectedSubject === 'Maths'
          ? prefs.examBoard
          : profile.maths_exam_board,
      physics_exam_board:
        selectedSubject === 'Physics'
          ? prefs.examBoard
          : profile.physics_exam_board,
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
    } else if (step === 'subject-setup') {
      setStep('subject');
      setSelectedSubject('');
    }
  };

  const handleSettingsUpdate = (
    mathsTier: string | null,
    physicsTier: string | null,
    mathsExamBoard: string | null,
    physicsExamBoard: string | null
  ) => {
    if (!profile) return;
    setProfile({
      ...profile,
      maths_tier: mathsTier,
      physics_tier: physicsTier,
      maths_exam_board: mathsExamBoard,
      physics_exam_board: physicsExamBoard,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === 'subject-setup' && selectedSubject && profile) {
    return (
      <div className="max-w-[720px] mx-auto space-y-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <SubjectSetup
          subject={selectedSubject as 'Maths' | 'Physics'}
          userId={profile.id}
          onComplete={handleSubjectSetupComplete}
        />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || null;

  return (
    <div className="space-y-0">
      {/* ── Hero gradient banner (subject step only) ─────────────────── */}
      {step === 'subject' && (
        <div
          className="relative -mx-6 -mt-12 mb-8 px-8 pt-10 pb-8"
          style={{
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute rounded-full"
            style={{
              top: -30,
              right: -20,
              width: 120,
              height: 120,
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              bottom: -40,
              left: 60,
              width: 80,
              height: 80,
              background: 'rgba(255,255,255,0.06)',
            }}
          />

          <div className="max-w-[720px] mx-auto relative z-10">
            <div className="flex items-start justify-between">
              <div>
                {firstName && (
                  <p
                    className="text-xs font-medium mb-2"
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Welcome back, {firstName}
                  </p>
                )}
                <h1
                  className="text-2xl font-bold mb-1"
                  style={{ color: '#fff' }}
                >
                  Start a Jam Session
                </h1>
                <p
                  className="text-sm"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  Choose a subject to get started.
                </p>
              </div>

              {profile && (
                <div className="mt-1">
                  <ProfileSettings
                    userId={profile.id}
                    mathsTier={profile.maths_tier}
                    physicsTier={profile.physics_tier}
                    mathsExamBoard={profile.maths_exam_board}
                    physicsExamBoard={profile.physics_exam_board}
                    onUpdate={handleSettingsUpdate}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Topic / Subtopic header (non-subject steps) ──────────────── */}
      {step !== 'subject' && (
        <div className="max-w-[720px] mx-auto space-y-1 mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <h1 className="text-2xl font-bold">
            {step === 'topic' && (
              <>
                <span
                  style={{
                    background:
                      'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {selectedSubject}
                </span>
                <span className="text-foreground"> — Choose a Topic</span>
              </>
            )}
            {step === 'subtopic' && (
              <>
                <span
                  style={{
                    background:
                      'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {selectedTopic}
                </span>
                <span className="text-foreground"> — Choose a Subtopic</span>
              </>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 'topic' && 'Select a topic to practise.'}
            {step === 'subtopic' && 'Pick a subtopic and start your session.'}
          </p>
        </div>
      )}

      {/* ── Subject cards ────────────────────────────────────────────── */}
      {step === 'subject' && (
        <div className="max-w-[720px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subjects.map((subject) => {
            const { tier, examBoard } = prefsForSubject(subject);
            return (
              <button
                key={subject}
                onClick={() =>
                  handleSubjectSelect(subject as 'Maths' | 'Physics')
                }
                className="bg-card rounded-xl p-8 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-[#E23D28]/30 group relative overflow-hidden"
                style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{
                    background:
                      'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                  }}
                />
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(226,61,40,0.1) 0%, rgba(245,166,35,0.1) 100%)',
                  }}
                >
                  {SUBJECT_ICONS_LARGE[subject] ?? (
                    <span className="text-2xl">📚</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {subject}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tier && examBoard ? (
                        <span
                          className="font-medium"
                          style={{ color: '#E23D28' }}
                        >
                          {examBoard} · {tier}
                        </span>
                      ) : (
                        (SUBJECT_DESCRIPTIONS[subject] ?? '')
                      )}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground/40 group-hover:text-[#E23D28] transition-colors"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Topic cards ──────────────────────────────────────────────── */}
      {step === 'topic' && (
        <div className="max-w-[720px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topics.map((topic) => {
            const count = filteredSubtopics.filter(
              (s) => s.topic === topic
            ).length;
            return (
              <button
                key={topic}
                onClick={() => handleTopicSelect(topic)}
                className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-[#E23D28]/30 group"
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
                    className="text-muted-foreground/40 group-hover:text-[#E23D28] transition-colors"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Subtopic cards ───────────────────────────────────────────── */}
      {step === 'subtopic' && (
        <div className="max-w-[720px] mx-auto grid grid-cols-1 gap-3">
          {availableSubtopics.map((subtopic) => (
            <button
              key={subtopic.id}
              onClick={() => handleSubtopicSelect(subtopic)}
              className="bg-card rounded-xl p-6 text-left hover:shadow-md transition-all duration-200 border border-border/40 hover:border-[#E23D28]/30 group"
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h3
                    className="font-semibold"
                    style={{
                      background:
                        'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {subtopic.subtopic_name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {subtopic.tier} · Grade {subtopic.grade_band}
                    </span>
                    <div className="flex items-center gap-2">
                      {subtopic.h5p_url && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color: '#E23D28',
                            background: 'rgba(226,61,40,0.08)',
                          }}
                        >
                          <BookOpen size={9} /> Learn
                        </span>
                      )}
                      <span
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color: '#E23D28',
                          background: 'rgba(226,61,40,0.08)',
                        }}
                      >
                        <Zap size={9} /> Practise
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-muted-foreground/40 group-hover:text-[#E23D28] transition-colors shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
