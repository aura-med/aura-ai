-- ─────────────────────────────────────────────────────────────────────────────
-- 018_squad_scoped_access.sql
-- Adds squad-level access scoping on top of 017's admin->owner rename.
--
-- New primitives:
--   - staff_squads: many-to-many staff<->squad assignment (owner-managed)
--   - get_user_squad_ids(): mirrors get_user_org_id()/get_user_role()
--   - athletes.user_id: real self-link for the athlete role (RLS only —
--     invite/claim UI is intentionally out of scope for this pass)
--
-- Every non-owner, non-athlete role (doctor, physio, masseur, coach,
-- fitness_coach, nutritionist, director, scout, team_manager) is scoped to
-- only the squad(s) it is assigned to via staff_squads. owner is unrestricted
-- (sees/manages every squad in its org). athlete sees only its own row.
--
-- Backfill: every existing non-owner/non-athlete profile is assigned to every
-- squad in its org, so nobody is silently locked out the moment this runs —
-- the owner curates real assignments afterward.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. staff_squads ───────────────────────────────────────────────────────────

CREATE TABLE staff_squads (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  squad_id   UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, squad_id)
);

CREATE INDEX idx_staff_squads_profile ON staff_squads(profile_id);
CREATE INDEX idx_staff_squads_squad   ON staff_squads(squad_id);

ALTER TABLE staff_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_squads_owner_manage ON staff_squads FOR ALL
  USING (
    get_user_role() = 'owner'
    AND squad_id IN (SELECT id FROM squads WHERE org_id = get_user_org_id())
  )
  WITH CHECK (
    get_user_role() = 'owner'
    AND squad_id IN (SELECT id FROM squads WHERE org_id = get_user_org_id())
  );

CREATE POLICY staff_squads_self_read ON staff_squads FOR SELECT
  USING (profile_id = auth.uid());

-- ─── 2. get_user_squad_ids() helper (same style as get_user_org_id()/get_user_role()) ──

CREATE OR REPLACE FUNCTION get_user_squad_ids()
RETURNS SETOF UUID AS $$
  SELECT squad_id FROM staff_squads WHERE profile_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── 3. athletes.user_id — real self-link for the athlete role ────────────────

ALTER TABLE athletes ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX idx_athletes_user_id ON athletes(user_id) WHERE user_id IS NOT NULL;

-- ─── 4. Backfill: every existing non-owner/non-athlete profile keeps access to
--        every squad in its org until the owner curates real assignments ──────

INSERT INTO staff_squads (profile_id, squad_id)
SELECT p.id, s.id FROM profiles p
JOIN squads s ON s.org_id = p.org_id
WHERE p.role NOT IN ('owner', 'athlete')
ON CONFLICT DO NOTHING;

-- ─── 5. Drop role-unrestricted, org-only SELECT policies that would otherwise
--        defeat squad scoping below (introduced by 004_m2_server_first_rls.sql —
--        these grant every org member, any role, full read on these three
--        tables; the org-only, no-role-check bug is fixed here because it
--        directly undermines the scoping this migration adds. squads/
--        organizations/fatigue_profiles/athlete_passport member_select_m2
--        policies are left as-is — out of scope for this change). ────────────

DROP POLICY IF EXISTS gps_sessions_member_select_m2 ON gps_sessions;
DROP POLICY IF EXISTS injury_events_member_select_m2 ON injury_events;
DROP POLICY IF EXISTS performance_data_member_select_m2 ON performance_data;

