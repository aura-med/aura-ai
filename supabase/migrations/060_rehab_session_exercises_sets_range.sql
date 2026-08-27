-- Migration 060 — Reject negative/non-integer exercise set counts.
--
-- The app's route sanitizer now clamps sets to a non-negative integer
-- (Math.max(0, Math.round(...))), but 058's DB constraint only checked the
-- JSON type ('number' or 'null') — a value like {"name":"Squat","sets":-3}
-- written directly through the Data API still passes. Require sets, when
-- present and not null, to be a non-negative integer.

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
         OR (
              elem ? 'sets' AND jsonb_typeof(elem->'sets') = 'number'
              AND ((elem->>'sets')::numeric < 0 OR (elem->>'sets')::numeric != trunc((elem->>'sets')::numeric))
            )
         OR (elem ? 'reps' AND jsonb_typeof(elem->'reps') NOT IN ('string', 'null'))
         OR (elem ? 'load' AND jsonb_typeof(elem->'load') NOT IN ('string', 'null'))
    )
$$;
