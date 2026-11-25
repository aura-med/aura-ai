-- Migration 098 — "Indisponível requires a diagnosis in the same action."
--
-- Today, concluding a reassessment as 'unavailable' (add_occurrence_record_
-- and_mirror, 070) has zero connection to diagnosis creation — "Adicionar
-- Diagnóstico" is a fully separate, optional, later button. The new clinical
-- flow makes this mandatory: a doctor or physio concluding a reassessment as
-- Indisponível must, in the same action, say whether it's an injury or a
-- disease and provide at least a minimal diagnosis.
--
-- Hybrid enforcement (user-confirmed): a new atomic RPC
-- (conclude_reassessment_with_diagnosis) inserts the diagnosis FIRST, then
-- the occurrence_record, then does the existing 070 mirror logic — AND a
-- new, immediate (not deferred — matches every other trigger in this
-- codebase, e.g. 054/055) trigger independently rejects any 'unavailable'
-- row with no active diagnosis linked to its occurrence, closing the gap
-- even for a direct Data API call that bypasses this RPC entirely.
--
-- Scoped to occurrence_records INSERT only — deliberately NOT occurrences
-- itself, and NOT UPDATE on either table. A genuinely new reassessment
-- that concludes Indisponível is exactly the one case the user asked to
-- gate; occurrences' own availability_status is also written by several
-- existing, already-careful administrative UPDATE paths that merely
-- *mirror* or *fall back to* a decision made elsewhere (070/069/067's own
-- mirror logic, and 080's resolve_diagnosis_and_cleanup, which can
-- deliberately revert an occurrence to its last reassessment's value right
-- after resolving the very diagnosis that covered it) — gating those too
-- would require threading a trusted-path bypass through four existing,
-- carefully-reasoned migrations for comparatively little benefit, since a
-- brand NEW unavailable reassessment (the actual gap) is fully closed by
-- this narrower trigger alone. updateOccurrence (068) directly setting
-- 'unavailable' without a diagnosis is a known, accepted residual gap —
-- correcting an occurrence's own historical fields is a materially
-- different action from concluding a fresh reassessment.
--
-- The existing create_diagnosis_and_mirror (069)/add_occurrence_record_and_
-- mirror (070) are untouched and still work exactly as before for every
-- other outcome — this is an additive, narrower path specifically for the
-- unavailable-with-diagnosis case.

CREATE OR REPLACE FUNCTION enforce_unavailable_requires_diagnosis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_diagnosis boolean;
BEGIN
  IF NEW.availability_status IS DISTINCT FROM 'unavailable' OR NEW.occurrence_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM diagnoses WHERE occurrence_id = NEW.occurrence_id AND is_resolved = false
  ) INTO v_has_diagnosis;

  IF NOT v_has_diagnosis THEN
    RAISE EXCEPTION 'Uma ocorrência só pode ficar Indisponível com um diagnóstico associado.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_unavailable_requires_diagnosis_records
  AFTER INSERT ON occurrence_records
  FOR EACH ROW EXECUTE FUNCTION enforce_unavailable_requires_diagnosis();

-- conclude_reassessment_with_diagnosis — one call, diagnosis-then-record.
-- Diagnosis fields are only required (NOT NULL enforced below) when
-- p_availability_status = 'unavailable'; for every other outcome they're
-- ignored and this behaves exactly like add_occurrence_record_and_mirror.
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
  -- Diagnosis fields (required only when p_availability_status = 'unavailable')
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
        COALESCE(p_diagnosis_date, CURRENT_DATE), p_context, p_match_minute, p_mechanism, p_contact_type,
        p_player_action, p_foul_involved, p_body_region, p_body_side, p_tissue_type,
        COALESCE(p_is_recurrence, false), p_related_diagnosis_id, p_claim_filed
      );
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
