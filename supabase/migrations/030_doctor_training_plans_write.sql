-- Migration 030 — Doctor has full write access to training plans too, per the
-- same "doctor always has full clinical + operational write access" policy
-- applied to nutrition in migration 029.

DROP POLICY IF EXISTS "training_plans_write" ON training_plans;
CREATE POLICY "training_plans_write" ON training_plans FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('coach', 'fitness_coach', 'physio', 'doctor')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('coach', 'fitness_coach', 'physio', 'doctor')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

DROP POLICY IF EXISTS "training_plans_storage_write" ON storage.objects;
CREATE POLICY "training_plans_storage_write" ON storage.objects FOR ALL
  USING (
    bucket_id = 'training-plans'
    AND (get_user_role() = 'owner' OR get_user_role() IN ('coach', 'fitness_coach', 'physio', 'doctor'))
  )
  WITH CHECK (
    bucket_id = 'training-plans'
    AND (get_user_role() = 'owner' OR get_user_role() IN ('coach', 'fitness_coach', 'physio', 'doctor'))
  );
