-- Migration 020 — Bind clinical author/audit fields on INSERT.
-- The server actions derive these fields, but the public Supabase API stays
-- writable with the user's session, so a direct-API caller could insert a
-- diagnosis/medication/orthosis attributed to another clinician or time. The
-- 016 immutable trigger only freezes on UPDATE. These BEFORE INSERT triggers
-- overwrite the audit fields with the caller's own identity/profile.

-- Diagnoses: author + timestamp.
CREATE OR REPLACE FUNCTION set_diagnosis_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.diagnosed_by := auth.uid();
  NEW.diagnosed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_diagnosis_author ON diagnoses;
CREATE TRIGGER trg_set_diagnosis_author
  BEFORE INSERT ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION set_diagnosis_author();

-- Medication administrations: administrator id + display name (administered_at
-- stays client-set — it's the real clinical time the medication was given).
CREATE OR REPLACE FUNCTION set_medication_admin_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.administered_by := auth.uid();
  NEW.administered_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_medication_admin_author ON medication_administrations;
CREATE TRIGGER trg_set_medication_admin_author
  BEFORE INSERT ON medication_administrations
  FOR EACH ROW EXECUTE FUNCTION set_medication_admin_author();

-- Orthosis records: the registrar's name (applied_by_name stays free text — it
-- can legitimately be a different person who applied the orthosis).
CREATE OR REPLACE FUNCTION set_orthosis_registrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.registered_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_orthosis_registrar ON orthosis_records;
CREATE TRIGGER trg_set_orthosis_registrar
  BEFORE INSERT ON orthosis_records
  FOR EACH ROW EXECUTE FUNCTION set_orthosis_registrar();

-- The INSERT triggers above only bind the author on creation, but the UPDATE
-- policies still permit full-row writes, so a direct-API caller could edit an
-- existing record and reattribute it. Freeze the derived audit identities on
-- UPDATE (administered_at / applied_by_name stay editable — they are real
-- clinical facts, not the acting user's identity).
CREATE OR REPLACE FUNCTION freeze_medication_admin_author()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.administered_by := OLD.administered_by;
  NEW.administered_by_name := OLD.administered_by_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_medication_admin_author ON medication_administrations;
CREATE TRIGGER trg_freeze_medication_admin_author
  BEFORE UPDATE ON medication_administrations
  FOR EACH ROW EXECUTE FUNCTION freeze_medication_admin_author();

CREATE OR REPLACE FUNCTION freeze_orthosis_registrar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.registered_by_name := OLD.registered_by_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_orthosis_registrar ON orthosis_records;
CREATE TRIGGER trg_freeze_orthosis_registrar
  BEFORE UPDATE ON orthosis_records
  FOR EACH ROW EXECUTE FUNCTION freeze_orthosis_registrar();
