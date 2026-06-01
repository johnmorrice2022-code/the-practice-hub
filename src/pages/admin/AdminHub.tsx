// src/pages/admin/AdminHub.tsx
//
// Admin CMS — Control Panel Hub
// Route: /admin
//
// Single entry point linking to all admin tools.
// Shows live stats per tool pulled from Supabase.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ImageIcon,
  GitBranch,
  Triangle,
  ArrowRight,
  Loader2,
  X,
  LayoutDashboard,
  Clock,
  Check,
  Megaphone,
  Flag,
  BookOpen,
  Layers,
} from 'lucide-react';
// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'johnmorrice2022@gmail.com';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  diagramsUploaded: number | null;
  probabilityQuestions: number | null;
  feedbackCount: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count paragraphs across all learning_content rows that have a diagram_url set */
async function countDiagramsUploaded(): Promise<number> {
  const { data, error } = await supabase
    .from('learning_content')
    .select('sections');

  if (error || !data) return 0;

  let count = 0;
  for (const row of data) {
    const sections = row.sections as unknown as Array<{
      paragraphs?: Array<{ diagram_url?: string }>;
    }>;
    if (!Array.isArray(sections)) continue;
    for (const section of sections) {
      if (!Array.isArray(section.paragraphs)) continue;
      for (const para of section.paragraphs) {
        if (para.diagram_url && para.diagram_url.trim() !== '') count++;
      }
    }
  }
  return count;
}

