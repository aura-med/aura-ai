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
--
-- The occurrence(s) this diagnosis touches (old and/or new) are locked
-- FOR UPDATE before deriving v_rec_at — mirroring the pattern 069/070
-- already use. Without that lock, this function could read v_rec_at,
-- decide the diagnosis is still latest, then block on the occurrence
-- UPDATE behind a concurrent add_occurrence_record_and_mirror (070) call
-- for the same occurrence; once 070 commits its newer, genuinely-latest
-- reassessment, this function's stale "still latest" decision would resume
-- and overwrite it with the older diagnosis's values.
--
-- Those occurrence locks are acquired BEFORE the diagnosis row lock below,
-- not after — occurrence-then-diagnosis, matching 069/070's own order, not
-- the reverse. create_diagnosis_and_mirror (069) locks its target
-- occurrence first, then INSERTs a diagnosis there; 061's partial unique
-- index makes that INSERT's conflict check implicitly wait on whichever
-- diagnosis row currently holds that occurrence, i.e. diagnosis-after-
-- occurrence. If this function instead locked the diagnosis first and the
-- occurrence second (the order it used to use), a 067 call moving a
-- diagnosis away from occurrence A (holding D, waiting for A) and a
-- concurrent direct 069 call targeting A (holding A, waiting for D via the
-- unique index) would deadlock — Postgres aborts one, failing an otherwise
-- legitimate clinical write. Since this function still needs the
-- diagnosis's occurrence_id to know which occurrence(s) to lock, it takes
-- an unlocked, best-effort read first purely to pick candidates for the
-- occurrence-first lock — then locks the diagnosis for the authoritative
-- value and additionally locks its actual old occurrence afterward on the
-- rare chance a concurrent 067 call on this same diagnosis changed it
-- between the two reads (see below); that residual race is already
-- reduced to an occasional deadlock-abort-and-retry by the diagnosis row
-- lock itself, never a silently wrong mirror.

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
  v_predicted_occurrence_id uuid;
  v_old_status text;
  v_old_restrictions text[];
  v_old_notes text;
  v_old_occurrence_id uuid;
  v_decision_changed boolean;
  v_diagnosis diagnoses;
  v_rec_at timestamptz;
BEGIN
  -- Unlocked, best-effort read: used only to pick which occurrence row(s)
  -- to lock BEFORE the diagnosis row (occurrence-then-diagnosis — see
  -- header comment), never trusted for any actual decision below.
  SELECT occurrence_id INTO v_predicted_occurrence_id
  FROM diagnoses
  WHERE id = p_diagnosis_id;

  IF v_predicted_occurrence_id IS NOT NULL OR p_occurrence_id IS NOT NULL THEN
    PERFORM 1 FROM occurrences
    WHERE id = ANY(ARRAY_REMOVE(ARRAY[v_predicted_occurrence_id, p_occurrence_id], NULL))
    ORDER BY id
    FOR UPDATE;
  END IF;

  -- Serialization point: locks this diagnosis row, blocking until any
  -- concurrent update to it completes, then reads its guaranteed-current
  -- values (not a stale earlier snapshot, and not the unlocked prediction
  -- above).
  SELECT availability_status, load_management_restrictions, load_management_notes, occurrence_id
  INTO v_old_status, v_old_restrictions, v_old_notes, v_old_occurrence_id
  FROM diagnoses
  WHERE id = p_diagnosis_id AND is_resolved = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- A concurrent 067 call on this same diagnosis (the only path that ever
  -- changes its occurrence_id) could have moved it between the two reads
  -- above, in or out of the set already locked. Lock its actual old
  -- occurrence too if so — needed below regardless of prediction accuracy.
  IF v_old_occurrence_id IS NOT NULL
     AND v_old_occurrence_id IS DISTINCT FROM v_predicted_occurrence_id
     AND v_old_occurrence_id IS DISTINCT FROM p_occurrence_id THEN
    PERFORM 1 FROM occurrences WHERE id = v_old_occurrence_id FOR UPDATE;
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
    SELECT MAX(created_at) INTO v_rec_at
    FROM occurrence_records
    WHERE occurrence_id = p_occurrence_id;

    -- Only actually mirror if this diagnosis is still the most recent
    -- source for the target occurrence — otherwise
    -- validate_occurrence_decision_source (065) would reject
    -- decision_source = 'diagnosis' outright (a later reassessment exists
    -- there), rolling back this ENTIRE transaction, including the
    -- diagnosis's own update/attachment that had nothing wrong with it.
    -- This matters most when attaching an orphan diagnosis whose own
    -- values didn't change (v_decision_changed false, so 047/051's trigger
    -- left updated_at at its old value) onto an occurrence that already
    -- has a newer reassessment — skip the mirror silently instead,
    -- matching create_diagnosis_and_mirror's (069) same proactive check.
    IF v_rec_at IS NULL OR v_diagnosis.updated_at >= v_rec_at THEN
      UPDATE occurrences
      SET
        availability_status = p_availability_status,
        load_management_restrictions = p_load_management_restrictions,
        load_management_notes = p_load_management_notes,
        updated_at = now(),
        decision_source = 'diagnosis'
      WHERE id = p_occurrence_id;
    END IF;
  END IF;

  RETURN NEXT v_diagnosis;
END;
$$;