-- ─── 6. athletes ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS athletes_select ON athletes;
CREATE POLICY athletes_select ON athletes FOR SELECT
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      -- Gate the squad branch to non-athlete staff: a former staff member turned
      -- athlete may still have stale staff_squads rows, which must not grant them
      -- squad-wide access ahead of the self-only branch below.
      OR (get_user_role() <> 'athlete' AND squad_id IN (SELECT get_user_squad_ids()))
      OR (get_user_role() = 'athlete' AND user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS athletes_insert ON athletes;
CREATE POLICY athletes_insert ON athletes FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() IN ('doctor', 'physio') AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

DROP POLICY IF EXISTS athletes_update ON athletes;
CREATE POLICY athletes_update ON athletes FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() IN ('doctor', 'physio') AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() IN ('doctor', 'physio') AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ─── 7. score_history ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS score_history_clinical ON score_history;
CREATE POLICY score_history_clinical ON score_history FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS score_history_athlete ON score_history;
CREATE POLICY score_history_athlete ON score_history FOR SELECT
  USING (
    get_user_role() = 'athlete'
    AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS score_history_clinical_insert ON score_history;
CREATE POLICY score_history_clinical_insert ON score_history FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS score_history_clinical_update ON score_history;
CREATE POLICY score_history_clinical_update ON score_history FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 8. wellness_checkins ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS wellness_insert ON wellness_checkins;
CREATE POLICY wellness_insert ON wellness_checkins FOR INSERT
  WITH CHECK (
    -- Athlete self-service check-in: linked athletes write their own row via the
    -- self-link, independent of staff_squads (which they don't have rows in).
    (get_user_role() = 'athlete' AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
    OR (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    -- Staff-squad branch gated to non-athletes so a downgraded ex-staff athlete
    -- with stale staff_squads rows can't insert for those squads.
    OR (
      get_user_role() <> 'athlete'
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS wellness_select_clinical ON wellness_checkins;
CREATE POLICY wellness_select_clinical ON wellness_checkins FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- Athletes read their own self-reported check-ins (self-service readiness view),
-- mirroring score_history_athlete / injury_events_athlete.
DROP POLICY IF EXISTS wellness_select_athlete ON wellness_checkins;
CREATE POLICY wellness_select_athlete ON wellness_checkins FOR SELECT
  USING (
    get_user_role() = 'athlete'
    AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS wellness_update ON wellness_checkins;
CREATE POLICY wellness_update ON wellness_checkins FOR UPDATE
  USING (
    -- Athlete self-service: upsertWellnessCheckin() upserts, so re-submitting the
    -- day's check-in resolves to an UPDATE — athletes need it on their own row.
    (get_user_role() = 'athlete' AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid()))
    OR (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 9. rehab_sessions ─────────────────────────────────────────────────────────

-- 008_treatments.sql created wide-open rehab_sessions policies (auth.role() =
-- 'authenticated') for every command. Postgres ORs permissive policies, so the
-- scoped replacements below are ineffective until these are dropped — otherwise
-- any authenticated user still reads/writes/deletes rehab sessions across squads
-- and tenants.
DROP POLICY IF EXISTS "auth_read_rehab_sessions" ON rehab_sessions;
DROP POLICY IF EXISTS "auth_insert_rehab_sessions" ON rehab_sessions;
DROP POLICY IF EXISTS "auth_update_rehab_sessions" ON rehab_sessions;
DROP POLICY IF EXISTS "auth_delete_rehab_sessions" ON rehab_sessions;
-- 002_medical_portal.sql's rehab_clinical_insert is never dropped and only
-- checks the role (doctor/physio), not org/squad — so it lets a clinician
-- insert a rehab_sessions row for any athlete UUID in any tenant. Drop it too.
DROP POLICY IF EXISTS "rehab_clinical_insert" ON rehab_sessions;

DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;
CREATE POLICY rehab_clinical_write ON rehab_sessions FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS rehab_others_read ON rehab_sessions;
CREATE POLICY rehab_others_read ON rehab_sessions FOR SELECT
  USING (
    get_user_role() IN ('coach', 'fitness_coach')
    AND athlete_id IN (
      SELECT id FROM athletes
      WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
    )
  );

-- ─── 10. injury_events ─────────────────────────────────────────────────────────
-- injury_clinical_insert/update (002) never checked org/athlete scope at all —
-- only role. Fixing that here since it's the same policy this migration must
-- touch anyway, and squad-scoped clinical access is meaningless without it.

DROP POLICY IF EXISTS "injury_clinical_insert" ON injury_events;
CREATE POLICY "injury_clinical_insert" ON injury_events FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS "injury_clinical_update" ON injury_events;
CREATE POLICY "injury_clinical_update" ON injury_events FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS "injury_clinical_select" ON injury_events;
CREATE POLICY "injury_clinical_select" ON injury_events FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS injury_events_clinical ON injury_events;
CREATE POLICY injury_events_clinical ON injury_events FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS injury_events_athlete ON injury_events;
CREATE POLICY injury_events_athlete ON injury_events FOR SELECT
  USING (
    get_user_role() = 'athlete'
    AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS injury_events_write ON injury_events;
CREATE POLICY injury_events_write ON injury_events FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 11. performance_data ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS performance_data_select ON performance_data;
CREATE POLICY performance_data_select ON performance_data FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS performance_data_write ON performance_data;
CREATE POLICY performance_data_write ON performance_data FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 12. gps_sessions ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS gps_sessions_select ON gps_sessions;
CREATE POLICY gps_sessions_select ON gps_sessions FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

DROP POLICY IF EXISTS gps_sessions_write ON gps_sessions;
CREATE POLICY gps_sessions_write ON gps_sessions FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() = 'fitness_coach'
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 13. calendar_events (squad_id is direct on this table) ───────────────────

-- The 001 calendar_read let any org member read every squad's events, which
-- defeats squad scoping. Replace it: owner sees the whole org, staff see their
-- assigned squads, and an athlete sees their own squad's calendar.
DROP POLICY IF EXISTS calendar_read ON calendar_events;
CREATE POLICY calendar_read ON calendar_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      -- Staff-squad branch is gated to non-athletes so a former staff user
      -- downgraded to 'athlete' with stale staff_squads rows can't read those
      -- squads' calendars — athletes only reach the self-linked branch below.
      OR (get_user_role() <> 'athlete' AND squad_id IN (SELECT get_user_squad_ids()))
      OR (get_user_role() = 'athlete' AND squad_id IN (SELECT squad_id FROM athletes WHERE user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS calendar_write ON calendar_events;
CREATE POLICY calendar_write ON calendar_events FOR ALL
  USING (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() = 'coach' AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (get_user_role() = 'coach' AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ─── 14. athlete_passport ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS athlete_passport_clinical_update_m2 ON athlete_passport;
CREATE POLICY athlete_passport_clinical_update_m2 ON athlete_passport FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

-- ─── 15. PR #78 clinical module tables ─────────────────────────────────────────
-- occurrences has its own squad_id column, but it's a nullable, denormalized
-- copy — scope through the authoritative athletes.squad_id instead, same as
-- every other table here, rather than trusting a client-supplied value.

DROP POLICY IF EXISTS "clinical_write_occurrences" ON occurrences;
CREATE POLICY "clinical_write_occurrences" ON occurrences
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    -- Owner included: the referenced athlete must belong to the caller's org, so
    -- a direct-API owner can't attach an occurrence to a foreign-org athlete.
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "clinical_update_occurrences" ON occurrences;
CREATE POLICY "clinical_update_occurrences" ON occurrences
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = athlete_id AND a.org_id = get_user_org_id() AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "org_read_occurrences" ON occurrences;
CREATE POLICY "org_read_occurrences" ON occurrences
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = athlete_id AND a.org_id = get_user_org_id() AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "clinical_write_occurrence_records" ON occurrence_records;
CREATE POLICY "clinical_write_occurrence_records" ON occurrence_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM occurrences o
      WHERE o.id = occurrence_id AND o.org_id = get_user_org_id() AND o.athlete_id = occurrence_records.athlete_id
    )
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = occurrence_records.athlete_id AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "org_read_occurrence_records" ON occurrence_records;
CREATE POLICY "org_read_occurrence_records" ON occurrence_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM occurrences o WHERE o.id = occurrence_id AND o.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (
          SELECT 1 FROM athletes a
          WHERE a.id = occurrence_records.athlete_id AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "doctor_write_diagnoses" ON diagnoses;
CREATE POLICY "doctor_write_diagnoses" ON diagnoses
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id AND o.org_id = get_user_org_id() AND o.athlete_id = diagnoses.athlete_id
      )
    )
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() = 'doctor'
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "doctor_update_diagnoses" ON diagnoses;
CREATE POLICY "doctor_update_diagnoses" ON diagnoses
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() = 'doctor'
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id AND o.org_id = get_user_org_id() AND o.athlete_id = diagnoses.athlete_id
      )
    )
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() = 'doctor'
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "org_read_diagnoses" ON diagnoses;
CREATE POLICY "org_read_diagnoses" ON diagnoses
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "clinical_write_med_admin" ON medication_administrations;
CREATE POLICY "clinical_write_med_admin" ON medication_administrations
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "org_read_med_admin" ON medication_administrations;
CREATE POLICY "org_read_med_admin" ON medication_administrations
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "clinical_write_orthosis" ON orthosis_records;
CREATE POLICY "clinical_write_orthosis" ON orthosis_records
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "clinical_update_orthosis" ON orthosis_records;
CREATE POLICY "clinical_update_orthosis" ON orthosis_records
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

DROP POLICY IF EXISTS "org_read_orthosis" ON orthosis_records;
CREATE POLICY "org_read_orthosis" ON orthosis_records
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'masseur')
        AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.squad_id IN (SELECT get_user_squad_ids()))
      )
    )
  );

-- ─── 16. update_athlete_availability() RPC — add squad scope ──────────────────

CREATE OR REPLACE FUNCTION update_athlete_availability(
  p_athlete_id uuid,
  p_status      text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('owner', 'doctor', 'physio', 'masseur') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE athletes
  SET availability_status = p_status
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR squad_id IN (SELECT get_user_squad_ids()));
END;
$$;
