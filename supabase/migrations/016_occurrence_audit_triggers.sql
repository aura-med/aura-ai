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
