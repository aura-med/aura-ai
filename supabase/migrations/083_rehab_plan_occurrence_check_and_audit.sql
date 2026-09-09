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
--    content). An earlier version of this migration tried to allow that by
--    accepting any caller-supplied created_by that already appeared
--    elsewhere on the same plan — but that's not proof of a real move, only
--    proof someone else has ever authored a day here: any user with write
--    access to a shared plan could see a co-author's created_by on another
--    row and submit it on an unrelated insert/update, forging attribution
--    to that co-author. A same-plan "provenance" check can't distinguish a
--    genuine move from that forgery — only a trusted, transactional path
--    that has actually verified the source row can. move_rehab_plan_day()
--    below is that path: it locks and reads the real source row itself,
--    then sets a transaction-local flag (app.trusted_rehab_plan_day_move,
--    same technique as 067/071's app.trusted_diagnosis_edit) that the
--    trigger checks before letting created_by through unchanged; a raw
--    Data API caller has no way to set it, so created_by is otherwise
--    always frozen on UPDATE and always derived from auth.uid() on INSERT.
--    updated_by has no such nuance (the app always sets it to the current
--    user) and is simply always auth.uid(), trusted path or not.
--
-- 034 is already applied to production — an authorized caller could
-- already have linked a plan to another athlete's occurrence before this
-- migration's trigger existed to stop it. Null out any such existing
-- mismatch first, same "clean before constraining" shape as 072/076/079's
-- own backfills.

UPDATE rehab_plans p
SET occurrence_id = NULL
WHERE p.occurrence_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM occurrences o
    WHERE o.id = p.occurrence_id AND o.athlete_id = p.athlete_id
  );

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

-- rehab_plan_days: updated_by is always the caller. created_by is always
-- derived from auth.uid() on INSERT and always frozen from OLD on UPDATE —
-- UNLESS the transaction-local trusted flag is set, in which case the
-- caller-supplied value (verified by move_rehab_plan_day() below, not
-- trusted blindly) passes through untouched.
CREATE OR REPLACE FUNCTION set_rehab_plan_day_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();

  IF current_setting('app.trusted_rehab_plan_day_move', true) IS DISTINCT FROM 'true' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := auth.uid();
    ELSE
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_rehab_plan_day_audit ON rehab_plan_days;
CREATE TRIGGER trg_set_rehab_plan_day_audit
  BEFORE INSERT OR UPDATE ON rehab_plan_days
  FOR EACH ROW EXECUTE FUNCTION set_rehab_plan_day_audit();

-- Atomic day-move RPC — the only trusted path allowed to carry a day's
-- original created_by forward onto its new date/period (see header). Also
-- closes two races the app's previous multi-call version documented but
-- couldn't close without a transaction: a partial failure between writing
-- the destination and deleting the source could duplicate content across
-- both cells, and two concurrent no-overwrite moves onto the same empty
-- destination could both pass a read-only occupancy check before either
-- committed. Locking the source AND destination rows up front serializes
-- both away — whichever call acquires the locks first fully completes
-- (write + delete) before the other proceeds and re-observes the
-- now-current state.
CREATE OR REPLACE FUNCTION move_rehab_plan_day(
  p_plan_id uuid,
  p_from_date date,
  p_from_period text,
  p_to_date date,
  p_to_period text,
  p_overwrite boolean
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_athlete_id uuid;
  v_source rehab_plan_days;
  v_destination_id uuid;
BEGIN
  SELECT athlete_id INTO v_athlete_id FROM rehab_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_source
  FROM rehab_plan_days
  WHERE plan_id = p_plan_id AND entry_date = p_from_date AND period = p_from_period
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não há nada para mover nesse dia/período.' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_from_date = p_to_date AND p_from_period = p_to_period THEN
    RETURN NULL; -- no-op: moving onto itself — nothing to revalidate
  END IF;

  SELECT id INTO v_destination_id
  FROM rehab_plan_days
  WHERE plan_id = p_plan_id AND entry_date = p_to_date AND period = p_to_period
  FOR UPDATE;

  IF v_destination_id IS NOT NULL AND NOT p_overwrite THEN
    -- Same SQLSTATE the app already translates (via error.code === '23505')
    -- into REHAB_DAY_OCCUPIED_ERROR, so the client-side handling is unchanged.
    RAISE EXCEPTION 'REHAB_DAY_OCCUPIED' USING ERRCODE = 'unique_violation';
  END IF;

  PERFORM set_config('app.trusted_rehab_plan_day_move', 'true', true);

  IF v_destination_id IS NOT NULL THEN
    UPDATE rehab_plan_days
    SET content = v_source.content,
        is_rest_day = v_source.is_rest_day,
        phase_id = v_source.phase_id,
        created_by = v_source.created_by
    WHERE id = v_destination_id;
  ELSE
    INSERT INTO rehab_plan_days (plan_id, entry_date, period, content, is_rest_day, phase_id, created_by)
    VALUES (p_plan_id, p_to_date, p_to_period, v_source.content, v_source.is_rest_day, v_source.phase_id, v_source.created_by);
  END IF;

  DELETE FROM rehab_plan_days WHERE id = v_source.id;

  RETURN v_athlete_id;
END;
$$;
