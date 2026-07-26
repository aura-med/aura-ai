-- ─────────────────────────────────────────────────────────────────────────────
-- 017_owner_role_rename.sql
-- Renames the org-level 'admin' role to 'owner' across profiles.role and every
-- RLS policy / function that checks it literally. Squad management (create/
-- update/delete) narrows from admin/doctor/physio down to owner-only.
--
-- NOTE: this 'owner' is unrelated to platform_admins.level = 'owner' (see
-- 004_platform_admin_control.sql) — that is a separate table gating the
-- standalone apps/admin console for Aura's own staff. Same word, different
-- concept; no code path connects them.
--
-- Squad scoping (staff_squads, get_user_squad_ids()) is added in the next
-- migration (018_squad_scoped_access.sql). This migration only performs the
-- admin -> owner rename, 1:1, so it can be verified independently.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Data migration + role constraint ──────────────────────────────────────
-- The constraint must be widened to accept 'owner' BEFORE the UPDATE below, or
-- Postgres rejects the UPDATE against the still-active old constraint (which
-- doesn't recognize 'owner' yet). Widen (keep 'admin' temporarily) -> migrate
-- data -> narrow (drop 'admin').

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'owner', 'admin', 'doctor', 'physio', 'masseur',
    'coach', 'fitness_coach',
    'nutritionist', 'director', 'scout', 'team_manager',
    'athlete'
  ));

UPDATE profiles SET role = 'owner' WHERE role = 'admin';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'owner', 'doctor', 'physio', 'masseur',
    'coach', 'fitness_coach',
    'nutritionist', 'director', 'scout', 'team_manager',
    'athlete'
  ));

-- ─── 2. profiles ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  -- Self-access always; owners see only their own org's profiles (the bare
  -- owner branch was true for every row, leaking all tenants' profiles).
  USING (
    id = auth.uid()
    OR (get_user_role() = 'owner' AND org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_owner_update" ON profiles FOR UPDATE
  USING (
    get_user_role() = 'owner'
    AND org_id = get_user_org_id()
  );

-- ─── 3. squads: narrow from admin/doctor/physio to owner-only ─────────────────

DROP POLICY IF EXISTS squads_insert ON squads;
CREATE POLICY squads_insert ON squads FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() = 'owner'
  );

DROP POLICY IF EXISTS squads_update ON squads;
CREATE POLICY squads_update ON squads FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (get_user_role() = 'owner');

DROP POLICY IF EXISTS squads_delete ON squads;
CREATE POLICY squads_delete ON squads FOR DELETE
  USING (
    org_id = get_user_org_id()
    AND get_user_role() = 'owner'
  );

-- ─── 4. athletes ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS athletes_insert ON athletes;
CREATE POLICY athletes_insert ON athletes FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio')
  );

DROP POLICY IF EXISTS athletes_update ON athletes;
CREATE POLICY athletes_update ON athletes FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio')
  );

-- ─── 5. score_history ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS score_history_clinical ON score_history;
CREATE POLICY score_history_clinical ON score_history FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS score_history_clinical_insert ON score_history;
CREATE POLICY score_history_clinical_insert ON score_history FOR INSERT
  WITH CHECK (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS score_history_clinical_update ON score_history;
CREATE POLICY score_history_clinical_update ON score_history FOR UPDATE
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  )
  WITH CHECK (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 6. wellness_checkins ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS wellness_select_clinical ON wellness_checkins;
CREATE POLICY wellness_select_clinical ON wellness_checkins FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS wellness_update ON wellness_checkins;
CREATE POLICY wellness_update ON wellness_checkins FOR UPDATE
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 7. rehab_sessions ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;
CREATE POLICY rehab_clinical_write ON rehab_sessions FOR ALL
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  )
  WITH CHECK (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS rehab_others_read ON rehab_sessions;
CREATE POLICY rehab_others_read ON rehab_sessions FOR SELECT
  USING (
    get_user_role() IN ('coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 8. injury_events ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "injury_clinical_insert" ON injury_events;
CREATE POLICY "injury_clinical_insert" ON injury_events FOR INSERT
  WITH CHECK (get_user_role() IN ('owner', 'doctor', 'physio'));

DROP POLICY IF EXISTS "injury_clinical_update" ON injury_events;
CREATE POLICY "injury_clinical_update" ON injury_events FOR UPDATE
  USING (get_user_role() IN ('owner', 'doctor', 'physio'));

DROP POLICY IF EXISTS "injury_clinical_select" ON injury_events;
CREATE POLICY "injury_clinical_select" ON injury_events FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS injury_events_clinical ON injury_events;
CREATE POLICY injury_events_clinical ON injury_events FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS injury_events_write ON injury_events;
CREATE POLICY injury_events_write ON injury_events FOR ALL
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 9. performance_data ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS performance_data_select ON performance_data;
CREATE POLICY performance_data_select ON performance_data FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS performance_data_write ON performance_data;
CREATE POLICY performance_data_write ON performance_data FOR ALL
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 10. gps_sessions ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS gps_sessions_select ON gps_sessions;
CREATE POLICY gps_sessions_select ON gps_sessions FOR SELECT
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS gps_sessions_write ON gps_sessions;
CREATE POLICY gps_sessions_write ON gps_sessions FOR ALL
  USING (
    get_user_role() IN ('owner', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 11. calendar_events ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS calendar_write ON calendar_events;
CREATE POLICY calendar_write ON calendar_events FOR ALL
  USING (
    get_user_role() IN ('owner', 'coach')
    AND EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.org_id = get_user_org_id())
  )
  WITH CHECK (
    get_user_role() IN ('owner', 'coach')
    AND EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.org_id = get_user_org_id())
  );

-- ─── 12. athlete_passport ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS athlete_passport_clinical_update_m2 ON athlete_passport;
CREATE POLICY athlete_passport_clinical_update_m2 ON athlete_passport FOR UPDATE
  USING (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  )
  WITH CHECK (
    get_user_role() IN ('owner', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 13. recommendation_log (role rename only — no squad scoping; org-level) ──

DROP POLICY IF EXISTS "clinical staff read own org rec logs" ON recommendation_log;
CREATE POLICY "clinical staff read own org rec logs" ON recommendation_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND org_id IS NOT NULL
        AND role IN ('owner', 'doctor', 'physio', 'coach', 'fitness_coach')
    )
  );

DROP POLICY IF EXISTS "clinical staff acknowledge recs" ON recommendation_log;
CREATE POLICY "clinical staff acknowledge recs" ON recommendation_log FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'doctor', 'physio')
    )
  )
  WITH CHECK (
    clinical_acknowledged_at IS NOT NULL OR coach_acknowledged_at IS NOT NULL
  );

