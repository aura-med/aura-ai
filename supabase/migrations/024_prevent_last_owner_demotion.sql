-- Migration 024 — Never let an organization lose its last owner.
--
-- Role changes run through the public Supabase API with the user's session
-- (settings/users), so a UI guard alone can be bypassed by a direct API call.
-- Demoting (or deleting) the only owner leaves nobody able to manage roles or
-- squad assignments — the tenant is locked out of administration. Enforce the
-- invariant in the database: block any UPDATE/DELETE that would remove the last
-- owner of an org.

CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_owner_count integer;
BEGIN
  -- Only relevant when an existing owner stops being an owner (role change on
  -- UPDATE, or the row being deleted entirely).
  IF OLD.role IS DISTINCT FROM 'owner' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' THEN
    RETURN NEW; -- still an owner, nothing to check
  END IF;

  v_org_id := OLD.org_id;

  -- Count the remaining owners in the org excluding this row.
  SELECT count(*) INTO v_owner_count
  FROM profiles
  WHERE org_id = v_org_id
    AND role = 'owner'
    AND id <> OLD.id;

  IF v_owner_count = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last owner of an organization'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_update ON profiles;
CREATE TRIGGER trg_prevent_last_owner_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();

DROP TRIGGER IF EXISTS trg_prevent_last_owner_delete ON profiles;
CREATE TRIGGER trg_prevent_last_owner_delete
  BEFORE DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();
