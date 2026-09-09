-- Migration 056 — Freeze rehab_plans.athlete_id after creation.
--
-- 052's trigger enforces rehab_sessions.rehab_plan_id points at a plan
-- belonging to the same athlete, but only runs on rehab_sessions writes. If
-- a caller instead changes the PLAN's own athlete_id (moving it to a
-- different athlete) directly through the Data API, 052 never fires, and
-- every rehab_session still linked to that plan is left referencing a plan
-- now owned by someone else. The application never legitimately reassigns
-- a rehab plan to a different athlete after creation, so simply freeze the
-- column instead of trying to re-validate every dependent session.

CREATE OR REPLACE FUNCTION freeze_rehab_plan_athlete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.athlete_id IS DISTINCT FROM OLD.athlete_id THEN
    RAISE EXCEPTION 'Cannot reassign a rehab plan to a different athlete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_rehab_plan_athlete ON rehab_plans;
CREATE TRIGGER trg_freeze_rehab_plan_athlete
  BEFORE UPDATE ON rehab_plans
  FOR EACH ROW EXECUTE FUNCTION freeze_rehab_plan_athlete();
