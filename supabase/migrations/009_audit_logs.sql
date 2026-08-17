-- GDPR Art. 32 audit trail — append-only access log for sensitive personal data.
-- Written by the service-role client only (no INSERT policy for authenticated users).

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                              -- NULL for system events
  user_email    TEXT        NOT NULL,
  org_id        UUID        REFERENCES organizations(id),
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owners can read their org's logs; no other roles can.
-- (Uses 'owner' — migration 017 renames the legacy 'admin' role to 'owner'
-- and drops 'admin' from the role CHECK, so 'admin' would never match here.
-- Note: 017 supersedes this policy by renaming it to audit_logs_owner_select,
-- so re-running this migration after 017 is optional.)
DROP POLICY IF EXISTS audit_logs_admin_select ON audit_logs;
CREATE POLICY audit_logs_admin_select ON audit_logs
  FOR SELECT
  USING (org_id = get_user_org_id() AND get_user_role() = 'owner');

-- No INSERT / UPDATE / DELETE policies → service role writes only;
-- immutability guaranteed at the RLS layer

CREATE INDEX IF NOT EXISTS idx_audit_logs_org    ON audit_logs (org_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action,  created_at DESC);
