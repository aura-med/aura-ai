-- Migration 080 — Atomic diagnosis resolve + occurrence cleanup.
--
-- resolveDiagnosis (lib/actions/clinical.ts) only resolved the diagnoses
-- row. If that diagnosis was still linked to an open occurrence with
-- decision_source = 'diagnosis', the occurrence kept the diagnosis's
-- mirrored availability_status/restrictions/notes indefinitely — 078's
-- recompute_and_persist_athlete_availability only excludes RESOLVED
-- occurrences/diagnoses from its ranking, and this occurrence was never
-- resolved or updated, so its now-stale, diagnosis-derived status stayed
-- a perfectly valid (and often winning, since it's not stale in any way
-- the SQL can see) candidate event — keeping the athlete restricted by a
-- diagnosis that no longer exists as an open clinical issue.
--
-- Same fix as 067's detach cleanup, folded into the resolve itself: after
-- resolving, if the diagnosis's occurrence is still open and still
-- attributes its status to this diagnosis, re-derive from the
-- occurrence's own latest reassessment (verbatim, timestamped with the
-- reassessment's own created_at rather than now() — same reasoning as 067,
-- so this administrative cleanup can never outrank a genuinely later
-- clinical event for the athlete). Falls back to resetting decision_source
-- to 'own' (leaving the stale values as the only remaining record) when
-- there's truly no reassessment to derive from.
--
-- Locks the occurrence (via an unlocked prediction read, occurrence-first,
-- re-verified after locking the diagnosis) before the diagnosis row, same
-- order as 067/069/070 — see 067's header for why diagnosis-first would
-- risk a deadlock against a concurrent create_diagnosis_and_mirror (069)
-- call on the same occurrence.

CREATE OR REPLACE FUNCTION resolve_diagnosis_and_cleanup(p_diagnosis_id uuid)
RETURNS SETOF diagnoses
LANGUAGE plpgsql
AS $$
DECLARE
  v_predicted_occurrence_id uuid;
  v_diagnosis diagnoses;
  v_fallback_record occurrence_records;
BEGIN
  SELECT occurrence_id INTO v_predicted_occurrence_id
  FROM diagnoses
  WHERE id = p_diagnosis_id;

  IF v_predicted_occurrence_id IS NOT NULL THEN
    PERFORM 1 FROM occurrences WHERE id = v_predicted_occurrence_id FOR UPDATE;
  END IF;

  UPDATE diagnoses
  SET is_resolved = true, resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_diagnosis_id AND is_resolved = false
  RETURNING * INTO v_diagnosis;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Rare race: a concurrent update_diagnosis_and_mirror (067) call — the
  -- only path that ever changes occurrence_id — moved this diagnosis
  -- between the prediction read above and the lock just taken. Lock its
  -- actual occurrence too if so.
  IF v_diagnosis.occurrence_id IS NOT NULL
     AND v_diagnosis.occurrence_id IS DISTINCT FROM v_predicted_occurrence_id THEN
    PERFORM 1 FROM occurrences WHERE id = v_diagnosis.occurrence_id FOR UPDATE;
  END IF;

  IF v_diagnosis.occurrence_id IS NOT NULL THEN
    SELECT * INTO v_fallback_record
    FROM occurrence_records
    WHERE occurrence_id = v_diagnosis.occurrence_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE occurrences
      SET
        availability_status = v_fallback_record.availability_status,
        load_management_restrictions = v_fallback_record.load_management_restrictions,
        load_management_notes = v_fallback_record.load_management_notes,
        updated_at = v_fallback_record.created_at,
        decision_source = 'reassessment'
      WHERE id = v_diagnosis.occurrence_id AND decision_source = 'diagnosis' AND is_resolved = false;
    ELSE
      UPDATE occurrences
      SET decision_source = 'own'
      WHERE id = v_diagnosis.occurrence_id AND decision_source = 'diagnosis' AND is_resolved = false;
    END IF;
  END IF;

  RETURN NEXT v_diagnosis;
END;
$$;
