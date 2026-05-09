-- ─── Migration 005: Fix missing RLS policies ──────────────────────────────
-- Idempotent: drops before creating so re-running is safe.

-- ─── Organizations ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select ON organizations FOR SELECT
  USING (id = get_user_org_id());

-- ─── Squads: all org members read; admin/doctor/physio write ─────────────

DROP POLICY IF EXISTS squads_select ON squads;
CREATE POLICY squads_select ON squads FOR SELECT
  USING (org_id = get_user_org_id());

DROP POLICY IF EXISTS squads_insert ON squads;
CREATE POLICY squads_insert ON squads FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio')
  );

DROP POLICY IF EXISTS squads_update ON squads;
CREATE POLICY squads_update ON squads FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (get_user_role() IN ('admin', 'doctor', 'physio'));

DROP POLICY IF EXISTS squads_delete ON squads;
CREATE POLICY squads_delete ON squads FOR DELETE
  USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio')
  );

-- ─── Injury events ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS injury_events_clinical ON injury_events;
CREATE POLICY injury_events_clinical ON injury_events FOR SELECT
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS injury_events_athlete ON injury_events;
CREATE POLICY injury_events_athlete ON injury_events FOR SELECT
  USING (
    get_user_role() = 'athlete'
    AND athlete_id IN (SELECT id FROM athletes WHERE id::text = auth.uid()::text)
  );

DROP POLICY IF EXISTS injury_events_write ON injury_events;
CREATE POLICY injury_events_write ON injury_events FOR ALL
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── Performance data ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS performance_data_select ON performance_data;
CREATE POLICY performance_data_select ON performance_data FOR SELECT
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS performance_data_write ON performance_data;
CREATE POLICY performance_data_write ON performance_data FOR ALL
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── GPS sessions ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS gps_sessions_select ON gps_sessions;
CREATE POLICY gps_sessions_select ON gps_sessions FOR SELECT
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

DROP POLICY IF EXISTS gps_sessions_write ON gps_sessions;
CREATE POLICY gps_sessions_write ON gps_sessions FOR ALL
  USING (
    get_user_role() IN ('admin', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── Wellness checkins: add UPDATE so upsert works ────────────────────────

DROP POLICY IF EXISTS wellness_update ON wellness_checkins;
CREATE POLICY wellness_update ON wellness_checkins FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );
