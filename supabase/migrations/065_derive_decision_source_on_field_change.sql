-- Migration 065 — Derive decision_source whenever decision fields change,
-- not just when decision_source itself changes.
--
-- 059's trigger skipped all validation whenever
-- `NEW.decision_source IS NOT DISTINCT FROM OLD.decision_source` — meant to
-- avoid rejecting an unrelated update (e.g. resolveOccurrence) that never
-- touches decision_source at all. But a partial UPDATE through the Data API
-- that changes availability_status/load_management_restrictions/
-- load_management_notes WITHOUT also sending decision_source leaves
-- decision_source at its OLD value too (an unspecified column keeps its
-- prior value) — indistinguishable, from inside a trigger, from the app's
-- own mirror functions re-sending the same source value on purpose. That
-- early return let such a write through unchecked: an occurrence sitting at
-- decision_source = 'reassessment' could have its fields changed directly,
-- and a later correction to the (unrelated) latest reassessment via
-- resync_occurrence_from_latest_reassessment (063) would still pass its
-- `decision_source = 'reassessment'` guard and overwrite that newer direct
-- decision.
--
-- Postgres genuinely cannot tell "explicitly resent the same value" from
-- "never touched" — so validate by content instead: only skip when NEITHER
-- decision_source NOR any decision-driving field changed. When decision
-- fields change, compare the occurrence's new values against the latest
-- diagnosis/reassessment's own recorded values (mirrors always copy them
-- verbatim). A mismatch means this write didn't genuinely come from that
-- source — reset decision_source to 'own' rather than reject the write
-- outright, matching how updateOccurrence attributes any direct decision
-- change today.

CREATE OR REPLACE FUNCTION validate_occurrence_decision_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diag record;
  v_rec record;
  decision_fields_changed boolean;
BEGIN
  decision_fields_changed :=
    TG_OP = 'INSERT'
    OR NEW.availability_status IS DISTINCT FROM OLD.availability_status
    OR NEW.load_management_restrictions IS DISTINCT FROM OLD.load_management_restrictions
    OR NEW.load_management_notes IS DISTINCT FROM OLD.load_management_notes;

  IF TG_OP = 'UPDATE'
     AND NOT decision_fields_changed
     AND NEW.decision_source IS NOT DISTINCT FROM OLD.decision_source THEN
    RETURN NEW;
  END IF;

  SELECT availability_status, load_management_restrictions, load_management_notes,
         COALESCE(updated_at, diagnosed_at) AS at
  INTO v_diag
  FROM diagnoses
  WHERE occurrence_id = NEW.id AND is_resolved = false
  ORDER BY COALESCE(updated_at, diagnosed_at) DESC
  LIMIT 1;

  SELECT availability_status, load_management_restrictions, load_management_notes,
         created_at AS at
  INTO v_rec
  FROM occurrence_records
  WHERE occurrence_id = NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NEW.decision_source = 'diagnosis' THEN
    IF v_diag.at IS NULL THEN
      RAISE EXCEPTION 'decision_source cannot be diagnosis without a linked open diagnosis'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_rec.at IS NOT NULL AND v_rec.at > v_diag.at THEN
      RAISE EXCEPTION 'decision_source cannot be diagnosis when a later reassessment exists'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.decision_source = 'reassessment' THEN
    IF v_rec.at IS NULL THEN
      RAISE EXCEPTION 'decision_source cannot be reassessment without any occurrence_records'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_diag.at IS NOT NULL AND v_diag.at > v_rec.at THEN
      RAISE EXCEPTION 'decision_source cannot be reassessment when a later diagnosis exists'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF decision_fields_changed THEN
    IF NEW.decision_source = 'diagnosis' AND (
      v_diag.availability_status IS DISTINCT FROM NEW.availability_status OR
      v_diag.load_management_restrictions IS DISTINCT FROM NEW.load_management_restrictions OR
      v_diag.load_management_notes IS DISTINCT FROM NEW.load_management_notes
    ) THEN
      NEW.decision_source := 'own';
    ELSIF NEW.decision_source = 'reassessment' AND (
      v_rec.availability_status IS DISTINCT FROM NEW.availability_status OR
      v_rec.load_management_restrictions IS DISTINCT FROM NEW.load_management_restrictions OR
      v_rec.load_management_notes IS DISTINCT FROM NEW.load_management_notes
    ) THEN
      NEW.decision_source := 'own';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
