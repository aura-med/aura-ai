-- Migration 011 — Tighten RLS read policies and scope occurrence inserts to athlete org

-- 1. Scope occurrence INSERT to verify the athlete belongs to the clinician's org.
--    The existing policy only checks org_id on the occurrence row itself, so a
--    clinician who knows a foreign athlete UUID can create cross-tenant records.
DROP POLICY IF EXISTS "clinical_write_occurrences" ON occurrences;

CREATE POLICY "clinical_write_occurrences" ON occurrences
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
  );

-- 2. Restrict SOAP-note tables to clinical roles only.
--    Coaches, athletes, and other org members can reach /occurrences or an
--    athlete profile URL directly; the sidebar link guard is not a security
--    boundary.  Add a role predicate to all clinical SELECT policies.

DROP POLICY IF EXISTS "org_read_occurrences" ON occurrences;

CREATE POLICY "org_read_occurrences" ON occurrences
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "org_read_occurrence_records" ON occurrence_records;

CREATE POLICY "org_read_occurrence_records" ON occurrence_records
  FOR SELECT USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM occurrences o
      WHERE o.id = occurrence_id AND o.org_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "org_read_med_admin" ON medication_administrations;

CREATE POLICY "org_read_med_admin" ON medication_administrations
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );

DROP POLICY IF EXISTS "org_read_orthosis" ON orthosis_records;

CREATE POLICY "org_read_orthosis" ON orthosis_records
  FOR SELECT USING (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
  );
