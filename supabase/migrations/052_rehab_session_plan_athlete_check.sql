-- Migration 052 — Enforce rehab_sessions.rehab_plan_id belongs to the same athlete.
--
-- 037's FK only checks the referenced rehab_plans row exists, not that it
-- belongs to this session's own athlete_id. The API route
-- (validateRehabPlanOwnership in app/api/athletes/[id]/rehab-sessions/route.ts)
-- already checks this for the app's own writes, but a doctor/physio/owner
-- using the Data API directly bypasses that route entirely — this trigger
-- closes the same gap at the database boundary.

CREATE OR REPLACE FUNCTION enforce_rehab_session_plan_athlete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_athlete_id uuid;
BEGIN
  IF NEW.rehab_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT athlete_id INTO v_plan_athlete_id
  FROM rehab_plans
  WHERE id = NEW.rehab_plan_id;

  IF v_plan_athlete_id IS NULL OR v_plan_athlete_id != NEW.athlete_id THEN
    RAISE EXCEPTION 'rehab_plan_id must reference a rehab plan belonging to the same athlete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rehab_session_plan_athlete ON rehab_sessions;
CREATE TRIGGER trg_enforce_rehab_session_plan_athlete
  BEFORE INSERT OR UPDATE ON rehab_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_rehab_session_plan_athlete();
