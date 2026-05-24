import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Youtube, Megaphone, Lock } from 'lucide-react';

interface LivestreamLink {
  id: string;
  subject: 'maths' | 'physics';
  title: string;
  youtube_url: string;
  stream_date: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

const Members = () => {
  const {
    isSubscribed,
    hasMathsStreams,
    hasPhysicsStreams,
    subscriptionLoading,
  } = useAuth();
  const navigate = useNavigate();

  const [mathsLinks, setMathsLinks] = useState<LivestreamLink[]>([]);
  const [physicsLinks, setPhysicsLinks] = useState<LivestreamLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isSubscribed) navigate('/dashboard');
  }, [isSubscribed, subscriptionLoading]);

  useEffect(() => {
    const fetchData = async () => {
      const [linksRes, announcementsRes] = await Promise.all([
        supabase
          .from('livestream_links')
          .select('*')
          .order('stream_date', { ascending: false })
          .limit(10),
        supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      const links = linksRes.data ?? [];
      setMathsLinks(links.filter((l) => l.subject === 'maths'));
      setPhysicsLinks(links.filter((l) => l.subject === 'physics'));
      setAnnouncements(announcementsRes.data ?? []);
      setDataLoading(false);
    };
    if (isSubscribed) fetchData();
    else setDataLoading(false);
  }, [isSubscribed]);

  if (subscriptionLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#f9f3eb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#E23D28] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const StreamSection = ({
    title,
    subject,
    links,
    hasAccess,
  }: {
    title: string;
    subject: string;
    links: LivestreamLink[];
    hasAccess: boolean;
  }) => (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden"
      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
    >
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
        }}
      >
        <Youtube size={18} className="text-white" />
        <h2 className="text-white font-semibold">{title}</h2>
      </div>
      {!hasAccess ? (
        <div className="px-6 py-8 text-center">
          <Lock size={24} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Upgrade to access {subject} livestream sessions.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-xs font-semibold px-4 py-2 rounded-lg text-white"
            style={{
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            }}
          >
            Upgrade plan
          </button>
        </div>
      ) : links.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No sessions posted yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {links.map((link) => (
            <div
              key={link.id}
              className="px-6 py-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">{link.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {formatDate(link.stream_date)}
                  </p>
                </div>
              </div>
              <a
                href={link.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                }}
              >
                <Youtube size={12} /> Watch
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f9f3eb]">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div
            className="inline-block text-white text-sm font-bold px-4 py-1.5 rounded-lg mb-3"
            style={{
              background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
            }}
          >
            Members Area
          </div>
          <h1 className="text-2xl font-bold">Welcome to The Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your livestream sessions and latest updates.
          </p>
        </div>

        {announcements.length > 0 && (
          <div
            className="mb-6 bg-card rounded-xl border border-border overflow-hidden"
            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
          >
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              }}
            >
              <Megaphone size={16} className="text-white" />
              <h2 className="font-semibold text-sm text-white">
                Announcements
              </h2>
            </div>
            <div className="divide-y divide-border">
              {announcements.map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <p className="text-sm font-medium mb-1">{a.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {a.body}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {formatDate(a.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <StreamSection
            title="Maths Livestreams"
            subject="Maths"
            links={mathsLinks}
            hasAccess={hasMathsStreams}
          />
          <StreamSection
            title="Physics Livestreams"
            subject="Physics"
            links={physicsLinks}
            hasAccess={hasPhysicsStreams}
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          
            href="https://billing.stripe.com/p/login/test_00w14ggP40WMblCdqyf7i00"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:border-[#E23D28] hover:text-[#E23D28] transition-colors"
          >
            Manage subscription
          </a>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Members;
