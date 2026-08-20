-- Migration 029 — Doctor has full write access across clinical features,
-- including nutrition. Migration 026/028 restricted daily-weight/assessment/
-- supplement writes to owner + physio/masseur/nutritionist (per the original
-- nutrition spec), which excluded doctor — inconsistent with the rest of the
-- app, where doctor already has full write access to occurrences, diagnoses,
-- treatments, anamnesis, etc. (CLINICAL_ROLES). Add doctor to the write side
-- of all three nutrition-module policies; read access was already open to
-- doctor.

-- ── athlete_daily_weight ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "daily_weight_write" ON athlete_daily_weight;
CREATE POLICY "daily_weight_write" ON athlete_daily_weight FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── nutrition_assessments ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "nutrition_write" ON nutrition_assessments;
CREATE POLICY "nutrition_write" ON nutrition_assessments FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── athlete_supplements ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "supplements_write" ON athlete_supplements;
CREATE POLICY "supplements_write" ON athlete_supplements FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
