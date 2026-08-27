-- Migration 083 — rehab_plans occurrence ownership + audit-field derivation.
--
-- Two gaps in 034's rehab plan calendar, both closable at the DB boundary
-- the same way 016/052/079 already closed the equivalent gaps for
-- occurrences/rehab_sessions:
--
-- 1. rehab_plans.occurrence_id's FK only checks the occurrence exists, not
--    that it belongs to the plan's own athlete_id — a crafted request
--    (createRehabPlan/updateRehabPlan already validate this now; a direct
--    Data API write bypassing them wouldn't) could link athlete A's plan
--    to athlete B's occurrence. Mirrors 052/079's identical pattern.
--
-- 2. rehab_plans_write/rehab_plan_phases_write/rehab_plan_days_write (034)
--    are FOR ALL policies with no trigger binding created_by/updated_by to
--    auth.uid() — the app already derives them correctly
--    (lib/actions/rehab-plan.ts), but a direct Data API caller could forge
--    either to attribute a plan/phase/day to an arbitrary other user.
--
--    rehab_plan_days is the one nuance: the app deliberately PRESERVES the
--    original author's created_by across an edit or a move (moveRehabPlanDay
--    explicitly carries `source.created_by` forward to the relocated row —
--    reassigning it to whoever moves a day would misattribute existing
--    content). A trigger that blindly forced created_by = auth.uid() on
--    every INSERT would break that intentional behavior. Instead: freeze
--    created_by on UPDATE unconditionally (matches the app's own intent —
--    it never tries to change it on edit), and on INSERT only accept a
--    caller-supplied created_by that already legitimately appears on the
--    SAME plan (proving it came from copying an existing row, not from
--    thin air); anything else — including a plain new day — is derived
--    from auth.uid(). updated_by has no such nuance (the app always sets
--    it to the current user) and is simply always auth.uid().

CREATE OR REPLACE FUNCTION enforce_rehab_plan_occurrence_athlete()
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

DROP TRIGGER IF EXISTS trg_enforce_rehab_plan_occurrence_athlete ON rehab_plans;
CREATE TRIGGER trg_enforce_rehab_plan_occurrence_athlete
  BEFORE INSERT OR UPDATE ON rehab_plans
  FOR EACH ROW EXECUTE FUNCTION enforce_rehab_plan_occurrence_athlete();

-- rehab_plans / rehab_plan_phases: created_by is set once and never
-- legitimately reappears elsewhere, so it's safe to always derive it on
-- INSERT and freeze it on UPDATE — same shape as 016's occurrence pattern.
CREATE OR REPLACE FUNCTION set_rehab_plan_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rehab_plan_created_by ON rehab_plans;
CREATE TRIGGER trg_set_rehab_plan_created_by
  BEFORE INSERT OR UPDATE ON rehab_plans
  FOR EACH ROW EXECUTE FUNCTION set_rehab_plan_created_by();

DROP TRIGGER IF EXISTS trg_set_rehab_plan_phase_created_by ON rehab_plan_phases;
CREATE TRIGGER trg_set_rehab_plan_phase_created_by
  BEFORE INSERT OR UPDATE ON rehab_plan_phases
  FOR EACH ROW EXECUTE FUNCTION set_rehab_plan_created_by();

-- rehab_plan_days: updated_by is always the caller — no nuance, the app
-- always sets it that way itself. created_by's fallback is auth.uid() on
-- INSERT or OLD.created_by on UPDATE (an ordinary edit, which the app
-- already preserves verbatim); a caller-supplied value that DIFFERS from
-- that fallback is only accepted if it already exists elsewhere on the
-- SAME plan — proving it came from copying a row already visible to this
-- caller (moveRehabPlanDay carries the SOURCE row's created_by onto the
-- destination, and deletes the source only afterward, so it's still
-- present at this point for both a plain move and an overwriting one),
-- not from forging an arbitrary unrelated identity.
CREATE OR REPLACE FUNCTION set_rehab_plan_day_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fallback uuid;
BEGIN
  NEW.updated_by := auth.uid();
  v_fallback := CASE WHEN TG_OP = 'UPDATE' THEN OLD.created_by ELSE auth.uid() END;

  IF NEW.created_by IS DISTINCT FROM v_fallback
     AND NOT EXISTS (
       SELECT 1 FROM rehab_plan_days d
       WHERE d.plan_id = NEW.plan_id AND d.created_by = NEW.created_by
     ) THEN
    NEW.created_by := v_fallback;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rehab_plan_day_audit ON rehab_plan_days;
CREATE TRIGGER trg_set_rehab_plan_day_audit
  BEFORE INSERT OR UPDATE ON rehab_plan_days
  FOR EACH ROW EXECUTE FUNCTION set_rehab_plan_day_audit();
