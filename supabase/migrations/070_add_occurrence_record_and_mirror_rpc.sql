-- Migration 070 — Atomic reassessment creation + occurrence mirror.
--
-- addOccurrenceRecord (app/(dashboard)/occurrences/actions.ts) INSERTed the
-- occurrence_record, then separately UPDATEd the parent occurrence to
-- unconditionally set decision_source = 'reassessment'. Same race as 069's:
-- if createDiagnosis ran concurrently for the same occurrence, whichever
-- occurrence UPDATE ran second could hit validate_occurrence_decision_source
-- (065) and fail — even though the reassessment had already been
-- permanently saved — reporting failure and skipping availability
-- recomputation, and risking a duplicate reassessment on retry (unlike
-- diagnoses, occurrence_records has no one-active-per-occurrence
-- constraint).
--
-- Fold the insert and the mirror decision into one function, proactively
-- checking whether this reassessment is still the most recent source
-- before attempting the mirror at all — a superseded reassessment is still
-- inserted (it's real clinical history) but simply skips the mirror,
-- silently. Locking the occurrence row first serializes against 069's own
-- check for the same occurrence, so both converge on whichever source is
-- genuinely later.
--
-- Also preserves the original app logic's guards: reassessments only apply
-- to a still-open occurrence (returns no row if resolved or missing, which
-- the caller treats as "not found"), and athlete_id is derived from the
-- occurrence row itself, never trusted from the caller.
--
-- created_by/clinician_name are derived from auth.uid()/profiles here, not
-- taken as parameters — same reasoning as 069's diagnosed_by: this function
-- is directly callable via the Data API by any caller RLS lets INSERT an
-- occurrence_record, and parameters would let them attribute the
-- reassessment to an arbitrary other user's identity and display name.

CREATE OR REPLACE FUNCTION add_occurrence_record_and_mirror(
  p_occurrence_id uuid,
  p_record_date date,
  p_subjective text,
  p_objective text,
  p_assessment text,
  p_plan text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text
)
RETURNS SETOF occurrence_records
LANGUAGE plpgsql
AS $$
DECLARE
  v_athlete_id uuid;
  v_is_resolved boolean;
  v_clinician_name text;
  v_record occurrence_records;
  v_diag_at timestamptz;
BEGIN
  -- Serialization point: blocks until any concurrent write already holding
  -- this occurrence's lock (e.g. 069's own check) commits.
  SELECT athlete_id, is_resolved INTO v_athlete_id, v_is_resolved
  FROM occurrences
  WHERE id = p_occurrence_id
  FOR UPDATE;

  IF NOT FOUND OR v_is_resolved OR v_athlete_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(full_name, '') INTO v_clinician_name
  FROM profiles
  WHERE id = auth.uid();

  INSERT INTO occurrence_records (
    occurrence_id, athlete_id, record_date, subjective, objective, assessment,
    plan, availability_status, load_management_restrictions,
    load_management_notes, created_by, clinician_name
  ) VALUES (
    p_occurrence_id, v_athlete_id, p_record_date, p_subjective, p_objective, p_assessment,
    p_plan, p_availability_status, p_load_management_restrictions,
    p_load_management_notes, auth.uid(), COALESCE(v_clinician_name, '')
  )
  RETURNING * INTO v_record;

  SELECT MAX(COALESCE(updated_at, diagnosed_at)) INTO v_diag_at
  FROM diagnoses
  WHERE occurrence_id = p_occurrence_id AND is_resolved = false;

  IF v_diag_at IS NULL OR v_record.created_at >= v_diag_at THEN
    UPDATE occurrences
    SET
      availability_status = p_availability_status,
      load_management_restrictions = p_load_management_restrictions,
      load_management_notes = p_load_management_notes,
      updated_at = now(),
      decision_source = 'reassessment'
    WHERE id = p_occurrence_id;
  END IF;

  RETURN NEXT v_record;
END;
$$;
