-- Migration 069 — Atomic diagnosis creation + occurrence mirror.
--
-- createDiagnosis (lib/actions/clinical.ts) INSERTed the diagnosis, then
-- separately UPDATEd the parent occurrence to unconditionally set
-- decision_source = 'diagnosis'. If addOccurrenceRecord ran concurrently
-- for the SAME occurrence, both source rows could commit independently,
-- and whichever occurrence UPDATE ran second would hit
-- validate_occurrence_decision_source's (065) recency check and fail with
-- an exception — because the OTHER source is now genuinely newer — even
-- though the diagnosis itself had already been permanently saved. The
-- action then reported failure and skipped availability recomputation,
-- and a user retry could create a second, duplicate reassessment (nothing
-- stops a second occurrence_records row the way 061 stops a second active
-- diagnosis).
--
-- Fold the insert and the mirror decision into one function, and — instead
-- of always attempting the mirror and letting the trigger's exception
-- enforce recency — proactively check whether this diagnosis is still the
-- most recent source before attempting it at all. A superseded diagnosis
-- is still inserted (it's real clinical data) but simply skips the mirror,
-- silently, exactly like updateOccurrenceRecord/updateDiagnosis already do
-- when their own correction is no longer the active source. Locking the
-- occurrence row first (when there is one) serializes against a concurrent
-- addOccurrenceRecord (070) doing the same "is my source still latest"
-- check for the identical occurrence, so both converge on whichever source
-- is genuinely later — never an exception, never an orphaned unmirrored
-- source.

CREATE OR REPLACE FUNCTION create_diagnosis_and_mirror(
  p_athlete_id uuid,
  p_org_id uuid,
  p_osiics_code text,
  p_osiics_description text,
  p_diagnosis_type text,
  p_custom_description text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_diagnosed_by uuid,
  p_occurrence_id uuid
)
RETURNS SETOF diagnoses
LANGUAGE plpgsql
AS $$
DECLARE
  v_diagnosis diagnoses;
  v_rec_at timestamptz;
BEGIN
  IF p_occurrence_id IS NOT NULL THEN
    -- Serialization point: blocks until any concurrent write already
    -- holding this occurrence's lock (e.g. 070's own check) commits.
    PERFORM 1 FROM occurrences WHERE id = p_occurrence_id FOR UPDATE;
  END IF;

  INSERT INTO diagnoses (
    athlete_id, org_id, osiics_code, osiics_description, diagnosis_type,
    custom_description, availability_status, load_management_restrictions,
    load_management_notes, diagnosed_by, occurrence_id
  ) VALUES (
    p_athlete_id, p_org_id, p_osiics_code, p_osiics_description, p_diagnosis_type,
    p_custom_description, p_availability_status, p_load_management_restrictions,
    p_load_management_notes, p_diagnosed_by, p_occurrence_id
  )
  RETURNING * INTO v_diagnosis;

  IF p_occurrence_id IS NOT NULL THEN
    SELECT MAX(created_at) INTO v_rec_at
    FROM occurrence_records
    WHERE occurrence_id = p_occurrence_id;

    IF v_rec_at IS NULL OR v_diagnosis.diagnosed_at >= v_rec_at THEN
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
