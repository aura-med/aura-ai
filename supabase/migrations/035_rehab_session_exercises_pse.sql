-- Migration 035 — Structured exercises + PSE on the physio session log.
--
-- The club's real "Tratamentos"/"Condicionados" session sheets log each
-- session as a small exercise table (name, sets, reps/duration, load) plus a
-- single session-level PSE (perceived exertion, 0-10). rehab_sessions
-- (migration 008's physio-log side — see 027/033/034 for the naming
-- collision history) only had a free-text description; add the two missing
-- fields directly rather than a child table, since a session's exercise list
-- is always read/written as one unit with the session itself, not managed as
-- independent rows.

ALTER TABLE rehab_sessions
  ADD COLUMN IF NOT EXISTS pse       smallint CHECK (pse IS NULL OR (pse BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS exercises jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN rehab_sessions.pse IS
  'Perceived exertion for the whole session, 0-10 (Borg CR10-style), matching the club''s paper "PSE" field.';
COMMENT ON COLUMN rehab_sessions.exercises IS
  'Ordered array of { name: text, sets: number|null, reps: text|null, load: text|null }. reps/load are free text because the source sheets mix counts, durations ("30\"") and qualitative loads (band colour, bodyweight).';
