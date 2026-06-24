-- Phase 0 of the deterministic-marking project.
--
-- Label every question with its answer model. The platform will eventually use
-- this to decide HOW an answer is checked:
--   numeric_single        -- one clear answer (number / unit / value) -> direct check
--   numeric_with_working  -- Maths "show that"/"prove that" -> scaffolded into steps
--   stepped_calculation   -- Physics calc (equation -> substitution -> answer+unit)
--   multiple_choice       -- pick the correct option -> direct check
--   ai_freeresponse       -- today's behaviour: AI judges the free-text answer
--
-- This migration ONLY adds the field. No code reads it yet. Every existing row
-- is backfilled to 'ai_freeresponse' (via the column default) so behaviour is
-- completely unchanged. The step renderer, deterministic checker, and JAM Help
-- routing are later sessions.
--
-- Applied to all three question-bearing tables so seeded, live AI, and pending
-- questions stay consistent.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['seeded_questions','questions','pending_questions']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS answer_model text
         NOT NULL DEFAULT ''ai_freeresponse''', t);

    EXECUTE format(
      'ALTER TABLE public.%I
         DROP CONSTRAINT IF EXISTS %I', t, t || '_answer_model_chk');

    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I CHECK (answer_model IN
           (''numeric_single'',''numeric_with_working'',
            ''stepped_calculation'',''multiple_choice'',''ai_freeresponse''))',
      t, t || '_answer_model_chk');
  END LOOP;
END $$;
