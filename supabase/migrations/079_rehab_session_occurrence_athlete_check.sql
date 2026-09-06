-- Migration 079 — Enforce rehab_sessions.occurrence_id belongs to the same athlete.
--
-- 033's FK on rehab_sessions.occurrence_id only checks the referenced
-- occurrences row exists, not that it belongs to this session's own
-- athlete_id — same gap 052 already closed for rehab_plan_id. The app
-- route (validateOccurrenceOwnership in
-- app/api/athletes/[id]/rehab-sessions/route.ts) now checks this for the
-- app's own writes, but a doctor/physio/owner using the Data API directly
-- bypasses that route entirely — this trigger closes the same gap at the
-- database boundary. Mirrors 052's identical pattern for rehab_plan_id.
--
-- A trigger alone only stops NEW mismatches. Unlike rehab_plan_id (052),
-- this route's own occurrence_id writes were never validated before this
-- fix, so an existing session already linking a mismatched occurrence is
-- a real possibility, not just a theoretical Data API gap. Null out any
-- such existing mismatch first — same "clean before constraining" shape
-- as 072/076's dedup steps.

UPDATE rehab_sessions s
SET occurrence_id = NULL
WHERE s.occurrence_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM occurrences o
    WHERE o.id = s.occurrence_id AND o.athlete_id = s.athlete_id
  );

CREATE OR REPLACE FUNCTION enforce_rehab_session_occurrence_athlete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occurrence_athlete_id uuid;
BEGIN
  IF NEW.occurrence_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT athlete_id INTO v_occurrence_athlete_id
  FROM occurrences
  WHERE id = NEW.occurrence_id;

  IF v_occurrence_athlete_id IS NULL OR v_occurrence_athlete_id != NEW.athlete_id THEN
    RAISE EXCEPTION 'occurrence_id must reference an occurrence belonging to the same athlete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rehab_session_occurrence_athlete ON rehab_sessions;
CREATE TRIGGER trg_enforce_rehab_session_occurrence_athlete
  BEFORE INSERT OR UPDATE ON rehab_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_rehab_session_occurrence_athlete();
