-- Migration 055 — Reject decision_source claims a newer source has superseded.
--
-- 054 only checked that SOME occurrence_record/open diagnosis exists for the
-- occurrence, not that the claimed source is actually the more recent of the
-- two — a caller could set decision_source = 'reassessment' on an occurrence
-- whose only reassessment is years old while a diagnosis has since taken
-- over (or vice versa), and updateOccurrenceRecord's resync guard would
-- trust it. Extend the check to also compare timestamps between the two
-- candidate sources, mirroring the same "later wins" comparison the
-- application uses elsewhere (diagnoses.updated_at ?? diagnosed_at vs.
-- occurrence_records.created_at).

CREATE OR REPLACE FUNCTION validate_occurrence_decision_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag_at timestamptz;
  v_rec_at timestamptz;
BEGIN
  -- Only validate when decision_source is actually being set/changed — an
  -- unrelated update (e.g. resolveOccurrence, which never touches this
  -- column) must not be rejected just because its EXISTING, previously-valid
  -- value no longer matches (e.g. the linked diagnosis was independently
  -- resolved afterward).
  IF TG_OP = 'UPDATE' AND NEW.decision_source IS NOT DISTINCT FROM OLD.decision_source THEN
    RETURN NEW;
  END IF;

  SELECT MAX(COALESCE(updated_at, diagnosed_at)) INTO v_diag_at
  FROM diagnoses WHERE occurrence_id = NEW.id AND is_resolved = false;

  SELECT MAX(created_at) INTO v_rec_at
  FROM occurrence_records WHERE occurrence_id = NEW.id;

  IF NEW.decision_source = 'diagnosis' THEN
    IF v_diag_at IS NULL THEN
      RAISE EXCEPTION 'decision_source cannot be diagnosis without a linked open diagnosis'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_rec_at IS NOT NULL AND v_rec_at > v_diag_at THEN
      RAISE EXCEPTION 'decision_source cannot be diagnosis when a later reassessment exists'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.decision_source = 'reassessment' THEN
    IF v_rec_at IS NULL THEN
      RAISE EXCEPTION 'decision_source cannot be reassessment without any occurrence_records'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_diag_at IS NOT NULL AND v_diag_at > v_rec_at THEN
      RAISE EXCEPTION 'decision_source cannot be reassessment when a later diagnosis exists'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
