-- Migration 099 — An injury diagnosis auto-creates a rehab plan (B4).
--
-- Today "Adicionar Diagnóstico" and starting a rehab plan are two fully
-- separate, manual steps — exactly the kind of disconnect the workflow
-- redesign is meant to remove. From here on, create_diagnosis_and_mirror
-- creates an empty rehab_plans row whenever p_diagnosis_type = 'injury',
-- in the same transaction as the diagnosis itself. A disease diagnosis
-- never touches rehab_plans.
--
-- Default taken per the plan: if the athlete already has an active plan,
-- the new injury diagnosis is BLOCKED with an error (same invariant
-- createRehabPlan already enforces at the app layer, migration-side here)
-- rather than silently attaching to the existing plan — a second concurrent
-- injury needs a clinician's judgment call, not a silent merge. The new
-- plan starts empty; the clinician adds phases afterward.
--
-- This also drops the stale 10-arg create_diagnosis_and_mirror overload left
-- behind by 095 (CREATE OR REPLACE with added trailing params creates a new
-- overload rather than replacing one with a different arg count — the same
-- issue 097 fixed for resolve_diagnosis_and_cleanup). Harmless as-is (Postgres
-- prefers the fewest-defaults match, so existing 10-arg-shaped calls would
-- still resolve correctly) but dead weight now that every caller passes the
-- full parameter list.
DROP FUNCTION IF EXISTS create_diagnosis_and_mirror(
  uuid, uuid, text, text, text, text, text, text[], text, uuid
);

CREATE OR REPLACE FUNCTION public.create_diagnosis_and_mirror(
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
AS $function$
DECLARE
  v_diagnosis diagnoses;
  v_rec_at timestamptz;
  v_has_active_plan boolean;
  v_plan_title text;
BEGIN
  IF p_occurrence_id IS NOT NULL THEN
    PERFORM 1 FROM occurrences WHERE id = p_occurrence_id FOR UPDATE;
  END IF;

  IF p_diagnosis_type = 'injury' THEN
    SELECT EXISTS (
      SELECT 1 FROM rehab_plans WHERE athlete_id = p_athlete_id AND is_active = true
    ) INTO v_has_active_plan;

    IF v_has_active_plan THEN
      RAISE EXCEPTION 'Este atleta já tem um plano de reabilitação ativo.';
    END IF;
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

  IF p_diagnosis_type = 'injury' THEN
    v_plan_title := COALESCE(p_osiics_description, p_custom_description, 'Lesão');

    INSERT INTO rehab_plans (
      athlete_id, org_id, occurrence_id, title, start_date, created_by
    ) VALUES (
      p_athlete_id, p_org_id, p_occurrence_id, v_plan_title, v_diagnosis.diagnosis_date, auth.uid()
    );
  END IF;

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
$function$;

-- conclude_reassessment_with_diagnosis (098) inserts diagnoses directly
-- rather than through create_diagnosis_and_mirror above, so it needs the
-- same auto-create-plan logic independently — only on the fresh-insert
-- branch (v_existing_diagnosis_id IS NULL): reusing an already-active
-- diagnosis means a plan was already created when that diagnosis first
-- appeared.
CREATE OR REPLACE FUNCTION conclude_reassessment_with_diagnosis(
  p_occurrence_id uuid,
  p_record_date date,
  p_subjective text,
  p_objective text,
  p_assessment text,
  p_plan text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_diagnosis_type text DEFAULT NULL,
  p_osiics_code text DEFAULT NULL,
  p_osiics_description text DEFAULT NULL,
  p_custom_description text DEFAULT NULL,
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
RETURNS SETOF occurrence_records
LANGUAGE plpgsql
AS $$
DECLARE
  v_athlete_id uuid;
  v_org_id uuid;
  v_is_resolved boolean;
  v_clinician_name text;
  v_record occurrence_records;
  v_diag_at timestamptz;
  v_existing_diagnosis_id uuid;
  v_diagnosis_date date;
  v_has_active_plan boolean;
  v_plan_title text;
BEGIN
  SELECT athlete_id, org_id, is_resolved INTO v_athlete_id, v_org_id, v_is_resolved
  FROM occurrences
  WHERE id = p_occurrence_id
  FOR UPDATE;

  IF NOT FOUND OR v_is_resolved OR v_athlete_id IS NULL THEN
    RETURN;
  END IF;

  IF p_availability_status = 'unavailable' THEN
    IF p_diagnosis_type IS NULL THEN
      RAISE EXCEPTION 'É necessário um diagnóstico para concluir Indisponível.';
    END IF;

    -- 061 allows only one active diagnosis per occurrence — reuse it if this
    -- reassessment is itself what's making an already-diagnosed occurrence
    -- unavailable again, rather than erroring on the unique index.
    SELECT id INTO v_existing_diagnosis_id
    FROM diagnoses WHERE occurrence_id = p_occurrence_id AND is_resolved = false;

    IF v_existing_diagnosis_id IS NULL THEN
      IF p_diagnosis_type = 'injury' THEN
        SELECT EXISTS (
          SELECT 1 FROM rehab_plans WHERE athlete_id = v_athlete_id AND is_active = true
        ) INTO v_has_active_plan;

        IF v_has_active_plan THEN
          RAISE EXCEPTION 'Este atleta já tem um plano de reabilitação ativo.';
        END IF;
      END IF;

      v_diagnosis_date := COALESCE(p_diagnosis_date, CURRENT_DATE);

      INSERT INTO diagnoses (
        athlete_id, org_id, osiics_code, osiics_description, diagnosis_type,
        custom_description, availability_status, load_management_restrictions,
        load_management_notes, diagnosed_by, occurrence_id,
        diagnosis_date, context, match_minute, mechanism, contact_type,
        player_action, foul_involved, body_region, body_side, tissue_type,
        is_recurrence, related_diagnosis_id, claim_filed
      ) VALUES (
        v_athlete_id, v_org_id, p_osiics_code, p_osiics_description, p_diagnosis_type,
        p_custom_description, p_availability_status, p_load_management_restrictions,
        p_load_management_notes, auth.uid(), p_occurrence_id,
        v_diagnosis_date, p_context, p_match_minute, p_mechanism, p_contact_type,
        p_player_action, p_foul_involved, p_body_region, p_body_side, p_tissue_type,
        COALESCE(p_is_recurrence, false), p_related_diagnosis_id, p_claim_filed
      );

      IF p_diagnosis_type = 'injury' THEN
        v_plan_title := COALESCE(p_osiics_description, p_custom_description, 'Lesão');

        INSERT INTO rehab_plans (
          athlete_id, org_id, occurrence_id, title, start_date, created_by
        ) VALUES (
          v_athlete_id, v_org_id, p_occurrence_id, v_plan_title, v_diagnosis_date, auth.uid()
        );
      END IF;
    END IF;
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
