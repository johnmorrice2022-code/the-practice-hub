import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Target,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecentSubtopic {
  subtopic_id: string;
  subtopic_name: string;
  slug: string;
  last_score_pct: number;
  last_marks_awarded: number;
  last_marks_available: number;
  completed_at: string;
  trend: 'up' | 'down' | 'flat' | 'new';
}

interface WeakSubtopic {
  subtopic_id: string;
  subtopic_name: string;
  slug: string;
  last_score_pct: number;
  last_marks_awarded: number;
  last_marks_available: number;
}

interface DashboardStats {
  sessionsThisWeek: number;
  weeklyGoal: number;
  totalQuestionsAttempted: number;
  recentSubtopics: RecentSubtopic[];
  weakSubtopics: WeakSubtopic[];
  hasAnySessions: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function scoreColour(pct: number): string {
  if (pct >= 70) return '#2D9A5F';
  if (pct >= 40) return '#F5A623';
  return '#E23D28';
}

function scoreBg(pct: number): string {
  if (pct >= 70) return 'rgba(45,154,95,0.10)';
  if (pct >= 40) return 'rgba(245,166,35,0.10)';
  return 'rgba(226,61,40,0.10)';
}

const CARD_SHADOW = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.08)';
const CARD_SHADOW_HOVER =
  '0 4px 12px rgba(0,0,0,0.08), 0 10px 28px rgba(0,0,0,0.11)';

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function Skeleton({
  w,
  h,
  rounded = 'rounded',
}: {
  w: string;
  h: string;
  rounded?: string;
}) {
  return <div className={`bg-muted animate-pulse ${rounded} ${w} ${h}`} />;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    // Start of current week (Monday)
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const [sessionsWeekRes, profileRes, allSessionsRes] = await Promise.all([
      supabase
        .from('session_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('completed_at', monday.toISOString()),
      supabase
        .from('profiles')
        .select('weekly_goal')
        .eq('id', user.id)
        .single(),
      supabase
        .from('session_results')
        .select(
          `
          id,
          subtopic_id,
          marks_awarded,
          marks_available,
          questions_attempted,
          completed_at,
          subtopics (
            subtopic_name,
            slug
          )
        `
        )
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(50),
    ]);

    const allSessions = allSessionsRes.data ?? [];
    const hasAnySessions = allSessions.length > 0;

    // Total questions attempted (all time)
    const totalQuestionsAttempted = allSessions.reduce(
      (sum, s) => sum + (s.questions_attempted ?? 0),
      0
    );

    // Recently studied: latest session per subtopic (up to 4)
    const seenSubtopics = new Set<string>();
    const latestPerSubtopic: typeof allSessions = [];
    for (const s of allSessions) {
      if (!seenSubtopics.has(s.subtopic_id)) {
        seenSubtopics.add(s.subtopic_id);
        latestPerSubtopic.push(s);
      }
      if (latestPerSubtopic.length >= 4) break;
    }

    // Build trend: compare last session vs previous session per subtopic
    const recentSubtopics: RecentSubtopic[] = latestPerSubtopic.map(
      (latest) => {
        const subtopicSessions = allSessions
          .filter((s) => s.subtopic_id === latest.subtopic_id)
          .sort(
            (a, b) =>
              new Date(b.completed_at).getTime() -
              new Date(a.completed_at).getTime()
          );

        const lastPct = Math.round(
          (latest.marks_awarded / latest.marks_available) * 100
        );
        let trend: RecentSubtopic['trend'] = 'new';

        if (subtopicSessions.length >= 2) {
          const prev = subtopicSessions[1];
          const prevPct = Math.round(
            (prev.marks_awarded / prev.marks_available) * 100
          );
          if (lastPct > prevPct + 5) trend = 'up';
          else if (lastPct < prevPct - 5) trend = 'down';
          else trend = 'flat';
        }

        return {
          subtopic_id: latest.subtopic_id,
          subtopic_name: (latest.subtopics as any)?.subtopic_name ?? 'Unknown',
          slug: (latest.subtopics as any)?.slug ?? '',
          last_score_pct: lastPct,
          last_marks_awarded: latest.marks_awarded,
          last_marks_available: latest.marks_available,
          completed_at: latest.completed_at,
          trend,
        };
      }
    );

    // Weakest: last session per subtopic where score < 50%, worst first (up to 3)
    const allLatestPerSubtopic = new Map<string, (typeof allSessions)[0]>();
    for (const s of allSessions) {
      if (!allLatestPerSubtopic.has(s.subtopic_id)) {
        allLatestPerSubtopic.set(s.subtopic_id, s);
      }
    }

    const weakSubtopics: WeakSubtopic[] = Array.from(
      allLatestPerSubtopic.values()
    )
      .map((s) => ({
        subtopic_id: s.subtopic_id,
        subtopic_name: (s.subtopics as any)?.subtopic_name ?? 'Unknown',
        slug: (s.subtopics as any)?.slug ?? '',
        last_score_pct: Math.round((s.marks_awarded / s.marks_available) * 100),
        last_marks_awarded: s.marks_awarded,
        last_marks_available: s.marks_available,
      }))
      .filter((s) => s.last_score_pct < 50)
      .sort((a, b) => a.last_score_pct - b.last_score_pct)
      .slice(0, 3);

    setStats({
      sessionsThisWeek: sessionsWeekRes.count ?? 0,
      weeklyGoal: profileRes.data?.weekly_goal ?? 5,
      totalQuestionsAttempted,
      recentSubtopics,
      weakSubtopics,
      hasAnySessions,
    });
    setStatsLoading(false);
  };

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const goalPct = stats
    ? Math.min(
        100,
        Math.round((stats.sessionsThisWeek / stats.weeklyGoal) * 100)
      )
    : 0;

  const goalLabel = stats
    ? stats.sessionsThisWeek >= stats.weeklyGoal
      ? '🎉 Goal reached!'
      : stats.sessionsThisWeek >= stats.weeklyGoal * 0.6
        ? 'On track'
        : stats.sessionsThisWeek > 0
          ? 'Keep going'
          : 'Not started'
    : '';

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero banner ──────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(140deg, #C8331F 0%, #E23D28 45%, #F5A623 100%)',
        }}
      >
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

        <div className="max-w-3xl mx-auto px-6 py-10 relative z-10">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            Your Hub
          </p>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: '#fff', letterSpacing: '-0.02em' }}
          >
            Hey {firstName} 👋
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            {!statsLoading && stats?.hasAnySessions
              ? "Here's where things stand."
              : 'Ready to start practising?'}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* ── Empty state ──────────────────────────────────────────── */}
        {!statsLoading && stats && !stats.hasAnySessions && (
          <div
            className="bg-card rounded-xl p-10 text-center border border-border"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, rgba(226,61,40,0.10) 0%, rgba(245,166,35,0.12) 100%)',
              }}
            >
              <Zap size={24} style={{ color: '#E23D28' }} />
            </div>
            <h2 className="text-lg font-bold mb-1">No sessions yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Complete your first Jam Session and your progress will appear
              here.
            </p>
            <button
              onClick={() => navigate('/practice')}
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-150 active:scale-[0.97]"
              style={{
                color: '#fff',
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                boxShadow: '0 2px 10px rgba(226,61,40,0.28)',
              }}
            >
              Start your first Jam Session <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ── Stats row ────────────────────────────────────────────── */}
        {(statsLoading || (stats && stats.hasAnySessions)) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Sessions this week */}
            <div
              className="bg-card rounded-xl p-5 border border-border"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <BookOpen size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  This week
                </span>
              </div>
              {statsLoading ? (
                <Skeleton w="w-12" h="h-8" />
              ) : (
                <>
                  <p className="text-2xl font-bold leading-none mb-2">
                    {stats!.sessionsThisWeek}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      / {stats!.weeklyGoal}
                    </span>
                  </p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${goalPct}%`,
                        background:
                          'linear-gradient(90deg, #E23D28 0%, #F5A623 100%)',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {goalLabel}
                  </p>
                </>
              )}
            </div>

            {/* Total questions */}
            <div
              className="bg-card rounded-xl p-5 border border-border"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Target size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Questions done
                </span>
              </div>
              {statsLoading ? (
                <Skeleton w="w-16" h="h-8" />
              ) : (
                <>
                  <p className="text-2xl font-bold leading-none mb-2">
                    {stats!.totalQuestionsAttempted}
                  </p>
                  <p className="text-[11px] text-muted-foreground">all time</p>
                </>
              )}
            </div>

            {/* Start session CTA card */}
            <button
              onClick={() => navigate('/practice')}
              className="bg-card rounded-xl p-5 border border-border text-left transition-all duration-200 group"
              style={{ boxShadow: CARD_SHADOW }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = CARD_SHADOW)
              }
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Zap size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Jam Session
                </span>
              </div>
              <p className="text-sm font-bold leading-snug mb-2 group-hover:text-[#E23D28] transition-colors">
                Start practising
              </p>
              <div
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: '#E23D28' }}
              >
                Let's go <ArrowRight size={11} />
              </div>
            </button>
          </div>
        )}

        {/* ── Recently studied ─────────────────────────────────────── */}
        {(statsLoading || (stats && stats.hasAnySessions)) && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Recently studied
            </h2>

            {statsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-card rounded-xl p-5 border border-border"
                    style={{ boxShadow: CARD_SHADOW }}
                  >
                    <Skeleton w="w-3/4" h="h-4" rounded="rounded mb-3" />
                    <Skeleton w="w-1/2" h="h-3" rounded="rounded mb-2" />
                    <Skeleton w="w-1/3" h="h-3" rounded="rounded" />
                  </div>
                ))}
              </div>
            ) : stats!.recentSubtopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stats!.recentSubtopics.map((s) => (
                  <button
                    key={s.subtopic_id}
                    onClick={() => navigate(`/practice?subtopic=${s.slug}`)}
                    className="bg-card rounded-xl p-5 border border-border text-left transition-all duration-200 group overflow-hidden relative"
                    style={{ boxShadow: CARD_SHADOW }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'rgba(226,61,40,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = CARD_SHADOW;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '';
                    }}
                  >
                    {/* Left gradient bar coloured by score */}
                    <div
                      className="absolute top-0 left-0 bottom-0 w-[3px]"
                      style={{
                        background: `linear-gradient(180deg, ${scoreColour(s.last_score_pct)} 0%, ${scoreColour(s.last_score_pct)}88 100%)`,
                      }}
                    />
                    <div className="pl-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3
                          className="text-[13px] font-bold tracking-tight leading-snug flex-1"
                          style={{ letterSpacing: '-0.01em' }}
                        >
                          {s.subtopic_name}
                        </h3>
                        <div className="flex-shrink-0 mt-0.5">
                          {s.trend === 'up' && (
                            <TrendingUp
                              size={13}
                              style={{ color: '#2D9A5F' }}
                            />
                          )}
                          {s.trend === 'down' && (
                            <TrendingDown
                              size={13}
                              style={{ color: '#E23D28' }}
                            />
                          )}
                          {s.trend === 'flat' && (
                            <Minus size={13} style={{ color: '#A09A92' }} />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: scoreColour(s.last_score_pct),
                            background: scoreBg(s.last_score_pct),
                          }}
                        >
                          {s.last_marks_awarded}/{s.last_marks_available} marks
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(s.completed_at)}
                        </span>
                      </div>

                      <p
                        className="text-[11px] font-semibold mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#E23D28' }}
                      >
                        Practise again →
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Work on next ─────────────────────────────────────────── */}
        {!statsLoading &&
          stats &&
          stats.hasAnySessions &&
          stats.weakSubtopics.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Work on next
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                These subtopics could use some more practice.
              </p>

              <div className="space-y-3">
                {stats.weakSubtopics.map((s) => (
                  <button
                    key={s.subtopic_id}
                    onClick={() => navigate(`/practice?subtopic=${s.slug}`)}
                    className="w-full bg-card rounded-xl border border-border text-left transition-all duration-200 group overflow-hidden flex items-stretch"
                    style={{ boxShadow: CARD_SHADOW }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.borderColor = 'rgba(226,61,40,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = CARD_SHADOW;
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '';
                    }}
                  >
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
                          className="text-[13px] font-bold tracking-tight"
                          style={{ letterSpacing: '-0.01em' }}
                        >
                          {s.subtopic_name}
                        </h3>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                          style={{
                            color: scoreColour(s.last_score_pct),
                            background: scoreBg(s.last_score_pct),
                          }}
                        >
                          Last score: {s.last_marks_awarded}/
                          {s.last_marks_available} marks
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0 ml-4 opacity-60 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#E23D28' }}
                      >
                        Practise <ArrowRight size={11} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default Dashboard;
