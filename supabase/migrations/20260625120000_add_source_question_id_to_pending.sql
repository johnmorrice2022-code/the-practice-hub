-- Phase 3 (deterministic marking): link a pending stepped DRAFT back to the live
-- questions row it converts. When set, approving the draft updates that original
-- row IN PLACE (answer_model -> 'stepped_calculation', steps -> the scaffold)
-- rather than inserting a new question — so a curated legacy question becomes
-- deterministically marked without being duplicated.
ALTER TABLE public.pending_questions
  ADD COLUMN IF NOT EXISTS source_question_id uuid
  REFERENCES public.questions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pending_questions.source_question_id IS
  'When set, this pending draft is a stepped conversion of the live questions row with this id; on approval the original row is updated in place rather than a new row inserted.';
