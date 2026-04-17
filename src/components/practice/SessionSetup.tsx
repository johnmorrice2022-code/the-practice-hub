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
  examBoard: string;
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

const SUBJECT_ICONS_LARGE: Record<string, React.ReactNode> = {
  Maths: <MathsIcon size={28} />,
  Physics: <PhysicsIcon size={28} />,
};

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
  Maths: 'Algebra, geometry, statistics and more',
  Physics: 'Forces, energy, waves and beyond',
};

/* ------------------------------------------------------------------ */
/*  Card shadow constants                                              */
/* ------------------------------------------------------------------ */
const CARD_SHADOW = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)';
const CARD_SHADOW_HOVER =
  '0 4px 12px rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.11)';

export function SessionSetup({ onStart }: SessionSetupProps) {
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>('subject');
  const [selectedSubject, setSelectedSubject] = useState<
    'Maths' | 'Physics' | ''
  >('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

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
        examBoard: subtopic.exam_board,
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
            background:
              'linear-gradient(140deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
          }}
        >
          {/* Decorative orbs */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: -30,
              right: -20,
              width: 130,
              height: 130,
              background: 'rgba(255,255,255,0.07)',
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              bottom: -40,
              left: 60,
              width: 85,
              height: 85,
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: 12,
              right: 110,
              width: 42,
              height: 42,
              background: 'rgba(255,255,255,0.05)',
            }}
          />

          <div className="max-w-[720px] mx-auto relative z-10">
            <div className="flex items-start justify-between">
              <div>
                {firstName && (
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{
                      color: 'rgba(255,255,255,0.72)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Welcome back, {firstName}
                  </p>
                )}
                <h1
                  className="text-2xl font-bold mb-1 tracking-tight"
                  style={{ color: '#fff', letterSpacing: '-0.02em' }}
                >
                  Start a Jam Session
                </h1>
                <p
                  className="text-sm"
                  style={{ color: 'rgba(255,255,255,0.78)' }}
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
        <div className="max-w-[720px] mx-auto mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={13} />
            Back
          </button>

          {/* Eyebrow label */}
          {step === 'topic' && (
            <p
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(226,61,40,0.6)' }}
            >
              {(() => {
                const { examBoard, tier } = prefsForSubject(selectedSubject);
                return examBoard && tier
                  ? `${examBoard} · ${tier}`
                  : selectedSubject;
              })()}
            </p>
          )}
          {step === 'subtopic' && (
            <p
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(226,61,40,0.6)' }}
            >
              {selectedSubject} · {selectedTopic}
            </p>
          )}

          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ letterSpacing: '-0.02em' }}
          >
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
            const isHovered = hoveredCard === subject;
            return (
              <button
                key={subject}
                onClick={() =>
                  handleSubjectSelect(subject as 'Maths' | 'Physics')
                }
                onMouseEnter={() => setHoveredCard(subject)}
                onMouseLeave={() => setHoveredCard(null)}
                className="bg-card rounded-xl text-left transition-all duration-200 border border-border/40 group relative overflow-hidden"
                style={{
                  boxShadow: isHovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  borderColor: isHovered ? 'rgba(226,61,40,0.25)' : undefined,
                  padding: '16px 18px',
                }}
              >
                {/* Gradient top accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{
                    background:
                      'linear-gradient(90deg, #E23D28 0%, #F5A623 100%)',
                  }}
                />

                {/* Horizontal layout: icon + text + chevron */}
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{
                      width: 46,
                      height: 46,
                      background:
                        'linear-gradient(135deg, rgba(226,61,40,0.09) 0%, rgba(245,166,35,0.11) 100%)',
                      boxShadow: '0 1px 4px rgba(226,61,40,0.10)',
                    }}
                  >
                    {SUBJECT_ICONS_LARGE[subject] ?? (
                      <span className="text-xl">📚</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2
                      className="text-[15px] font-bold text-foreground tracking-tight"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {subject}
                    </h2>
                    <p
                      className="text-[11px] font-semibold mt-0.5"
                      style={{ letterSpacing: '0.04em', color: '#E23D28' }}
                    >
                      {tier && examBoard
                        ? `${examBoard} · ${tier}`
                        : (SUBJECT_DESCRIPTIONS[subject] ?? '')}
                    </p>
                  </div>
                  <ChevronRight
                    size={15}
                    style={{
                      color: isHovered ? '#E23D28' : 'rgba(0,0,0,0.2)',
                      flexShrink: 0,
                      transition: 'color 0.15s',
                    }}
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
            const isHovered = hoveredCard === topic;
            return (
              <button
                key={topic}
                onClick={() => handleTopicSelect(topic)}
                onMouseEnter={() => setHoveredCard(topic)}
                onMouseLeave={() => setHoveredCard(null)}
                className="bg-card rounded-xl text-left transition-all duration-200 border border-border/40 group overflow-hidden"
                style={{
                  boxShadow: isHovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  borderColor: isHovered ? 'rgba(226,61,40,0.2)' : undefined,
                }}
              >
                <div className="flex items-stretch">
                  {/* Left gradient bar */}
                  <div
                    className="w-[3px] flex-shrink-0 rounded-l-xl"
                    style={{
                      background:
                        'linear-gradient(180deg, #E23D28 0%, #F5A623 100%)',
                    }}
                  />
                  <div className="flex items-center justify-between flex-1 px-4 py-4">
                    <div>
                      <h3
                        className="font-bold text-foreground text-[14px] tracking-tight"
                        style={{ letterSpacing: '-0.01em' }}
                      >
                        {topic}
                      </h3>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-widest mt-0.5"
                        style={{ color: '#A8A29E', letterSpacing: '0.09em' }}
                      >
                        {count} subtopic{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight
                      size={15}
                      style={{
                        color: isHovered
                          ? 'rgba(226,61,40,0.6)'
                          : 'rgba(0,0,0,0.18)',
                        flexShrink: 0,
                        transition: 'color 0.15s',
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Subtopic cards ───────────────────────────────────────────── */}
      {step === 'subtopic' && (
        <div className="max-w-[720px] mx-auto grid grid-cols-1 gap-3">
          {availableSubtopics.map((subtopic) => {
            const isHovered = hoveredCard === subtopic.id;
            return (
              <button
                key={subtopic.id}
                onClick={() => handleSubtopicSelect(subtopic)}
                onMouseEnter={() => setHoveredCard(subtopic.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="bg-card rounded-xl text-left transition-all duration-200 border border-border/40 group overflow-hidden"
                style={{
                  boxShadow: isHovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  borderColor: isHovered ? 'rgba(226,61,40,0.2)' : undefined,
                }}
              >
                <div className="flex items-stretch">
                  {/* Left gradient bar */}
                  <div
                    className="w-[3px] flex-shrink-0 rounded-l-xl"
                    style={{
                      background:
                        'linear-gradient(180deg, #E23D28 0%, #F5A623 100%)',
                    }}
                  />
                  <div className="flex items-center justify-between flex-1 px-4 py-4">
                    <div className="space-y-1.5">
                      <h3
                        className="font-bold text-[14px] tracking-tight"
                        style={{
                          background:
                            'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {subtopic.subtopic_name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: '#A8A29E', letterSpacing: '0.09em' }}
                        >
                          {subtopic.tier} · Grade {subtopic.grade_band}
                        </span>
                        <div className="flex items-center gap-2">
                          {subtopic.h5p_url && (
                            <span
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                color: '#E23D28',
                                background: 'rgba(226,61,40,0.08)',
                              }}
                            >
                              <BookOpen size={9} /> Learn
                            </span>
                          )}
                          <span
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
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
                      size={15}
                      style={{
                        color: isHovered
                          ? 'rgba(226,61,40,0.6)'
                          : 'rgba(0,0,0,0.18)',
                        flexShrink: 0,
                        transition: 'color 0.15s',
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