async function countProbabilityQuestions(): Promise<number> {
  const { count, error } = await supabase
    .from('seeded_questions')
    .select('*', { count: 'exact', head: true })
    .eq('diagram_component', 'probability-tree');

  if (error || count === null) return 0;
  return count;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminHub() {
  const navigate = useNavigate();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats>({
    diagramsUploaded: null,
    probabilityQuestions: null,
    feedbackCount: null,
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      if (email === ADMIN_EMAIL) {
        setAuthed(true);
      } else {
        navigate('/');
      }
      setAuthChecked(true);
    });
  }, [navigate]);

  // ── Fetch stats ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authed) return;

    Promise.all([
      countDiagramsUploaded(),
      countProbabilityQuestions(),
      supabase
        .from('question_feedback')
        .select('*', { count: 'exact', head: true })
        .then(({ count }) => count ?? 0),
    ]).then(([diagramsUploaded, probabilityQuestions, feedbackCount]) => {
      setStats({ diagramsUploaded, probabilityQuestions, feedbackCount });
    });
  }, [authed]);

  if (!authChecked || !authed) return null;

  const statsLoaded =
    stats.diagramsUploaded !== null && stats.probabilityQuestions !== null;

  return (
    <div className="min-h-screen" style={{ background: '#f9f3eb' }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: '#f9f3eb', borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: '#E23D28' }}
            >
              <LayoutDashboard size={14} color="white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-800">
                Admin Hub
              </span>
              <span
                className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: '#F5A623', color: 'white' }}
              >
                CMS
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Exit
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Section label */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-4">
          Content tools
        </p>

        {/* ── Live tools ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* Content Pipeline */}
          <ToolCard
            icon={<Layers size={18} color="white" />}
            iconBg="#E23D28"
            title="Content Pipeline"
            description="Create subtopics, manage prompt config, track content status and go live."
            stat={null}
            statLabel=""
            statsLoaded={true}
            onClick={() => navigate('/admin/content-pipeline')}
          />

          {/* Learning Content Editor */}
          <ToolCard
            icon={<BookOpen size={18} color="white" />}
            iconBg="#E23D28"
            title="Learning Content"
            description="Edit section headings, paragraph text and styles for any subtopic."
            stat={null}
            statLabel=""
            statsLoaded={true}
            onClick={() => navigate('/admin/learning-content')}
          />

          {/* Diagram CMS */}
          <ToolCard
            icon={<ImageIcon size={18} color="white" />}
            iconBg="#E23D28"
            title="Diagram CMS"
            description="Upload diagrams to learning content paragraphs by subtopic."
            stat={stats.diagramsUploaded}
            statLabel="diagrams uploaded"
            statsLoaded={statsLoaded}
            onClick={() => navigate('/admin/diagrams')}
          />

          {/* Probability Questions */}
          <ToolCard
            icon={<GitBranch size={18} color="white" />}
            iconBg="#E23D28"
            title="Probability Questions"
            description="Author probability tree questions for Foundation students."
            stat={stats.probabilityQuestions}
            statLabel="questions authored"
            statsLoaded={statsLoaded}
            onClick={() => navigate('/admin/probability-questions')}
          />
          {/* Review Queue */}
          <ToolCard
            icon={<Check size={18} color="white" />}
            iconBg="#22c55e"
            title="Review Queue"
            description="Generate, review and publish AI questions for Maths subtopics."
            stat={null}
            statLabel="questions pending"
            statsLoaded={true}
            onClick={() => navigate('/admin/review-queue')}
          />

          {/* Members Area */}
          <ToolCard
            icon={<Megaphone size={18} color="white" />}
            iconBg="#E23D28"
            title="Members Area"
            description="Post announcements and manage livestream links for subscribers."
            stat={null}
            statLabel=""
            statsLoaded={true}
            onClick={() => navigate('/admin/members')}
          />

          {/*{/* Question Feedback */}
          <ToolCard
            icon={<Flag size={18} color="white" />}
            iconBg="#E23D28"
            title="Question Feedback"
            description="Review flagged questions where students felt marking was wrong or questions were unclear."
            stat={stats.feedbackCount}
            statLabel="flags to review"
            statsLoaded={stats.feedbackCount !== null}
            onClick={() => navigate('/admin/feedback')}
          />
        </div>

        {/* ── Coming soon ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ComingSoonCard
            icon={<Triangle size={16} color="#9ca3af" />}
            title="Trig Questions"
            description="Author trigonometry diagram questions."
          />
          <ComingSoonCard
            icon={<ArrowRight size={16} color="#9ca3af" />}
            title="Vector Questions"
            description="Author vector diagram questions."
          />
          <ComingSoonCard
            icon={<GitBranch size={16} color="#9ca3af" />}
            title="Higher Probability"
            description="Extend probability authoring to Higher tier subtopics."
          />
          <ComingSoonCard
            icon={<LayoutDashboard size={16} color="#9ca3af" />}
            title="Frequency Trees & Venn"
            description="Author frequency tree and Venn diagram questions."
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToolCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  stat: number | null;
  statLabel: string;
  statsLoaded: boolean;
  onClick: () => void;
}

function ToolCard({
  icon,
  iconBg,
  title,
  description,
  stat,
  statLabel,
  statsLoaded,
  onClick,
}: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-black/5 shadow-sm p-5 text-left hover:shadow-md transition-all duration-200 group w-full"
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <ArrowRight
          size={14}
          className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all mt-0.5"
        />
      </div>

      <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
      <p className="text-xs text-gray-400 leading-relaxed mb-4">
        {description}
      </p>

      {/* Stat */}
      <div
        className="flex items-center gap-2 pt-3 border-t"
        style={{ borderColor: 'rgba(0,0,0,0.05)' }}
      >
        {!statsLoaded ? (
          <Loader2 size={11} className="animate-spin text-gray-300" />
        ) : (
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: '#E23D28' }}
          >
            {stat}
          </span>
        )}
        <span className="text-[11px] text-gray-400">{statLabel}</span>
      </div>
    </button>
  );
}

interface ComingSoonCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ComingSoonCard({ icon, title, description }: ComingSoonCardProps) {
  return (
    <div
      className="bg-white/50 rounded-xl border border-black/4 p-5"
      style={{ borderColor: 'rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={10} className="text-gray-300" />
          <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wide">
            Soon
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-400 mb-1">{title}</p>
      <p className="text-xs text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
}
