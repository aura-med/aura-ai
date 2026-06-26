-- Migration 010 — RLS fixes and role constraint widening
-- Addresses Codex review findings on PR #78.

-- 1. Widen profiles.role CHECK to include all roles introduced in types/index.ts
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'admin', 'doctor', 'physio', 'masseur',
    'coach', 'fitness_coach',
    'nutritionist', 'director', 'scout', 'team_manager',
    'athlete'
  ));

-- 2. Allow admins to update profiles of users in their own org.
--    The existing profiles_update policy only allows self-update (id = auth.uid()).
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE
  USING (
    get_user_role() = 'admin'
    AND org_id = get_user_org_id()
  );

-- 3. Allow masseurs to update athletes.availability_status.
--    The existing athletes_update policy only allows admin/doctor/physio.
--    Masseurs can register occurrences (009 RLS) so they must also be able
--    to reflect the resulting availability change on the athlete row.
DROP POLICY IF EXISTS athletes_update ON athletes;

CREATE POLICY athletes_update ON athletes FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (get_user_role() IN ('admin', 'doctor', 'physio', 'masseur'));

-- 4. Scope occurrence_records INSERT to the occurrence's org.
--    The existing clinical_write_occurrence_records policy only checks role,
--    not whether the referenced occurrence belongs to the user's org, which
--    breaks tenant isolation in multi-org deployments.
DROP POLICY IF EXISTS "clinical_write_occurrence_records" ON occurrence_records;

CREATE POLICY "clinical_write_occurrence_records" ON occurrence_records
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM occurrences o
      WHERE o.id = occurrence_id
        AND o.org_id = get_user_org_id()
    )
  );
