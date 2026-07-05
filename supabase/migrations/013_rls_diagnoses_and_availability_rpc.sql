-- Migration 013 — Restrict diagnoses reads to clinical roles + constrained availability RPC

-- 1. Restrict diagnosis reads to clinical roles only.
--    The org-wide SELECT allowed coaches/athletes to read diagnosis codes and
--    descriptions directly (same gap fixed for occurrences in 011).
DROP POLICY IF EXISTS "org_read_diagnoses" ON diagnoses;

CREATE POLICY "org_read_diagnoses" ON diagnoses
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

-- 2. Constrained availability update via SECURITY DEFINER RPC.
--    The athletes_update policy granted masseurs UPDATE on the entire athlete row.
--    Replace it with a targeted RPC that only writes availability_status, and
--    restrict direct table updates to admin/doctor/physio only.

CREATE OR REPLACE FUNCTION update_athlete_availability(
  p_athlete_id uuid,
  p_status      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('admin', 'doctor', 'physio', 'masseur') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE athletes
  SET availability_status = p_status
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id();
END;
$$;

GRANT EXECUTE ON FUNCTION update_athlete_availability(uuid, text) TO authenticated;

-- Remove masseur from direct athletes_update policy now that the RPC covers their path.
DROP POLICY IF EXISTS athletes_update ON athletes;

CREATE POLICY athletes_update ON athletes FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (
    -- Keep the row in the caller's org: without this an admin/doctor/physio could
    -- set org_id to another tenant and move the athlete out of their org.
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio')
  );
