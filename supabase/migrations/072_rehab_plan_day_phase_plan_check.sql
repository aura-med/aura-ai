-- Migration 072 — Enforce rehab_plan_days.phase_id belongs to the same plan_id.
--
-- 034's FK on rehab_plan_days.phase_id only checks the referenced
-- rehab_plan_phases row exists, not that it belongs to this day's own
-- plan_id. A clinician can write more than one rehab plan, and a tampered
-- server-action or Data API request could assign a day in plan A to a phase
-- from plan B — the write policy (034) only checks plan_id, not the
-- cross-table relationship, so RLS lets it through. The calendar then can't
-- resolve the foreign phase from plan A's own phase list, leaving
-- inconsistent clinical-plan data. Mirrors 052's same trigger-based pattern
-- for rehab_sessions.rehab_plan_id/athlete_id.

CREATE OR REPLACE FUNCTION enforce_rehab_plan_day_phase_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_plan_id uuid;
BEGIN
  IF NEW.phase_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan_id INTO v_phase_plan_id
  FROM rehab_plan_phases
  WHERE id = NEW.phase_id;

  IF v_phase_plan_id IS NULL OR v_phase_plan_id != NEW.plan_id THEN
    RAISE EXCEPTION 'phase_id must reference a phase belonging to the same plan'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rehab_plan_day_phase_plan ON rehab_plan_days;
CREATE TRIGGER trg_enforce_rehab_plan_day_phase_plan
  BEFORE INSERT OR UPDATE ON rehab_plan_days
  FOR EACH ROW EXECUTE FUNCTION enforce_rehab_plan_day_phase_plan();
