-- Migration 022 — Squad-scope the medical-profile tables from 006.
--
-- 006 shipped these six tables with wide-open RLS: every policy was just
-- `auth.role() = 'authenticated'`, so ANY logged-in user could read/write ANY
-- athlete's medical records — across squads AND across tenants/orgs. 018
-- tightened gps/injury/performance/clinical tables but never touched these, so
-- the leak survived the squad-scoping migration.
--
-- Re-scope all reads/writes to the authoritative athletes.squad_id, mirroring
-- 018's clinical model: owners see their whole org; clinical staff (doctor,
-- physio, masseur) see only their assigned squads. Writes stay clinical-only.
-- These are sensitive medical records, so coaches are intentionally excluded
-- and no DELETE is granted (records remain non-deletable via the API).

-- ── athletes_medical_history ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_medical_history"   ON athletes_medical_history;
DROP POLICY IF EXISTS "auth_insert_medical_history" ON athletes_medical_history;
DROP POLICY IF EXISTS "auth_update_medical_history" ON athletes_medical_history;

DROP POLICY IF EXISTS "medical_history_read" ON athletes_medical_history;
CREATE POLICY "medical_history_read" ON athletes_medical_history FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "medical_history_insert" ON athletes_medical_history;
CREATE POLICY "medical_history_insert" ON athletes_medical_history FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "medical_history_update" ON athletes_medical_history;
CREATE POLICY "medical_history_update" ON athletes_medical_history FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── medical_documents ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_documents"   ON medical_documents;
DROP POLICY IF EXISTS "auth_insert_documents" ON medical_documents;

DROP POLICY IF EXISTS "documents_read" ON medical_documents;
CREATE POLICY "documents_read" ON medical_documents FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "documents_insert" ON medical_documents;
CREATE POLICY "documents_insert" ON medical_documents FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── medical_consultations ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_consultations"   ON medical_consultations;
DROP POLICY IF EXISTS "auth_insert_consultations" ON medical_consultations;
DROP POLICY IF EXISTS "auth_update_consultations" ON medical_consultations;

DROP POLICY IF EXISTS "consultations_read" ON medical_consultations;
CREATE POLICY "consultations_read" ON medical_consultations FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "consultations_insert" ON medical_consultations;
CREATE POLICY "consultations_insert" ON medical_consultations FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "consultations_update" ON medical_consultations;
CREATE POLICY "consultations_update" ON medical_consultations FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── emd_submissions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_emd"   ON emd_submissions;
DROP POLICY IF EXISTS "auth_insert_emd" ON emd_submissions;

DROP POLICY IF EXISTS "emd_read" ON emd_submissions;
CREATE POLICY "emd_read" ON emd_submissions FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "emd_insert" ON emd_submissions;
CREATE POLICY "emd_insert" ON emd_submissions FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── scat6_assessments ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_scat6"   ON scat6_assessments;
DROP POLICY IF EXISTS "auth_insert_scat6" ON scat6_assessments;
DROP POLICY IF EXISTS "auth_update_scat6" ON scat6_assessments;

DROP POLICY IF EXISTS "scat6_read" ON scat6_assessments;
CREATE POLICY "scat6_read" ON scat6_assessments FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "scat6_insert" ON scat6_assessments;
CREATE POLICY "scat6_insert" ON scat6_assessments FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "scat6_update" ON scat6_assessments;
CREATE POLICY "scat6_update" ON scat6_assessments FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ── rtp_protocol_tracking ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_read_rtp"   ON rtp_protocol_tracking;
DROP POLICY IF EXISTS "auth_insert_rtp" ON rtp_protocol_tracking;
DROP POLICY IF EXISTS "auth_update_rtp" ON rtp_protocol_tracking;

DROP POLICY IF EXISTS "rtp_read" ON rtp_protocol_tracking;
CREATE POLICY "rtp_read" ON rtp_protocol_tracking FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "rtp_insert" ON rtp_protocol_tracking;
CREATE POLICY "rtp_insert" ON rtp_protocol_tracking FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "rtp_update" ON rtp_protocol_tracking;
CREATE POLICY "rtp_update" ON rtp_protocol_tracking FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
