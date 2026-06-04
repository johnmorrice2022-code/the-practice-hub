import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus, Youtube, Megaphone } from 'lucide-react';

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
  link_url?: string | null;
  link_image_url?: string | null;
}

const AdminMembers = () => {
  const [links, setLinks] = useState<LivestreamLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [newLink, setNewLink] = useState({
    subject: 'maths' as 'maths' | 'physics',
    title: '',
    youtube_url: '',
    stream_date: '',
  });
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    body: '',
    link_url: '',
    link_image_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    const [linksRes, announcementsRes] = await Promise.all([
      supabase
        .from('livestream_links')
        .select('*')
        .order('stream_date', { ascending: false }),
      supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    setLinks(linksRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addLink = async () => {
    if (!newLink.title || !newLink.youtube_url || !newLink.stream_date) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('livestream_links').insert(newLink);
    if (err) { setError(`Add link failed: ${err.message}`); setSaving(false); return; }
    setNewLink({ subject: 'maths', title: '', youtube_url: '', stream_date: '' });
    await fetchData();
    setSaving(false);
  };

  const deleteLink = async (id: string) => {
    setError(null);
    const { error: err } = await supabase.from('livestream_links').delete().eq('id', id);
    if (err) { setError(`Delete failed: ${err.message}`); return; }
    await fetchData();
  };

  const addAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.body) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('announcements').insert({
      title: newAnnouncement.title,
      body: newAnnouncement.body,
      link_url: newAnnouncement.link_url || null,
      link_image_url: newAnnouncement.link_image_url || null,
    });
    if (err) { setError(`Post failed: ${err.message}`); setSaving(false); return; }
    setNewAnnouncement({ title: '', body: '', link_url: '', link_image_url: '' });
    await fetchData();
    setSaving(false);
  };

  const deleteAnnouncement = async (id: string) => {
    setError(null);
    const { error: err } = await supabase.from('announcements').delete().eq('id', id);
    if (err) { setError(`Delete failed: ${err.message}`); return; }
    await fetchData();
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#f9f3eb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#E23D28] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const inputClass =
    'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#E23D28]/30';

  return (
    <div className="min-h-screen bg-[#f9f3eb]">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Members Admin</h1>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Livestream Links */}
        <div
          className="bg-card rounded-xl border border-border overflow-hidden"
          style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
        >
          <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
            <Youtube size={16} className="text-[#E23D28]" />
            <h2 className="font-semibold text-sm">Livestream Links</h2>
          </div>
          <div className="p-6 space-y-3">
            <select
              value={newLink.subject}
              onChange={(e) =>
                setNewLink((p) => ({
                  ...p,
                  subject: e.target.value as 'maths' | 'physics',
                }))
              }
              className={inputClass}
            >
              <option value="maths">Maths</option>
              <option value="physics">Physics</option>
            </select>
            <input
              placeholder="Title"
              value={newLink.title}
              onChange={(e) =>
                setNewLink((p) => ({ ...p, title: e.target.value }))
              }
              className={inputClass}
            />
            <input
              placeholder="YouTube URL"
              value={newLink.youtube_url}
              onChange={(e) =>
                setNewLink((p) => ({ ...p, youtube_url: e.target.value }))
              }
              className={inputClass}
            />
            <input
              type="date"
              value={newLink.stream_date}
              onChange={(e) =>
                setNewLink((p) => ({ ...p, stream_date: e.target.value }))
              }
              className={inputClass}
            />
            <button
              onClick={addLink}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              }}
            >
              <Plus size={14} /> Add Link
            </button>
          </div>
          <div className="divide-y divide-border">
            {links.map((link) => (
              <div
                key={link.id}
                className="px-6 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium">{link.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.subject} · {link.stream_date}
                  </p>
                </div>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div
          className="bg-card rounded-xl border border-border overflow-hidden"
          style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
        >
          <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
            <Megaphone size={16} className="text-[#E23D28]" />
            <h2 className="font-semibold text-sm">Announcements</h2>
          </div>
          <div className="p-6 space-y-3">
            <input
              placeholder="Title"
              value={newAnnouncement.title}
              onChange={(e) =>
                setNewAnnouncement((p) => ({ ...p, title: e.target.value }))
              }
              className={inputClass}
            />
            <textarea
              placeholder="Body"
              value={newAnnouncement.body}
              onChange={(e) =>
                setNewAnnouncement((p) => ({ ...p, body: e.target.value }))
              }
              rows={3}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground pt-1">Blog link — optional</p>
            <input
              placeholder="Blog post URL"
              value={newAnnouncement.link_url}
              onChange={(e) =>
                setNewAnnouncement((p) => ({ ...p, link_url: e.target.value }))
              }
              className={inputClass}
            />
            <input
              placeholder="Blog image URL (from WordPress media library)"
              value={newAnnouncement.link_image_url}
              onChange={(e) =>
                setNewAnnouncement((p) => ({ ...p, link_image_url: e.target.value }))
              }
              className={inputClass}
            />
            <button
              onClick={addAnnouncement}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{
                background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
              }}
            >
              <Plus size={14} /> Post Announcement
            </button>
          </div>
          <div className="divide-y divide-border">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="px-6 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.body.slice(0, 60)}...
                  </p>
                </div>
                <button
                  onClick={() => deleteAnnouncement(a.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMembers;
