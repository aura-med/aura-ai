-- Migration 059 — Revert 057's occurrence-own-edit timing check.
--
-- 057 compared the occurrence's own updated_at against the claimed source's
-- timestamp using a 5-second tolerance to detect "a direct edit happened
-- after this mirror". But addOccurrenceRecord's legitimate mirror is two
-- separate statements (insert the occurrence_record, then update the
-- parent occurrence) — under real API/database latency they can land more
-- than 5 seconds apart, so this check could reject a perfectly legitimate
-- reassessment mirror. Worse, the application doesn't check that update's
-- error (a pre-existing gap, unrelated to this migration), so the
-- reassessment would still be saved while the occurrence/athlete silently
-- keep their old status and the UI reports success.
--
-- Unlike 055's diagnosis-vs-reassessment comparison (both independent,
-- already-committed rows from separate historical actions — no timing
-- ambiguity), the occurrence's own updated_at is being set IN THE SAME
-- statement being validated, making any latency-based tolerance inherently
-- unreliable. Properly distinguishing a trusted mirror call from an
-- external one needs an explicit signal (e.g. a SECURITY DEFINER RPC) that
-- the caller's identity/session already provides — a larger change than a
-- timestamp comparison can safely deliver. Revert to 055's narrower checks
-- (still real improvements over 054) rather than risk silently corrupting
-- live reassessment writes.

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
