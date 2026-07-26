-- Migration 016 — Force occurrence audit fields from the session.
-- RLS can't bind free-text audit columns, and the public Supabase API stays
-- writable with the user's session, so a client could bypass the server action
-- and insert an occurrence with a forged created_by / clinician_name /
-- clinician_role. A BEFORE INSERT trigger overwrites these with the caller's own
-- identity and profile, so SOAP notes and reports are always correctly attributed.

CREATE OR REPLACE FUNCTION set_occurrence_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT full_name, role INTO v_name, v_role
    FROM profiles WHERE id = auth.uid();

    NEW.created_by := auth.uid();
    IF TG_TABLE_NAME = 'occurrences' THEN
      NEW.clinician_name := v_name;
      NEW.clinician_role := v_role;
      -- Resolution audit must be derived, not client-supplied: a row inserted
      -- already resolved is attributed to the caller now; otherwise cleared.
      IF NEW.is_resolved THEN
        NEW.resolved_by := auth.uid();
        NEW.resolved_at := now();
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
        NEW.resolved_at := now();
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

DROP TRIGGER IF EXISTS trg_set_occurrence_audit ON occurrences;
CREATE TRIGGER trg_set_occurrence_audit
  BEFORE INSERT OR UPDATE ON occurrences
  FOR EACH ROW EXECUTE FUNCTION set_occurrence_audit();

DROP TRIGGER IF EXISTS trg_set_occurrence_record_audit ON occurrence_records;
CREATE TRIGGER trg_set_occurrence_record_audit
  BEFORE INSERT OR UPDATE ON occurrence_records
  FOR EACH ROW EXECUTE FUNCTION set_occurrence_audit();

-- Freeze immutable diagnosis fields on UPDATE. The diagnoses UPDATE policy grants
-- full-row writes, but the only intended existing-row change is resolution. A
-- direct-API caller could otherwise rewrite the author/timestamp/OSIICS fields or
-- move the diagnosis to another athlete; restore those from OLD so only resolution
-- fields (is_resolved/resolved_at/resolved_by), availability_status and notes change.
CREATE OR REPLACE FUNCTION freeze_diagnosis_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.athlete_id         := OLD.athlete_id;
  NEW.occurrence_id      := OLD.occurrence_id;
  NEW.org_id             := OLD.org_id;
  NEW.osiics_code        := OLD.osiics_code;
  NEW.osiics_description := OLD.osiics_description;
  NEW.diagnosis_type     := OLD.diagnosis_type;
  NEW.custom_description := OLD.custom_description;
  NEW.diagnosed_by       := OLD.diagnosed_by;
  NEW.diagnosed_at       := OLD.diagnosed_at;

  -- Resolution audit: without this a direct-API caller could resolve a
  -- diagnosis while attributing it to another user/timestamp. Derive the fields
  -- from the caller on the unresolved→resolved transition, and freeze them on
  -- any later update so an already-resolved diagnosis can't be reattributed.
  IF NEW.is_resolved AND NOT OLD.is_resolved THEN
    NEW.resolved_by := auth.uid();
    NEW.resolved_at := now();
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

DROP TRIGGER IF EXISTS trg_freeze_diagnosis_immutable ON diagnoses;
CREATE TRIGGER trg_freeze_diagnosis_immutable
  BEFORE UPDATE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION freeze_diagnosis_immutable();
