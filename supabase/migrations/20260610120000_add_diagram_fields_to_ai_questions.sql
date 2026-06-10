-- Add diagram fields to AI-generated question tables, mirroring seeded_questions
ALTER TABLE public.pending_questions
  ADD COLUMN diagram_component text,
  ADD COLUMN diagram_params jsonb;

ALTER TABLE public.questions
  ADD COLUMN diagram_component text,
  ADD COLUMN diagram_params jsonb;
