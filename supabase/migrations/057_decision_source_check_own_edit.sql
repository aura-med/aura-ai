-- Migration 057 — Also compare decision_source claims against the
-- occurrence's own updated_at (a direct edit via updateOccurrence).
--
-- 055 compared the diagnosis and reassessment timestamps against each
-- other, but never against the occurrence's OWN updated_at — so a caller
-- could set decision_source = 'reassessment' (or 'diagnosis') even when a
-- direct occurrence edit happened afterward and is actually the athlete's
-- current decision (updateOccurrence sets decision_source = 'own' in that
-- case, but nothing stopped a separate Data API call from overriding it
-- back to 'reassessment'/'diagnosis' without also touching updated_at to
-- match). Reject the claim if the occurrence's own timestamp meaningfully
-- leads the claimed source's — mirroring the tolerance used elsewhere for
-- telling a mirror write's own near-simultaneous timestamp apart from a
-- genuinely later, independent edit.

CREATE OR REPLACE FUNCTION validate_occurrence_decision_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag_at timestamptz;
  v_rec_at timestamptz;
  v_own_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.decision_source IS NOT DISTINCT FROM OLD.decision_source THEN
    RETURN NEW;
  END IF;

  v_own_at := COALESCE(NEW.updated_at, NEW.created_at);

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
    IF v_own_at - v_diag_at > interval '5 seconds' THEN
      RAISE EXCEPTION 'decision_source cannot be diagnosis when the occurrence was edited directly afterward'
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
    IF v_own_at - v_rec_at > interval '5 seconds' THEN
      RAISE EXCEPTION 'decision_source cannot be reassessment when the occurrence was edited directly afterward'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
