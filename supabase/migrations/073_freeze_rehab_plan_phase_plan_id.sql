-- Migration 073 — Freeze rehab_plan_phases.plan_id after creation.
--
-- 072's trigger enforces rehab_plan_days.phase_id points at a phase
-- belonging to the same plan_id, but only runs on rehab_plan_days writes.
-- If a caller instead changes the PHASE's own plan_id (moving it to a
-- different plan) directly through the Data API, 072's trigger never
-- fires, and every rehab_plan_days row already linked to that phase is
-- left pointing at a phase now owned by a different plan — silently
-- reintroducing the exact cross-plan link 072 was written to prevent. The
-- application never legitimately reassigns a phase to a different plan
-- after creation, so freeze the column instead of trying to re-validate
-- every dependent day. Mirrors 056's identical freeze of
-- rehab_plans.athlete_id.

CREATE OR REPLACE FUNCTION freeze_rehab_plan_phase_plan_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Cannot reassign a rehab plan phase to a different plan'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_rehab_plan_phase_plan_id ON rehab_plan_phases;
CREATE TRIGGER trg_freeze_rehab_plan_phase_plan_id
  BEFORE UPDATE ON rehab_plan_phases
  FOR EACH ROW EXECUTE FUNCTION freeze_rehab_plan_phase_plan_id();
