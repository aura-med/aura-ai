-- Migration 043 — Freeze occurrence_records.athlete_id/occurrence_id on update.
--
-- 042's UPDATE policy checks USING (old row) and WITH CHECK (new row)
-- independently: each just requires occurrence_id/athlete_id to be a
-- consistent, permitted pair, with nothing tying the new pair back to the
-- old one. A Data API call can therefore change both columns together to a
-- different, still-valid combination — reassigning a historical
-- reassessment to another athlete's occurrence, satisfying both checks.
-- RLS can't express "old.athlete_id = new.athlete_id" (USING only sees the
-- old row, WITH CHECK only the new one), so freeze both relationship
-- columns with a BEFORE UPDATE trigger instead, mirroring 023's pattern.

CREATE OR REPLACE FUNCTION freeze_occurrence_record_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
     OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id THEN
    RAISE EXCEPTION 'Cannot reassign an occurrence_record to a different athlete or occurrence'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_occurrence_record_relationship ON occurrence_records;
CREATE TRIGGER trg_freeze_occurrence_record_relationship
  BEFORE UPDATE ON occurrence_records
  FOR EACH ROW EXECUTE FUNCTION freeze_occurrence_record_relationship();
