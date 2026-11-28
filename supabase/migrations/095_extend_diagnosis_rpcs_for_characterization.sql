-- Migration 095 — Thread diagnosis_date + the 12 injury-characterization
-- fields (094) through create_diagnosis_and_mirror (069) and
-- update_diagnosis_and_mirror (067).
--
-- All 13 new parameters are trailing, DEFAULT NULL — existing callers that
-- don't pass them keep working exactly as before. diagnosis_date specifically
-- can't just be left NULL when omitted (094 made the column NOT NULL): create
-- falls back to CURRENT_DATE (matching the column's own default), update
-- preserves the row's existing value via COALESCE rather than clobbering it.
-- Every other new field is nullable, so a plain COALESCE-to-self (update) or
-- pass-through (create) is enough. Nothing else in either function's body
-- changes — same locking order, same mirror/race-condition handling as
-- 069/067 (see those files for the full reasoning).

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
  p_occurrence_id uuid,
  p_diagnosis_date date DEFAULT NULL,
  p_context text DEFAULT NULL,
  p_match_minute integer DEFAULT NULL,
  p_mechanism text DEFAULT NULL,
  p_contact_type text DEFAULT NULL,
  p_player_action text DEFAULT NULL,
  p_foul_involved boolean DEFAULT NULL,
  p_body_region text DEFAULT NULL,
  p_body_side text DEFAULT NULL,
  p_tissue_type text DEFAULT NULL,
  p_is_recurrence boolean DEFAULT NULL,
  p_related_diagnosis_id uuid DEFAULT NULL,
  p_claim_filed boolean DEFAULT NULL
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
    load_management_notes, diagnosed_by, occurrence_id,
    diagnosis_date, context, match_minute, mechanism, contact_type,
    player_action, foul_involved, body_region, body_side, tissue_type,
    is_recurrence, related_diagnosis_id, claim_filed
  ) VALUES (
    p_athlete_id, p_org_id, p_osiics_code, p_osiics_description, p_diagnosis_type,
    p_custom_description, p_availability_status, p_load_management_restrictions,
    p_load_management_notes, auth.uid(), p_occurrence_id,
    COALESCE(p_diagnosis_date, CURRENT_DATE), p_context, p_match_minute, p_mechanism, p_contact_type,
    p_player_action, p_foul_involved, p_body_region, p_body_side, p_tissue_type,
    COALESCE(p_is_recurrence, false), p_related_diagnosis_id, p_claim_filed
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

CREATE OR REPLACE FUNCTION update_diagnosis_and_mirror(
  p_diagnosis_id uuid,
  p_osiics_code text,
  p_osiics_description text,
  p_diagnosis_type text,
  p_custom_description text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_occurrence_id uuid,
  p_diagnosis_date date DEFAULT NULL,
  p_context text DEFAULT NULL,
  p_match_minute integer DEFAULT NULL,
  p_mechanism text DEFAULT NULL,
  p_contact_type text DEFAULT NULL,
  p_player_action text DEFAULT NULL,
  p_foul_involved boolean DEFAULT NULL,
  p_body_region text DEFAULT NULL,
  p_body_side text DEFAULT NULL,
  p_tissue_type text DEFAULT NULL,
  p_is_recurrence boolean DEFAULT NULL,
  p_related_diagnosis_id uuid DEFAULT NULL,
  p_claim_filed boolean DEFAULT NULL
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
  v_fallback_record occurrence_records;
BEGIN
  -- Unlocked, best-effort read: used only to pick which occurrence row(s)
  -- to lock BEFORE the diagnosis row (occurrence-then-diagnosis — see
  -- 067's header comment), never trusted for any actual decision below.
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
    occurrence_id = p_occurrence_id,
    diagnosis_date = COALESCE(p_diagnosis_date, diagnosis_date),
    context = p_context,
    match_minute = p_match_minute,
    mechanism = p_mechanism,
    contact_type = p_contact_type,
    player_action = p_player_action,
    foul_involved = p_foul_involved,
    body_region = p_body_region,
    body_side = p_body_side,
    tissue_type = p_tissue_type,
    is_recurrence = COALESCE(p_is_recurrence, is_recurrence),
    related_diagnosis_id = p_related_diagnosis_id,
    claim_filed = p_claim_filed
  WHERE id = p_diagnosis_id AND is_resolved = false
  RETURNING * INTO v_diagnosis;

  -- Detaching/moving the diagnosis AWAY from its previous occurrence: 071
  -- made occurrence_id actually reassignable (071's own header explains
  -- why it wasn't before), so the old occurrence can no longer be assumed
  -- to still be backed by this diagnosis. If that occurrence's
  -- decision_source still says 'diagnosis' (it was this one — 061 allows
  -- only one active diagnosis per occurrence), it needs a new source of
  -- truth. Prefer the occurrence's own latest reassessment, if it has one.
  IF v_old_occurrence_id IS NOT NULL AND v_old_occurrence_id IS DISTINCT FROM p_occurrence_id THEN
    SELECT * INTO v_fallback_record
    FROM occurrence_records
    WHERE occurrence_id = v_old_occurrence_id
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
      WHERE id = v_old_occurrence_id AND decision_source = 'diagnosis' AND is_resolved = false;
    ELSE
      UPDATE occurrences
      SET
        availability_status = 'available',
        load_management_restrictions = '{}',
        load_management_notes = NULL,
        decision_source = 'own'
      WHERE id = v_old_occurrence_id AND decision_source = 'diagnosis' AND is_resolved = false;
    END IF;
  END IF;

  -- Attaching/moving the diagnosis to a (new) occurrence must mirror
  -- regardless of whether the decision VALUES also changed.
  IF p_occurrence_id IS NOT NULL
     AND (v_decision_changed OR v_old_occurrence_id IS DISTINCT FROM p_occurrence_id) THEN
    SELECT MAX(created_at) INTO v_rec_at
    FROM occurrence_records
    WHERE occurrence_id = p_occurrence_id;

    IF v_rec_at IS NULL OR v_diagnosis.updated_at >= v_rec_at THEN
      UPDATE occurrences
      SET
        availability_status = p_availability_status,
        load_management_restrictions = p_load_management_restrictions,
        load_management_notes = p_load_management_notes,
        updated_at = v_diagnosis.updated_at,
        decision_source = 'diagnosis'
      WHERE id = p_occurrence_id;
    END IF;
  END IF;

  RETURN NEXT v_diagnosis;
END;
$$;
