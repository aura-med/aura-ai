-- Migration 066 — Compare load_management_restrictions as a set, not an
-- ordered array, when deriving diagnoses.updated_at.
--
-- 051's trigger (already applied, so corrected here rather than in place)
-- used `NEW.load_management_restrictions IS DISTINCT FROM OLD...`, which in
-- Postgres is order-sensitive for arrays. LoadManagementFields appends a
-- re-checked restriction at the end of the array rather than restoring its
-- original position, so unchecking and rechecking the same restriction
-- reorders the array without changing its contents. updateDiagnosis
-- (lib/actions/clinical.ts) already treats this as no decision change via
-- sameStringSet (order-independent), but the trigger doesn't know about
-- that app-level result — it re-derives changed-or-not itself from NEW/OLD,
-- and its own ordered-array comparison disagreed, advancing updated_at for
-- a save that changed nothing. recomputeAvailability ranks open diagnoses
-- by this timestamp, so this could make an untouched diagnosis outrank a
-- genuinely newer one and persist its stale status.
--
-- Compare both arrays sorted instead, matching sameStringSet's set
-- semantics.

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
     OR ARRAY(SELECT unnest(NEW.load_management_restrictions) ORDER BY 1)
        IS DISTINCT FROM ARRAY(SELECT unnest(OLD.load_management_restrictions) ORDER BY 1)
     OR NEW.load_management_notes IS DISTINCT FROM OLD.load_management_notes THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;
