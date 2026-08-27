-- Migration 067 — Atomic diagnosis update + occurrence mirror.
--
-- updateDiagnosis (lib/actions/clinical.ts) computed decisionChanged from a
-- SELECT taken before its UPDATE, then used that cached flag to decide
-- whether to mirror onto the parent occurrence. Two clinicians editing the
-- same diagnosis concurrently could race: clinician B changes status A to B
-- and mirrors it; clinician A's request — read status A earlier, saving a
-- metadata-only correction back to A — then runs its own UPDATE, genuinely
-- changing the row from B back to A (so 047's trigger correctly advances
-- diagnoses.updated_at), but A's own decisionChanged was computed against
-- the stale pre-B snapshot and says "unchanged", so the occurrence mirror
-- is skipped. Result: the diagnosis says A, but the occurrence/athlete
-- (decision_source still 'diagnosis' from B's mirror) still shows B —
-- desynced.
--
-- Fold the "read old values", "update", and "mirror" into one function:
-- lock the diagnosis row first (serializing against a concurrent update to
-- the same row), derive decisionChanged from that locked, guaranteed-
-- current snapshot, then update and conditionally mirror in the same
-- transaction. No SECURITY DEFINER — every statement still runs under the
-- caller's own RLS, exactly as the separate calls did before.

CREATE OR REPLACE FUNCTION update_diagnosis_and_mirror(
  p_diagnosis_id uuid,
  p_osiics_code text,
  p_osiics_description text,
  p_diagnosis_type text,
  p_custom_description text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_occurrence_id uuid
)
RETURNS SETOF diagnoses
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text;
  v_old_restrictions text[];
  v_old_notes text;
  v_decision_changed boolean;
BEGIN
  -- Serialization point: locks this diagnosis row, blocking until any
  -- concurrent update to it completes, then reads its guaranteed-current
  -- values (not a stale earlier snapshot).
  SELECT availability_status, load_management_restrictions, load_management_notes
  INTO v_old_status, v_old_restrictions, v_old_notes
  FROM diagnoses
  WHERE id = p_diagnosis_id AND is_resolved = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_decision_changed :=
    v_old_status IS DISTINCT FROM p_availability_status
    OR ARRAY(SELECT unnest(v_old_restrictions) ORDER BY 1)
       IS DISTINCT FROM ARRAY(SELECT unnest(p_load_management_restrictions) ORDER BY 1)
    OR v_old_notes IS DISTINCT FROM p_load_management_notes;

  IF p_occurrence_id IS NOT NULL AND v_decision_changed THEN
    UPDATE occurrences
    SET
      availability_status = p_availability_status,
      load_management_restrictions = p_load_management_restrictions,
      load_management_notes = p_load_management_notes,
      updated_at = now(),
      decision_source = 'diagnosis'
    WHERE id = p_occurrence_id;
  END IF;

  RETURN QUERY
  UPDATE diagnoses
  SET
    osiics_code = p_osiics_code,
    osiics_description = p_osiics_description,
    diagnosis_type = p_diagnosis_type,
    custom_description = p_custom_description,
    availability_status = p_availability_status,
    load_management_restrictions = p_load_management_restrictions,
    load_management_notes = p_load_management_notes,
    occurrence_id = p_occurrence_id
  WHERE id = p_diagnosis_id AND is_resolved = false
  RETURNING *;
END;
$$;
