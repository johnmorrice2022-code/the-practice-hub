-- Backfill: define the AI question-pipeline tables that were originally created
-- directly on the live database and never tracked in a migration.
--
-- Reconstructed 24/06/2026 from live schema introspection (PostgREST OpenAPI),
-- because Docker/pg_dump was unavailable. Columns, types, nullability and
-- foreign keys match live exactly. Defaults and RLS policies follow project
-- convention (mirroring seeded_questions in the base migration) — the LIVE
-- database remains authoritative for those. This file is registered against the
-- live migration history via `supabase migration repair --status applied`, so it
-- does NOT execute on live; it exists for version-control review and to make a
-- fresh `supabase db reset` reproducible.
--
-- Dated immediately after the base migration (20260325110105) because these
-- tables predate the later diagram (20260610120000), tier (20260618000000) and
-- answer_model (20260624120000) migrations, which ALTER them. The column set
-- here is therefore the ORIGINAL set — diagram_component/diagram_params, tier and
-- answer_model are added by those later migrations, not here.

-- One row per batch generation run.
CREATE TABLE IF NOT EXISTS public.generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  subtopic_id uuid NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  tier text NOT NULL,
  prompt_version text NOT NULL,
  question_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
);

-- Live, reviewed AI question bank (teacher-approved).
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  subtopic_id uuid NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  marks integer NOT NULL DEFAULT 1,
  mark_scheme jsonb NOT NULL DEFAULT '[]'::jsonb,
  worked_solution text DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculator_allowed boolean,
  source text NOT NULL DEFAULT 'ai'
);

-- Holding pen for AI-generated drafts awaiting review.
CREATE TABLE IF NOT EXISTS public.pending_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.generation_batches(id) ON DELETE CASCADE,
  subtopic_id uuid NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  marks integer NOT NULL DEFAULT 1,
  mark_scheme jsonb NOT NULL DEFAULT '[]'::jsonb,
  worked_solution text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  prompt_version text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculator_allowed boolean
);

-- Audit log of edits made during review.
CREATE TABLE IF NOT EXISTS public.pending_question_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  pending_question_id uuid NOT NULL REFERENCES public.pending_questions(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  edited_by uuid REFERENCES public.profiles(id)
);

-- ─── RLS (mirrors the seeded_questions convention) ──────────────────────────
-- Students read approved `questions` directly; the pipeline tables are admin-only.

ALTER TABLE public.generation_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_question_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions"
  ON public.questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage generation_batches" ON public.generation_batches;
CREATE POLICY "Admins can manage generation_batches"
  ON public.generation_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage pending_questions" ON public.pending_questions;
CREATE POLICY "Admins can manage pending_questions"
  ON public.pending_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage pending_question_edits" ON public.pending_question_edits;
CREATE POLICY "Admins can manage pending_question_edits"
  ON public.pending_question_edits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
