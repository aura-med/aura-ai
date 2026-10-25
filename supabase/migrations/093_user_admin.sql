-- Migration 093 — User administration (Settings → Users / Squads).
--
--   1. profiles.active / deactivated_at — "Remove user" is a soft delete: the
--      profile stays (history, audit trail), the app treats it as signed out
--      and the auth user is banned (see lib/actions/users.ts setUserActive).
--   2. squads_update — doctors can edit the squads they are assigned to
--      (owner: any squad in the org). `type` is never edited by the app.
--   3. Self-escalation fix — profiles_update (001) lets any user update their
--      OWN row, including role/org_id. A trigger now only lets an owner of the
--      org (or the service role / SQL editor) change role, org_id or active.
--   4. Last-owner guard (024) also protects against deactivating the last
--      ACTIVE owner.
--
-- get_user_org_id()/get_user_role() are intentionally NOT changed: an inactive
-- user is blocked at the app layer + auth ban, not in every RLS policy.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- 2. squads_update ------------------------------------------------------------
DROP POLICY IF EXISTS "squads_update" ON squads;
CREATE POLICY "squads_update" ON squads FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() = 'doctor' AND id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() = 'doctor' AND id IN (SELECT get_user_squad_ids()))
    )
  );

-- 3. Block self-escalation ----------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / SQL editor / internal triggers have no end-user identity.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    IF NOT (get_user_role() = 'owner' AND get_user_org_id() = OLD.org_id) THEN
      RAISE EXCEPTION 'Only an organization owner can change role, organization or status'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- 4. Last-owner guard also covers deactivation --------------------------------
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
  IF OLD.role IS DISTINCT FROM 'owner' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- An already-inactive owner doesn't count as an active owner, so removing
  -- or demoting them can't leave the org without one.
  IF OLD.active IS NOT TRUE THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'owner' AND NEW.active IS TRUE THEN
    RETURN NEW; -- still an active owner, nothing to check
  END IF;

  v_org_id := OLD.org_id;

  -- Serialize concurrent owner removals within the same org (see 024).
  PERFORM 1 FROM organizations WHERE id = v_org_id FOR UPDATE;

  SELECT count(*) INTO v_owner_count
  FROM profiles
  WHERE org_id = v_org_id
    AND role = 'owner'
    AND active
    AND id <> OLD.id;

  IF v_owner_count = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last owner of an organization'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