DROP POLICY IF EXISTS "coach staff acknowledge recs" ON recommendation_log;
CREATE POLICY "coach staff acknowledge recs" ON recommendation_log FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'coach', 'fitness_coach')
    )
  )
  WITH CHECK (
    coach_acknowledged_at IS NOT NULL
  );

-- ─── 14. audit_logs ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
CREATE POLICY audit_logs_owner_select ON audit_logs FOR SELECT
  USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

-- ─── 15. PR #78 clinical module tables (occurrences, diagnoses, etc.) ─────────

DROP POLICY IF EXISTS "clinical_write_occurrences" ON occurrences;
CREATE POLICY "clinical_write_occurrences" ON occurrences
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "clinical_update_occurrences" ON occurrences;
CREATE POLICY "clinical_update_occurrences" ON occurrences
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "org_read_occurrences" ON occurrences;
CREATE POLICY "org_read_occurrences" ON occurrences
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "clinical_write_occurrence_records" ON occurrence_records;
CREATE POLICY "clinical_write_occurrence_records" ON occurrence_records
  FOR INSERT WITH CHECK (
    get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM occurrences o
      WHERE o.id = occurrence_id
        AND o.org_id = get_user_org_id()
        AND o.athlete_id = occurrence_records.athlete_id
    )
  );

DROP POLICY IF EXISTS "org_read_occurrence_records" ON occurrence_records;
CREATE POLICY "org_read_occurrence_records" ON occurrence_records
  FOR SELECT USING (
    get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM occurrences o
      WHERE o.id = occurrence_id AND o.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "doctor_write_diagnoses" ON diagnoses;
CREATE POLICY "doctor_write_diagnoses" ON diagnoses
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id
          AND o.org_id = get_user_org_id()
          AND o.athlete_id = diagnoses.athlete_id
      )
    )
  );

DROP POLICY IF EXISTS "doctor_update_diagnoses" ON diagnoses;
CREATE POLICY "doctor_update_diagnoses" ON diagnoses
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id
          AND o.org_id = get_user_org_id()
          AND o.athlete_id = diagnoses.athlete_id
      )
    )
  );

DROP POLICY IF EXISTS "org_read_diagnoses" ON diagnoses;
CREATE POLICY "org_read_diagnoses" ON diagnoses
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "clinical_write_med_admin" ON medication_administrations;
CREATE POLICY "clinical_write_med_admin" ON medication_administrations
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "org_read_med_admin" ON medication_administrations;
CREATE POLICY "org_read_med_admin" ON medication_administrations
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "clinical_write_orthosis" ON orthosis_records;
CREATE POLICY "clinical_write_orthosis" ON orthosis_records
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "clinical_update_orthosis" ON orthosis_records;
CREATE POLICY "clinical_update_orthosis" ON orthosis_records
  FOR UPDATE USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  )
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = athlete_id AND a.org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "org_read_orthosis" ON orthosis_records;
CREATE POLICY "org_read_orthosis" ON orthosis_records
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'doctor', 'physio', 'masseur')
  );

-- ─── 16. update_athlete_availability() RPC ─────────────────────────────────────

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
    AND org_id = get_user_org_id();
END;
$$;
