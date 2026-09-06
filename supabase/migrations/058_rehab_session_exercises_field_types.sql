-- Migration 058 — Validate individual exercise field types, not just
-- "array of objects".
--
-- 053 only checked each element was a JSON object — a row like
-- {"name": {}} still passed. RehabSessionModal calls `ex.name.trim()`
-- unconditionally when saving, so reopening a session with a malformed
-- `name` (missing, or not a string) throws and blocks the clinician from
-- editing it at all. Require `name` to be a present string, and — when
-- present — `sets` a number or null, `reps`/`load` a string or null,
-- matching RehabSessionExercise's shape (sets/reps/load already tolerate
-- being entirely absent, matching how the app's own sanitizer treats them).

CREATE OR REPLACE FUNCTION valid_rehab_exercises(exercises jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(exercises) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(exercises) elem
      WHERE jsonb_typeof(elem) != 'object'
         OR NOT (elem ? 'name' AND jsonb_typeof(elem->'name') = 'string')
         OR (elem ? 'sets' AND jsonb_typeof(elem->'sets') NOT IN ('number', 'null'))
         OR (elem ? 'reps' AND jsonb_typeof(elem->'reps') NOT IN ('string', 'null'))
         OR (elem ? 'load' AND jsonb_typeof(elem->'load') NOT IN ('string', 'null'))
    )
$$;
