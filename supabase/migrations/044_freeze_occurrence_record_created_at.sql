-- Migration 044 — Also freeze occurrence_records.created_at on update.
--
-- 043's trigger froze athlete_id/occurrence_id but left created_at open.
-- The UPDATE policy (042) allows a full-row Data API update for any in-scope
-- clinician, and updateOccurrenceRecord (occurrences/actions.ts) orders by
-- created_at to decide which reassessment is the most recently *created* one
-- for its occurrence — that record is treated as the one currently driving
-- the athlete's live status. Rewriting created_at through the Data API could
-- therefore make a different (wrong) reassessment appear to be the latest,
-- silently changing which one gets propagated as the current clinical
-- decision. Freeze it alongside the relationship columns.

CREATE OR REPLACE FUNCTION freeze_occurrence_record_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
     OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change the athlete, occurrence, or creation timestamp of an occurrence_record'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
