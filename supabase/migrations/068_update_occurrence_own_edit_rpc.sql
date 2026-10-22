-- Migration 068 — Atomic occurrence own-edit update.
--
-- Same race as 063 (occurrence_records) and 067 (diagnoses), this time in
-- updateOccurrence (app/(dashboard)/occurrences/actions.ts): decisionChanged
-- was computed from a SELECT taken before the UPDATE. If a reassessment or
-- diagnosis mirror lands on the same occurrence between that read and this
-- write, decisionChanged is derived against stale values and can come back
-- false even though the update is about to overwrite that newer mirrored
-- decision with the form's older one. Since decisionChanged is false, the
-- spread omits both `updated_at` and `decision_source: 'own'` — the row
-- ends up carrying the direct edit's values while still claiming to be
-- diagnosis/reassessment-driven (wrong reason shown, and a later correction
-- to that stale source could overwrite the direct edit again).
--
-- Lock the row first and derive the change from that guaranteed-current
-- snapshot, then update in the same statement — no gap for a concurrent
-- mirror to land in unnoticed.

CREATE OR REPLACE FUNCTION update_occurrence_own_edit(
  p_occurrence_id uuid,
  p_title text,
  p_occurrence_date date,
  p_occurrence_type text,
  p_assessment text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text
)
RETURNS SETOF occurrences
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text;
  v_old_restrictions text[];
  v_old_notes text;
  v_decision_changed boolean;
BEGIN
  SELECT availability_status, load_management_restrictions, load_management_notes
  INTO v_old_status, v_old_restrictions, v_old_notes
  FROM occurrences
  WHERE id = p_occurrence_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_decision_changed :=
    v_old_status IS DISTINCT FROM p_availability_status
    OR ARRAY(SELECT unnest(v_old_restrictions) ORDER BY 1)
       IS DISTINCT FROM ARRAY(SELECT unnest(p_load_management_restrictions) ORDER BY 1)
    OR v_old_notes IS DISTINCT FROM p_load_management_notes;

  RETURN QUERY
  UPDATE occurrences
  SET
    title = p_title,
    occurrence_date = p_occurrence_date,
    occurrence_type = p_occurrence_type,
    assessment = p_assessment,
    availability_status = p_availability_status,
    load_management_restrictions = p_load_management_restrictions,
    load_management_notes = p_load_management_notes,
    updated_at = CASE WHEN v_decision_changed THEN now() ELSE updated_at END,
    decision_source = CASE WHEN v_decision_changed THEN 'own' ELSE decision_source END
  WHERE id = p_occurrence_id
  RETURNING *;
END;
$$;
