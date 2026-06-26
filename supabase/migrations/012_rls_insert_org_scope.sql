-- Migration 012 — Scope diagnoses, medication, and orthosis INSERTs to athlete org
-- Same tenant-isolation gap as occurrence INSERT (fixed in 011): the policies only
-- validate the new row's own org_id, not that the referenced athlete belongs to it.

-- 1. Diagnoses INSERT: verify athlete (and linked occurrence) belong to clinician's org.
DROP POLICY IF EXISTS "doctor_write_diagnoses" ON diagnoses;

CREATE POLICY "doctor_write_diagnoses" ON diagnoses
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
    AND (
      occurrence_id IS NULL
      OR EXISTS (
        SELECT 1 FROM occurrences o
        WHERE o.id = occurrence_id AND o.org_id = get_user_org_id()
      )
    )
  );

-- 2. Medication administrations INSERT: verify athlete belongs to clinician's org.
DROP POLICY IF EXISTS "clinical_write_med_admin" ON medication_administrations;

CREATE POLICY "clinical_write_med_admin" ON medication_administrations
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
  );

-- 3. Orthosis records INSERT: verify athlete belongs to clinician's org.
DROP POLICY IF EXISTS "clinical_write_orthosis" ON orthosis_records;

CREATE POLICY "clinical_write_orthosis" ON orthosis_records
  FOR INSERT WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio', 'masseur')
    AND EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = athlete_id AND a.org_id = get_user_org_id()
    )
  );
