-- Scaffold support for ai_freeresponse questions (Explain/State/Show/Prove).
-- Nullable jsonb: { "vocabulary": string[], "sentence_starter": string }.
-- AI-drafted alongside generation, reviewed before publish (no live AI call
-- when a student opens the panel — pure static reveal).
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS scaffold jsonb;
ALTER TABLE public.pending_questions ADD COLUMN IF NOT EXISTS scaffold jsonb;
