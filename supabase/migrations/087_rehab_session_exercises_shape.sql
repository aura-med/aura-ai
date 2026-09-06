-- RENUMBERED: originally 053, renamed to 087 (2026-09-06) so it sorts after
-- 084 (see 084's note for why 084 moved). Sequence requirement: must apply
-- AFTER 084 — this migration constrains the `exercises` column 084 creates;
-- running at its original slot (053, before 084 existed) would fail with
-- "column exercises does not exist". Must apply BEFORE 088.
--
-- Migration 087 — Constrain rehab_sessions.exercises to an array of objects.
--
-- 084 added the column with no structural constraint beyond "is jsonb". The
-- API route (sanitizeExercises in app/api/athletes/[id]/rehab-sessions/route.ts)
-- coerces whatever it's given into the expected shape, but a doctor/physio/
-- owner writing rehab_sessions directly through the Data API bypasses that
-- entirely — a malformed value (a JSON string, an array of scalars, etc.)
-- would reach TreatmentsTab's `.map(...)` over each exercise and throw,
-- breaking the treatments view. A CHECK constraint can't contain a subquery
-- directly, so the validation is a small immutable SQL function instead.

CREATE OR REPLACE FUNCTION valid_rehab_exercises(exercises jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(exercises) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(exercises) elem
      WHERE jsonb_typeof(elem) != 'object'
    )
$$;

ALTER TABLE rehab_sessions DROP CONSTRAINT IF EXISTS rehab_sessions_exercises_shape;
ALTER TABLE rehab_sessions
  ADD CONSTRAINT rehab_sessions_exercises_shape CHECK (valid_rehab_exercises(exercises));
