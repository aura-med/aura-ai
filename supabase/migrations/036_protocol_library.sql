-- ─── 036 — Protocol Library ────────────────────────────────────────────────
-- Adds org scoping to rehab_protocols so Sophi can publish evidence-based
-- base templates (org_id NULL / is_template TRUE) while clubs can fork and
-- customise their own copies (org_id = their org, is_template FALSE).
-- Adds the OSIICS → protocol mapping table for auto-suggestion on diagnosis.

-- 1. Extend rehab_protocols ─────────────────────────────────────────────────
ALTER TABLE rehab_protocols
  ADD COLUMN IF NOT EXISTS org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_template     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_days_min int,
  ADD COLUMN IF NOT EXISTS return_days_max int;

COMMENT ON COLUMN rehab_protocols.org_id IS
  'NULL = Sophi base template (visible to all, not editable by clubs). '
  'Set to org uuid for club-specific copies.';

COMMENT ON COLUMN rehab_protocols.is_template IS
  'TRUE = Sophi-owned protocol; clubs can read but not write. '
  'Clubs fork templates to get an editable copy.';

-- 2. Mark all existing rows as Sophi templates ──────────────────────────────
UPDATE rehab_protocols SET is_template = true WHERE org_id IS NULL;

-- 3. OSIICS → protocol mapping (many-to-many) ───────────────────────────────
-- One OSIICS code may map to multiple protocols (e.g. grade I vs grade II).
-- One protocol may cover multiple OSIICS codes (e.g. similar structures).
CREATE TABLE IF NOT EXISTS osiics_protocol_map (
  osiics_code  text NOT NULL,
  protocol_id  uuid NOT NULL REFERENCES rehab_protocols(id) ON DELETE CASCADE,
  severity     text CHECK (severity IN ('mild', 'moderate', 'severe', 'post_surgical')),
  priority     int  NOT NULL DEFAULT 1,  -- 1 = first suggestion shown
  PRIMARY KEY  (osiics_code, protocol_id)
);

COMMENT ON TABLE osiics_protocol_map IS
  'Maps OSIICS diagnostic codes to recommended rehab protocols. '
  'Used to auto-suggest a protocol when a doctor files a diagnosis.';

-- 4. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE osiics_protocol_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_osiics_map" ON osiics_protocol_map;
CREATE POLICY "read_osiics_map" ON osiics_protocol_map
  FOR SELECT TO authenticated USING (true);

-- All authenticated users read Sophi templates + their org's protocols.
DROP POLICY IF EXISTS "authenticated_read_protocols" ON rehab_protocols;
CREATE POLICY "authenticated_read_protocols" ON rehab_protocols
  FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

-- Clubs can manage their own non-template protocols only.
DROP POLICY IF EXISTS "org_write_protocols" ON rehab_protocols;
CREATE POLICY "org_write_protocols" ON rehab_protocols
  FOR ALL TO authenticated
  USING (
    is_template = false
    AND org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    is_template = false
    AND org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  );
