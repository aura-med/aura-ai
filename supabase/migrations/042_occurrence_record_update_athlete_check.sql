-- Migration 042 — Fix a gap in 039's occurrence_records UPDATE policy.
--
-- The UPDATE policy checked that the referenced occurrence belongs to the
-- caller's org, but — unlike the INSERT policy (018) — never checked that
-- the occurrence's own athlete_id matches occurrence_records.athlete_id.
-- A client could pass a mismatched occurrence_id/athlete_id pair through
-- the Data API and reattach a reassessment to a different athlete's
-- occurrence than the one it was actually logged against, corrupting
-- clinical history. Re-create the policy with the same invariant the
-- INSERT policy already enforces.

DROP POLICY IF EXISTS "clinical_update_occurrence_records" ON occurrence_records;

CREATE POLICY "clinical_update_occurrence_records" ON occurrence_records
  FOR UPDATE USING (
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
  )
  WITH CHECK (
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
