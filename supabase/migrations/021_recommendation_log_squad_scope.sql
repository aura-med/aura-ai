-- Migration 021 — Squad-scope recommendation_log access.
-- 017 left these policies org-level (squad scoping deferred), and 018 never
-- touched recommendation_log, so a doctor/coach assigned only to squad A could
-- read/acknowledge logs for squad B directly. recommendation_log.athlete_id
-- lets us scope through the authoritative athletes.squad_id.
--
-- The org predicate (org_id = get_user_org_id()) is factored across BOTH the
-- owner and non-owner arms: owners stay unrestricted only *within their own
-- org* (never across tenants), while other roles are further narrowed to their
-- assigned squads.

DROP POLICY IF EXISTS "clinical staff read own org rec logs" ON recommendation_log;
CREATE POLICY "clinical staff read own org rec logs" ON recommendation_log FOR SELECT
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio', 'coach', 'fitness_coach')
        AND athlete_id IN (
          SELECT id FROM athletes
          WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  );

DROP POLICY IF EXISTS "clinical staff acknowledge recs" ON recommendation_log;
CREATE POLICY "clinical staff acknowledge recs" ON recommendation_log FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('doctor', 'physio')
        AND athlete_id IN (
          SELECT id FROM athletes
          WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  )
  WITH CHECK (
    clinical_acknowledged_at IS NOT NULL OR coach_acknowledged_at IS NOT NULL
  );

DROP POLICY IF EXISTS "coach staff acknowledge recs" ON recommendation_log;
CREATE POLICY "coach staff acknowledge recs" ON recommendation_log FOR UPDATE
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_role() = 'owner'
      OR (
        get_user_role() IN ('coach', 'fitness_coach')
        AND athlete_id IN (
          SELECT id FROM athletes
          WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
        )
      )
    )
  )
  WITH CHECK (
    coach_acknowledged_at IS NOT NULL
  );
