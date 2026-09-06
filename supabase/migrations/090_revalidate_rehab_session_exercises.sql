-- RENUMBERED: originally 062, renamed to 090 (2026-09-06) — final step of
-- the exercises-column chain (see 087's note). Sequence requirement: must
-- apply AFTER 089, since it revalidates existing rows against 089's
-- (strictest) predicate. Last in this renumbered group.
--
-- Migration 090 — Revalidate rehab_sessions.exercises against the current
-- (088/089-hardened) predicate, not just 087's original looser one.
--
-- Postgres does not re-check a CHECK constraint's existing rows when the
-- function it calls is replaced (CREATE OR REPLACE) — only when the
-- constraint itself is (re-)added. 088 and 089 only replaced
-- valid_rehab_exercises(), so a row that slipped in during the gap between
-- 087 and 088/089 (or written directly via the Data API in that window) can
-- still violate the current, stricter predicate and reach
-- RehabSessionModal's ex.name.trim() unguarded.
--
-- Drop each individual exercise element that fails the current predicate
-- (rather than the whole row, or refusing to migrate) — a malformed element
-- has no recoverable "correct" value to repair to, and the session's other,
-- valid exercises shouldn't be lost along with it. Then re-add the
-- constraint so ADD CONSTRAINT's own validation pass (which, unlike
-- replacing the function, DOES scan every existing row) confirms nothing
-- violates it anymore.
--
-- Known narrow gap (Codex): this cleanup runs after 087, so on a database
-- where 087's own ADD CONSTRAINT fails outright against pre-existing data
-- that isn't even array-of-objects shaped (e.g. exercises = [1]), migration
-- application aborts at 087 and never reaches this file. Not a risk for
-- this deployment — 087 already applied cleanly here — but a from-scratch
-- environment with such data already present before running 087 would need
-- manual cleanup first; 087 itself can't be edited in place since it's
-- already applied.

UPDATE rehab_sessions
SET exercises = COALESCE((
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(exercises) elem
  WHERE jsonb_typeof(elem) = 'object'
    AND (elem ? 'name' AND jsonb_typeof(elem->'name') = 'string')
    AND (NOT (elem ? 'sets') OR jsonb_typeof(elem->'sets') = 'null' OR (
      jsonb_typeof(elem->'sets') = 'number'
      AND (elem->>'sets')::numeric >= 0
      AND (elem->>'sets')::numeric = trunc((elem->>'sets')::numeric)
    ))
    AND (NOT (elem ? 'reps') OR jsonb_typeof(elem->'reps') IN ('string', 'null'))
    AND (NOT (elem ? 'load') OR jsonb_typeof(elem->'load') IN ('string', 'null'))
), '[]'::jsonb)
WHERE NOT valid_rehab_exercises(exercises);

ALTER TABLE rehab_sessions DROP CONSTRAINT IF EXISTS rehab_sessions_exercises_shape;
ALTER TABLE rehab_sessions
  ADD CONSTRAINT rehab_sessions_exercises_shape CHECK (valid_rehab_exercises(exercises));
