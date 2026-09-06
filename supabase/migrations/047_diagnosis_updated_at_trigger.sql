-- Migration 047 — Derive diagnoses.updated_at server-side instead of trusting
-- the caller.
--
-- 046 added the column and updateDiagnosis (lib/actions/clinical.ts) set it
-- explicitly on every save. Two problems with that:
--
-- 1. It bumped unconditionally, even for a pure description/typo correction
--    with no change to the actual clinical decision (availability_status/
--    restrictions/notes). recomputeAvailability ranks open diagnoses by this
--    timestamp, so re-saving an OLDER diagnosis's unrelated text could make
--    it outrank a genuinely newer decision elsewhere and persist stale
--    availability.
-- 2. Any caller allowed to update a diagnosis via the Data API (not just
--    this app's server action) could set updated_at to an arbitrary
--    (including far-future) value directly, since nothing constrained it.
--
-- A BEFORE UPDATE trigger fixes both: it always computes updated_at itself
-- (ignoring whatever the caller supplied), only advancing it when a
-- decision-driving column actually changed.

CREATE OR REPLACE FUNCTION derive_diagnosis_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status
     OR NEW.load_management_restrictions IS DISTINCT FROM OLD.load_management_restrictions
     OR NEW.load_management_notes IS DISTINCT FROM OLD.load_management_notes THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_diagnosis_updated_at ON diagnoses;
CREATE TRIGGER trg_derive_diagnosis_updated_at
  BEFORE UPDATE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION derive_diagnosis_updated_at();
