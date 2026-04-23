import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { BookOpen, Zap, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const [sessionsThisWeek, setSessionsThisWeek] = useState<number>(0);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(5);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      // Start of the current week (Monday)
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const [sessionsRes, profileRes] = await Promise.all([
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
      ]);

      setSessionsThisWeek(sessionsRes.count ?? 0);
      setWeeklyGoal(profileRes.data?.weekly_goal ?? 5);
      setStatsLoading(false);
    };

    fetchStats();
  }, [user]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold">
            Hey {firstName} <span className="text-accent-amber">👋</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Ready to practise? Jump into a Jam Session.
          </p>
        </div>

        {/* Primary CTA */}
        <Link to="/practice">
          <div className="bg-card rounded-xl p-8 card-shadow border border-border hover:border-primary/30 transition-colors cursor-pointer group">
            <div className="flex items-start gap-5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-lg font-bold group-hover:text-primary transition-colors">
                  Start a Jam Session
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pick your subject, topic, and tier — then answer exam-style
                  questions at your level.
                </p>
              </div>
              <Button variant="default" size="sm" className="shrink-0 mt-1">
                Let's go
              </Button>
            </div>
          </div>
        </Link>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-6 card-shadow border border-border space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BookOpen size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Sessions this week
              </span>
            </div>
            <p className="text-2xl font-bold">
              {statsLoading ? (
                <span className="inline-block w-6 h-7 bg-muted rounded animate-pulse" />
              ) : (
                sessionsThisWeek
              )}
            </p>
          </div>

          <div className="bg-card rounded-xl p-6 card-shadow border border-border space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">
                Weekly goal
              </span>
            </div>
            <p className="text-2xl font-bold">
              {statsLoading ? (
                <span className="inline-block w-16 h-7 bg-muted rounded animate-pulse" />
              ) : (
                <>
                  {sessionsThisWeek}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {weeklyGoal}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
