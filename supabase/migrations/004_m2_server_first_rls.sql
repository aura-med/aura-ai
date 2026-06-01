-- M2 Server-First Platform: targeted RLS coverage for DTO-backed clinical reads.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_passport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;

CREATE POLICY organizations_member_select_m2
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY squads_member_select_m2
  ON squads FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY gps_sessions_member_select_m2
  ON gps_sessions FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY injury_events_member_select_m2
  ON injury_events FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY performance_data_member_select_m2
  ON performance_data FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY fatigue_profiles_member_select_m2
  ON fatigue_profiles FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY athlete_passport_member_select_m2
  ON athlete_passport FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY athlete_passport_clinical_update_m2
  ON athlete_passport FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY rehab_protocols_authenticated_select_m2
  ON rehab_protocols FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY rehab_sessions_clinical_write_m2
  ON rehab_sessions FOR ALL
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );
