-- Migration 054 — Reject implausible occurrences.decision_source values.
--
-- 048 added the column but nothing stops a doctor/physio/owner writing
-- occurrences directly through the Data API from setting it to a value that
-- doesn't match reality (e.g. 'reassessment' with no occurrence_records at
-- all) — updateOccurrenceRecord's resync guard trusts this column, so a
-- wrong value could make a stale correction overwrite the athlete's live
-- status. decision_source can't be fully derived at the database level (it
-- records WHICH code path called, not something inferable purely from row
-- data — createDiagnosis/updateDiagnosis and addOccurrenceRecord's mirrors
-- write the identical set of columns), but implausible values — claiming a
-- source that doesn't exist for this occurrence at all — can be rejected.

CREATE OR REPLACE FUNCTION validate_occurrence_decision_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate when decision_source is actually being set/changed — an
  -- unrelated update (e.g. resolveOccurrence, which never touches this
  -- column) must not be rejected just because its EXISTING, previously-valid
  -- value no longer matches (e.g. the linked diagnosis was independently
  -- resolved afterward).
  IF TG_OP = 'UPDATE' AND NEW.decision_source IS NOT DISTINCT FROM OLD.decision_source THEN
    RETURN NEW;
  END IF;

  IF NEW.decision_source = 'diagnosis' AND NOT EXISTS (
    SELECT 1 FROM diagnoses WHERE occurrence_id = NEW.id AND is_resolved = false
  ) THEN
    RAISE EXCEPTION 'decision_source cannot be diagnosis without a linked open diagnosis'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.decision_source = 'reassessment' AND NOT EXISTS (
    SELECT 1 FROM occurrence_records WHERE occurrence_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'decision_source cannot be reassessment without any occurrence_records'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_occurrence_decision_source ON occurrences;
CREATE TRIGGER trg_validate_occurrence_decision_source
  BEFORE INSERT OR UPDATE ON occurrences
  FOR EACH ROW EXECUTE FUNCTION validate_occurrence_decision_source();
