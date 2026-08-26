-- Migration 039 — Allow editing an existing occurrence_records reassessment.
--
-- occurrence_records only ever had INSERT + SELECT policies (017/018) — an
-- append-only reassessment log by design. In practice clinicians need to
-- correct a reassessment they just logged (typo, wrong status picked), not
-- just add new ones, so add an UPDATE policy mirroring the existing
-- INSERT policy's org/squad/role scoping.

CREATE POLICY "clinical_update_occurrence_records" ON occurrence_records
  FOR UPDATE USING (
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
  )
  WITH CHECK (
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

-- Deliberately NOT extending the open-occurrence guard (023) to UPDATE: that
-- trigger stops a NEW clinical decision from being logged after the occurrence
-- closed, which doesn't apply to correcting an existing record's own text —
-- the same way editing the parent occurrence itself (updateOccurrence) isn't
-- gated on is_resolved either.
