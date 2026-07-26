-- Migration 023 — Enforce the open-occurrence invariant when adding records.
--
-- addOccurrenceRecord() (occurrences/actions.ts) verifies the parent occurrence
-- is still open with a read-only SELECT, then inserts an occurrence_records row.
-- Between that SELECT and the INSERT another clinician can resolve the
-- occurrence, and because the occurrence_records RLS never checked the parent's
-- state, the reassessment still persists against a now-resolved occurrence —
-- violating the action's open-only invariant.
--
-- Enforce it atomically in the database: a BEFORE INSERT trigger locks the
-- parent occurrence row (FOR UPDATE) and rejects the insert if it is resolved.
-- The row lock serialises against resolveOccurrence()'s UPDATE, so a concurrent
-- resolve either commits first (this insert then sees is_resolved = true and is
-- rejected) or waits until this insert commits (the record was legitimately
-- added while the occurrence was still open).

CREATE OR REPLACE FUNCTION enforce_occurrence_open_on_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resolved boolean;
BEGIN
  -- Lock the parent occurrence row so a concurrent resolve can't slip in
  -- between this check and the insert.
  SELECT is_resolved INTO v_resolved
  FROM occurrences
  WHERE id = NEW.occurrence_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Occurrence % does not exist', NEW.occurrence_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_resolved THEN
    RAISE EXCEPTION 'Cannot add a record to a resolved occurrence'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_occurrence_open_on_record ON occurrence_records;
CREATE TRIGGER trg_enforce_occurrence_open_on_record
  BEFORE INSERT ON occurrence_records
  FOR EACH ROW EXECUTE FUNCTION enforce_occurrence_open_on_record();
