-- Migration 100 — Discharge with an optional secondary-prevention note (B6).
--
-- injury_events.notes already exists but is the legacy RecordInjuryModal
-- flow's general clinical-notes field (set at the time the injury is first
-- recorded) — a distinct purpose from a discharge-time recommendation. A
-- dedicated column keeps the two from colliding.
ALTER TABLE injury_events
  ADD COLUMN secondary_prevention_note text;

CREATE OR REPLACE FUNCTION public.resolve_diagnosis_and_cleanup(
  p_diagnosis_id uuid,
  p_resolved_at date DEFAULT NULL,
  p_secondary_prevention_note text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, athlete_id uuid, occurrence_id uuid, org_id uuid, osiics_code text,
  osiics_description text, diagnosis_type text, custom_description text,
  availability_status text, load_management_restrictions text[], load_management_notes text,
  diagnosed_by uuid, diagnosed_at timestamptz, is_resolved boolean, resolved_at timestamptz,
  resolved_by uuid, resolution_status text, notes text, created_at timestamptz,
  updated_at timestamptz, occurrence_date date
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_predicted_occurrence_id uuid;
  v_diagnosis diagnoses;
  v_fallback_record occurrence_records;
  v_occurrence_date date;
  v_injury_date date;
  v_return_date date;
  v_days_absent int;
  v_severity text;
  v_confirmed_by text;
BEGIN
  IF p_resolved_at IS NOT NULL THEN
    IF p_resolved_at > CURRENT_DATE THEN
      RAISE EXCEPTION 'A data de resolução não pode ser no futuro.';
    END IF;
    PERFORM set_config('app.trusted_resolved_at', p_resolved_at::text, true);
  END IF;

  SELECT d.occurrence_id INTO v_predicted_occurrence_id
  FROM diagnoses d
  WHERE d.id = p_diagnosis_id;

  IF v_predicted_occurrence_id IS NOT NULL THEN
    PERFORM 1 FROM occurrences o WHERE o.id = v_predicted_occurrence_id FOR UPDATE;
  END IF;

  UPDATE diagnoses d
  SET is_resolved = true, resolved_by = auth.uid()
  WHERE d.id = p_diagnosis_id AND d.is_resolved = false
  RETURNING d.* INTO v_diagnosis;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_diagnosis.occurrence_id IS NOT NULL
     AND v_diagnosis.occurrence_id IS DISTINCT FROM v_predicted_occurrence_id THEN
    PERFORM 1 FROM occurrences o WHERE o.id = v_diagnosis.occurrence_id FOR UPDATE;
  END IF;

  IF v_diagnosis.occurrence_id IS NOT NULL THEN
    SELECT o.occurrence_date INTO v_occurrence_date
    FROM occurrences o
    WHERE o.id = v_diagnosis.occurrence_id;

    SELECT * INTO v_fallback_record
    FROM occurrence_records r
    WHERE r.occurrence_id = v_diagnosis.occurrence_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE occurrences o
      SET
        availability_status = v_fallback_record.availability_status,
        load_management_restrictions = v_fallback_record.load_management_restrictions,
        load_management_notes = v_fallback_record.load_management_notes,
        updated_at = v_fallback_record.created_at,
        decision_source = 'reassessment'
      WHERE o.id = v_diagnosis.occurrence_id AND o.decision_source = 'diagnosis' AND o.is_resolved = false;
    ELSE
      UPDATE occurrences o
      SET
        availability_status = 'available',
        load_management_restrictions = '{}',
        load_management_notes = NULL,
        decision_source = 'own'
      WHERE o.id = v_diagnosis.occurrence_id AND o.decision_source = 'diagnosis' AND o.is_resolved = false;
    END IF;
  END IF;

  IF v_diagnosis.diagnosis_type = 'injury' THEN
    v_injury_date := COALESCE(v_diagnosis.diagnosis_date, v_occurrence_date, v_diagnosis.diagnosed_at::date);
    v_return_date := COALESCE(v_diagnosis.resolved_at::date, CURRENT_DATE);
    v_days_absent := GREATEST(0, v_return_date - v_injury_date);
    v_severity := CASE
      WHEN v_days_absent > 84 THEN 'severe'
      WHEN v_days_absent > 28 THEN 'major'
      WHEN v_days_absent > 7 THEN 'moderate'
      ELSE 'minor'
    END;

    SELECT p.full_name INTO v_confirmed_by FROM profiles p WHERE p.id = auth.uid();

    INSERT INTO injury_events (
      athlete_id, injury_date, return_date, diagnosis, osiics_code,
      severity, days_absent, is_recurrence, confirmed_by, secondary_prevention_note
    ) VALUES (
      v_diagnosis.athlete_id, v_injury_date, v_return_date,
      COALESCE(v_diagnosis.osiics_description, v_diagnosis.custom_description, 'Diagnóstico sem descrição'),
      v_diagnosis.osiics_code, v_severity, v_days_absent, v_diagnosis.is_recurrence, v_confirmed_by, p_secondary_prevention_note
    );
  END IF;

  RETURN QUERY SELECT
    v_diagnosis.id, v_diagnosis.athlete_id, v_diagnosis.occurrence_id, v_diagnosis.org_id,
    v_diagnosis.osiics_code, v_diagnosis.osiics_description, v_diagnosis.diagnosis_type, v_diagnosis.custom_description,
    v_diagnosis.availability_status, v_diagnosis.load_management_restrictions, v_diagnosis.load_management_notes,
    v_diagnosis.diagnosed_by, v_diagnosis.diagnosed_at,
    v_diagnosis.is_resolved, v_diagnosis.resolved_at, v_diagnosis.resolved_by, v_diagnosis.resolution_status,
    v_diagnosis.notes, v_diagnosis.created_at, v_diagnosis.updated_at,
    v_occurrence_date;
END;
$function$;
