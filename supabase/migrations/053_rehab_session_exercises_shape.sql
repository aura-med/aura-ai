-- Migration 053 — Constrain rehab_sessions.exercises to an array of objects.
--
-- 035 added the column with no structural constraint beyond "is jsonb". The
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

ALTER TABLE rehab_sessions
  ADD CONSTRAINT rehab_sessions_exercises_shape CHECK (valid_rehab_exercises(exercises));
