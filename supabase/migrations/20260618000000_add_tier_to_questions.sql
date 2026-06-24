-- Per-question tier tagging (added on live 18/06/2026, never tracked).
-- 'Foundation' or 'Higher', nullable — questions generated before 18/06/2026
-- have tier NULL. Backfilled into the tracked history 24/06/2026; registered via
-- `supabase migration repair --status applied` so it does not re-run on live.
ALTER TABLE public.pending_questions ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE public.questions         ADD COLUMN IF NOT EXISTS tier text;
