-- Phase 1: stepped-calculation storage.
--
-- `steps` holds the ordered scaffold for an answer_model = 'stepped_calculation'
-- question: the givens and a list of steps (choose_equation / substitute /
-- numeric), each with its own pre-written hints. NULL for every other answer
-- model. Additive and nullable — nothing reads it yet, so existing behaviour is
-- unchanged. Shape is defined and validated by src/lib/steppedQuestion.ts.
ALTER TABLE public.questions         ADD COLUMN IF NOT EXISTS steps jsonb;
ALTER TABLE public.pending_questions ADD COLUMN IF NOT EXISTS steps jsonb;
ALTER TABLE public.seeded_questions  ADD COLUMN IF NOT EXISTS steps jsonb;
