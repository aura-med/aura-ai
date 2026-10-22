-- Migration 045 — Also freeze occurrence_records.created_by/clinician_name.
--
-- 044 froze created_at alongside the relationship columns, but the UPDATE
-- policy (042) still permits a full-row Data API update, so an in-scope
-- clinician could rewrite created_by/clinician_name on an existing
-- reassessment — reassigning another clinician's authorship to themselves
-- (or anyone else). Freeze those authorship columns too.

CREATE OR REPLACE FUNCTION freeze_occurrence_record_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
     OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.clinician_name IS DISTINCT FROM OLD.clinician_name THEN
    RAISE EXCEPTION 'Cannot change the athlete, occurrence, creation timestamp, or authorship of an occurrence_record'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
