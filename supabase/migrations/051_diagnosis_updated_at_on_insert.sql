-- Migration 051 — Also derive diagnoses.updated_at on INSERT.
--
-- 047's trigger only ran BEFORE UPDATE. The column's DEFAULT now() (046)
-- covers a normal insert that doesn't specify updated_at, but a Data API
-- caller inserting a diagnosis directly can supply an explicit value,
-- overriding the default — the same forgeable-timestamp gap 047 closed for
-- updates, just on the insert path. Extend the trigger to INSERT too: there
-- is no OLD row to compare against, so a fresh diagnosis's updated_at is
-- simply always "now" server-side, ignoring anything the caller sent.

CREATE OR REPLACE FUNCTION derive_diagnosis_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := now();
  ELSIF NEW.availability_status IS DISTINCT FROM OLD.availability_status
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
  BEFORE INSERT OR UPDATE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION derive_diagnosis_updated_at();
