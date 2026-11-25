-- Migration 094 — Injury characterization fields + backdatable resolution.
--
-- Two independent changes bundled together because both touch the same
-- occurrences/diagnoses resolution path:
--
-- 1. Injury characterization (FIFA/UEFA consensus-aligned, phase 1 — no
--    exposure/denominator data yet, that depends on the future GPS/
--    performance module). New, all-nullable columns on diagnoses (not
--    occurrences — it's the doctor who characterizes the injury at the
--    point of diagnosis, not the clinician opening the occurrence):
--    context, match_minute, mechanism, contact_type, player_action,
--    foul_involved, body_region, body_side, tissue_type, is_recurrence,
--    related_diagnosis_id, claim_filed. Nullable/default-false so no
--    existing row or insert path breaks.
--
-- 2. Backdating. Two sub-problems:
--    a) diagnoses has no clinical date distinct from diagnosed_at, which is
--       an immutable authorship/audit timestamp (set once on INSERT by
--       set_diagnosis_author (020), frozen on every UPDATE by
--       freeze_diagnosis_immutable (016/071)) — never meant to be backdated,
--       since it answers "when was this row authored," not "when did this
--       happen." Add a separate, ordinary, editable diagnosis_date.
--    b) resolved_at (occurrences AND diagnoses) is unconditionally forced to
--       now() by set_occurrence_audit (016) / freeze_diagnosis_immutable
--       (016/071) on the unresolved→resolved transition, "by design" (see
--       016's own comments) — a direct Data API caller must never be able to
--       forge a resolution date. The clinical need here is real (manual
--       historical backfill, especially for the Sub-23 squad whose past
--       records the club doesn't otherwise have access to) but must stay
--       narrow: a new transaction-local GUC, app.trusted_resolved_at, lets
--       ONLY the two RPCs below (resolve_occurrence_with_date,
--       resolve_diagnosis_and_cleanup) supply a backdated value; both set it
--       immediately before their own resolving UPDATE, in the same
--       transaction/function body. A raw Data API caller has no way to set a
--       server-side GUC, so every other path still gets now() exactly as
--       before. Mirrors the app.trusted_diagnosis_edit pattern 071 already
--       uses for the same reason.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Injury characterization columns on diagnoses
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE diagnoses
  ADD COLUMN IF NOT EXISTS context text
    CHECK (context IN ('training', 'match', 'outside_activity')),
  ADD COLUMN IF NOT EXISTS match_minute integer
    CHECK (match_minute IS NULL OR match_minute BETWEEN 0 AND 130),
  ADD COLUMN IF NOT EXISTS mechanism text
    CHECK (mechanism IN ('traumatic', 'overuse')),
  ADD COLUMN IF NOT EXISTS contact_type text
    CHECK (contact_type IN ('direct_contact', 'indirect_contact', 'non_contact')),
  ADD COLUMN IF NOT EXISTS player_action text
    CHECK (player_action IN ('sprint', 'deceleration', 'jump_landing', 'shoot_pass', 'tackle', 'change_of_direction', 'other')),
  ADD COLUMN IF NOT EXISTS foul_involved boolean,
  ADD COLUMN IF NOT EXISTS body_region text
    CHECK (body_region IN ('head_face', 'neck', 'trunk_spine', 'shoulder_arm', 'hip_groin', 'thigh', 'knee', 'lower_leg', 'ankle', 'foot')),
  ADD COLUMN IF NOT EXISTS body_side text
    CHECK (body_side IN ('left', 'right', 'bilateral')),
  ADD COLUMN IF NOT EXISTS tissue_type text
    CHECK (tissue_type IN ('muscle_tendon', 'ligament', 'bone', 'joint_cartilage', 'nerve', 'skin')),
  ADD COLUMN IF NOT EXISTS is_recurrence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_diagnosis_id uuid REFERENCES diagnoses(id),
  ADD COLUMN IF NOT EXISTS claim_filed boolean;

COMMENT ON COLUMN diagnoses.context IS 'FIFA/UEFA consensus: exposure context the injury occurred in.';
COMMENT ON COLUMN diagnoses.mechanism IS 'traumatic = identifiable single event (acute); overuse = gradual onset, no single event.';
COMMENT ON COLUMN diagnoses.contact_type IS 'Only meaningful when mechanism = traumatic.';
COMMENT ON COLUMN diagnoses.match_minute IS 'Only meaningful when context = match.';
COMMENT ON COLUMN diagnoses.related_diagnosis_id IS 'When is_recurrence, the prior diagnosis this is a recurrence of. Recurrence window (early/late/delayed) is derived from the two dates, not stored.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2a. diagnoses.diagnosis_date — separate from the immutable diagnosed_at
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS diagnosis_date date;

-- Backfill existing rows from their own authorship timestamp, then make it
-- NOT NULL with a today default so every future insert path (even one that
-- doesn't pass it yet) keeps working exactly as before.
UPDATE diagnoses SET diagnosis_date = diagnosed_at::date WHERE diagnosis_date IS NULL;
ALTER TABLE diagnoses ALTER COLUMN diagnosis_date SET DEFAULT CURRENT_DATE;
ALTER TABLE diagnoses ALTER COLUMN diagnosis_date SET NOT NULL;

COMMENT ON COLUMN diagnoses.diagnosis_date IS 'Clinical date of the diagnosis — editable, unlike diagnosed_at (authorship/audit timestamp, frozen after creation).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2b. Trusted backdated resolved_at — trigger changes
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_occurrence_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_trusted_resolved_at text;
BEGIN
  v_trusted_resolved_at := nullif(current_setting('app.trusted_resolved_at', true), '');

  IF TG_OP = 'INSERT' THEN
    SELECT full_name, role INTO v_name, v_role
    FROM profiles WHERE id = auth.uid();

    NEW.created_by := auth.uid();
    IF TG_TABLE_NAME = 'occurrences' THEN
      NEW.clinician_name := v_name;
      NEW.clinician_role := v_role;
      -- Resolution audit must be derived, not client-supplied in general —
      -- except for a backdated date explicitly trusted via the GUC above,
      -- settable only by the narrow RPCs in this migration.
      IF NEW.is_resolved THEN
        NEW.resolved_by := auth.uid();
        NEW.resolved_at := COALESCE(v_trusted_resolved_at::timestamptz, now());
      ELSE
        NEW.resolved_by := NULL;
        NEW.resolved_at := NULL;
      END IF;
    ELSIF TG_TABLE_NAME = 'occurrence_records' THEN
      NEW.clinician_name := v_name;
    END IF;
  ELSE
    -- On UPDATE, freeze the audit fields: an existing SOAP note can't be
    -- reassigned to another clinician after creation.
    NEW.created_by := OLD.created_by;
    IF TG_TABLE_NAME = 'occurrences' THEN
      NEW.clinician_name := OLD.clinician_name;
      NEW.clinician_role := OLD.clinician_role;
      -- Freeze the subject: the 018 UPDATE policy would otherwise allow moving
      -- an occurrence to another in-scope athlete, orphaning its dated
      -- occurrence_records (which keep the original athlete_id).
      NEW.athlete_id := OLD.athlete_id;
      NEW.org_id := OLD.org_id;
      NEW.squad_id := OLD.squad_id;
      -- Derive the resolution audit on the unresolved→resolved transition and
      -- freeze it once set, so the resolver identity/time can't be forged or
      -- reattributed through a direct Data API update.
      IF NEW.is_resolved AND NOT COALESCE(OLD.is_resolved, false) THEN
        NEW.resolved_by := auth.uid();
        NEW.resolved_at := COALESCE(v_trusted_resolved_at::timestamptz, now());
      ELSIF COALESCE(OLD.is_resolved, false) THEN
        -- Already resolved: keep it resolved and freeze the audit. Allowing an
        -- un-resolve here would let a caller reopen then re-resolve to
        -- reattribute the resolution.
        NEW.is_resolved := true;
        NEW.resolved_by := OLD.resolved_by;
        NEW.resolved_at := OLD.resolved_at;
      ELSE
        NEW.resolved_by := NULL;
        NEW.resolved_at := NULL;
      END IF;
    ELSIF TG_TABLE_NAME = 'occurrence_records' THEN
      NEW.clinician_name := OLD.clinician_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION freeze_diagnosis_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_trusted_resolved_at text;
BEGIN
  v_trusted_resolved_at := nullif(current_setting('app.trusted_resolved_at', true), '');

  NEW.athlete_id   := OLD.athlete_id;
  NEW.org_id       := OLD.org_id;
  NEW.diagnosed_by := OLD.diagnosed_by;
  NEW.diagnosed_at := OLD.diagnosed_at;

  IF current_setting('app.trusted_diagnosis_edit', true) IS DISTINCT FROM 'true' THEN
    NEW.occurrence_id      := OLD.occurrence_id;
    NEW.osiics_code        := OLD.osiics_code;
    NEW.osiics_description := OLD.osiics_description;
    NEW.diagnosis_type     := OLD.diagnosis_type;
    NEW.custom_description := OLD.custom_description;
  END IF;

  -- Resolution audit: derived, except for a backdated date explicitly
  -- trusted via app.trusted_resolved_at (settable only by
  -- resolve_diagnosis_and_cleanup in this same migration).
  IF NEW.is_resolved AND NOT OLD.is_resolved THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := COALESCE(v_trusted_resolved_at::timestamptz, now());
  ELSIF OLD.is_resolved THEN
    -- Already resolved: keep it resolved and freeze the audit, so it can't be
    -- reopened and re-resolved to reattribute the resolution.
    NEW.is_resolved := true;
    NEW.resolved_by := OLD.resolved_by;
    NEW.resolved_at := OLD.resolved_at;
  ELSE
    -- Still unresolved — keep the resolution audit cleared.
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2c. resolve_occurrence_with_date — new RPC, replaces resolveOccurrence's
--     direct .update() call. SECURITY INVOKER (default, no DEFINER here):
--     the existing clinical_update_occurrences RLS policy still gates who
--     may call this, exactly as it gated the direct .update() before.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_occurrence_with_date(
  p_occurrence_id uuid,
  p_resolution_status text,
  p_resolved_at date DEFAULT NULL
)
RETURNS SETOF occurrences
LANGUAGE plpgsql
AS $$
DECLARE
  v_row occurrences;
BEGIN
  IF p_resolved_at IS NOT NULL THEN
    PERFORM set_config('app.trusted_resolved_at', p_resolved_at::text, true);
  END IF;

  UPDATE occurrences o
  SET is_resolved = true, availability_status = p_resolution_status, updated_at = now()
  WHERE o.id = p_occurrence_id AND o.is_resolved = false
  RETURNING o.* INTO v_row;

  IF FOUND THEN
    RETURN NEXT v_row;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2d. resolve_diagnosis_and_cleanup — add an optional backdated resolved_at.
--     Body is otherwise identical to 080; only the signature and the new
--     set_config call change. The RETURNING on the diagnoses UPDATE below
--     no longer pins resolved_at = now() itself — the trigger derives it
--     (via the GUC, when set) exactly as for a non-backdated resolve.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_diagnosis_and_cleanup(
  p_diagnosis_id uuid,
  p_resolved_at date DEFAULT NULL
)
RETURNS TABLE (
  id uuid, athlete_id uuid, occurrence_id uuid, org_id uuid,
  osiics_code text, osiics_description text, diagnosis_type text, custom_description text,
  availability_status text, load_management_restrictions text[], load_management_notes text,
  diagnosed_by uuid, diagnosed_at timestamptz,
  is_resolved boolean, resolved_at timestamptz, resolved_by uuid, resolution_status text,
  notes text, created_at timestamptz, updated_at timestamptz,
  occurrence_date date
)
LANGUAGE plpgsql
AS $$
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
    v_injury_date := COALESCE(v_occurrence_date, v_diagnosis.diagnosis_date, v_diagnosis.diagnosed_at::date);
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
      severity, days_absent, is_recurrence, confirmed_by
    ) VALUES (
      v_diagnosis.athlete_id, v_injury_date, v_return_date,
      COALESCE(v_diagnosis.osiics_description, v_diagnosis.custom_description, 'Diagnóstico sem descrição'),
      v_diagnosis.osiics_code, v_severity, v_days_absent, false, v_confirmed_by
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
$$;
