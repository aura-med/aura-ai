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
--
-- Update the diagnosis BEFORE mirroring onto the occurrence, not after: the
-- occurrence UPDATE fires validate_occurrence_decision_source (065), which
-- reads the diagnosis's own current availability_status/restrictions/
-- notes/updated_at to decide whether the mirror is plausible and to compare
-- values. Mirroring first would make that trigger see the diagnosis's OLD
-- (pre-update) state — an older diagnosis timestamp could make a
-- coincidentally later reassessment look newer and reject the mirror
-- outright, and the value-match check would see the diagnosis's old values
-- against the occurrence's new ones and "correct" decision_source to 'own'
-- even though this genuinely is the diagnosis's own doing. Since this
-- function's diagnoses UPDATE is an earlier statement in the same
-- transaction, the occurrence trigger's fresh read afterward sees it
-- (read-your-own-writes holds regardless of isolation level).
--
-- osiics_code/osiics_description/diagnosis_type/custom_description/
-- occurrence_id are frozen on every diagnoses UPDATE by
-- freeze_diagnosis_immutable() (016, long since applied) — it was written
-- to stop a direct Data API caller from rewriting OSIICS data or moving a
-- diagnosis to another occurrence, but that froze this function's own
-- correction of those exact fields too, silently reverting them while this
-- RPC still reported success (and, worse, could mirror onto a NEW
-- occurrence the diagnosis was never actually re-linked to). See 071,
-- which teaches that trigger to trust this specific, already-RLS-checked
-- path via a transaction-local flag set right before the UPDATE below — a
-- raw Data API caller has no way to set it, so the original protection is
-- unchanged for anyone else.

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
  v_old_occurrence_id uuid;
  v_decision_changed boolean;
  v_diagnosis diagnoses;
BEGIN
  -- Serialization point: locks this diagnosis row, blocking until any
  -- concurrent update to it completes, then reads its guaranteed-current
  -- values (not a stale earlier snapshot).
  SELECT availability_status, load_management_restrictions, load_management_notes, occurrence_id
  INTO v_old_status, v_old_restrictions, v_old_notes, v_old_occurrence_id
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

  -- Transaction-local flag (auto-clears at commit/rollback): tells
  -- freeze_diagnosis_immutable() (071) this specific UPDATE is coming from
  -- this already-RLS-checked, trusted correction path, so it should let the
  -- OSIICS/type/description/occurrence_id fields through instead of
  -- reverting them to OLD.
  PERFORM set_config('app.trusted_diagnosis_edit', 'true', true);

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
  RETURNING * INTO v_diagnosis;

  -- Detaching/moving the diagnosis AWAY from its previous occurrence: 071
  -- made occurrence_id actually reassignable (071's own header explains
  -- why it wasn't before), so the old occurrence can no longer be assumed
  -- to still be backed by this diagnosis. If that occurrence's
  -- decision_source still says 'diagnosis' (it was this one — 061 allows
  -- only one active diagnosis per occurrence), reset it to 'own' so it
  -- stops being misattributed to a diagnosis it no longer has. Deliberately
  -- doesn't touch availability_status/restrictions/notes — there's no
  -- recoverable "true own" value to fall back to, so leave the athlete's
  -- displayed status as-is and only correct the attribution pointer; a
  -- clinician revisiting that occurrence will see it's now 'own' and can
  -- update it for real if it no longer reflects reality.
  IF v_old_occurrence_id IS NOT NULL AND v_old_occurrence_id IS DISTINCT FROM p_occurrence_id THEN
    UPDATE occurrences
    SET decision_source = 'own'
    WHERE id = v_old_occurrence_id AND decision_source = 'diagnosis' AND is_resolved = false;
  END IF;

  -- Attaching/moving the diagnosis to a (new) occurrence must mirror
  -- regardless of whether the decision VALUES also changed — that new
  -- parent has never had this diagnosis's data mirrored onto it before, so
  -- it would otherwise keep its own prior, conflicting status while the
  -- profile renders this diagnosis nested under it.
  IF p_occurrence_id IS NOT NULL
     AND (v_decision_changed OR v_old_occurrence_id IS DISTINCT FROM p_occurrence_id) THEN
    UPDATE occurrences
    SET
      availability_status = p_availability_status,
      load_management_restrictions = p_load_management_restrictions,
      load_management_notes = p_load_management_notes,
      updated_at = now(),
      decision_source = 'diagnosis'
    WHERE id = p_occurrence_id;
  END IF;

  RETURN NEXT v_diagnosis;
END;
$$;
