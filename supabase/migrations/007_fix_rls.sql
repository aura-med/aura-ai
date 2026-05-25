-- ─────────────────────────────────────────────────────────────────────────────
-- 007_fix_rls.sql
-- Fixes:
--   1. Missing INSERT policy on recommendation_log (EU AI Act Art. 12 logging
--      was silently rejected for every score recalculation).
--   2. rehab_clinical_write policy lacked org_id scope — any doctor/physio from
--      any org could read or write any rehab session by guessing a UUID.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. recommendation_log INSERT ─────────────────────────────────────────────
-- generateAndPersistRecommendations runs under the scorer's session context.
-- Allow any authenticated org member to insert; org_id must match their profile.
DROP POLICY IF EXISTS "org staff insert rec logs" ON recommendation_log;

CREATE POLICY "org staff insert rec logs"
  ON recommendation_log FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND org_id IS NOT NULL
    )
  );


-- ── 2. score_history clinical write — support server-side recalculation ──────
-- The score route runs with the authenticated clinician session, so RLS must
-- permit org-scoped inserts and updates for the score_history upsert.
DROP POLICY IF EXISTS score_history_clinical_insert ON score_history;
DROP POLICY IF EXISTS score_history_clinical_update ON score_history;

CREATE POLICY score_history_clinical_insert ON score_history FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY score_history_clinical_update ON score_history FOR UPDATE
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


-- ── 3. rehab_sessions clinical write — add org scope ─────────────────────────
DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;
DROP POLICY IF EXISTS rehab_sessions_clinical_write_m2 ON rehab_sessions;

CREATE POLICY rehab_clinical_write ON rehab_sessions FOR ALL
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
