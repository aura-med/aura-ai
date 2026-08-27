-- Aura internal platform administration
-- Uses RLS-locked public tables so the server-only Supabase service client can
-- manage admin data through the default Supabase Data API. No anon/authenticated
-- policies are created for these tables.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'standard'
    CHECK (plan IN ('trial', 'standard', 'enterprise')),
  ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT
    '{"readiness": true, "rehab": true, "performance": true, "female_squad": true, "passport": true}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level        TEXT NOT NULL CHECK (level IN ('owner', 'admin', 'support', 'analyst')),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id     TEXT NOT NULL CHECK (length(trim(ticket_id)) >= 3),
  reason        TEXT NOT NULL CHECK (length(trim(reason)) >= 10),
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'ended')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  ended_at      TIMESTAMPTZ,
  ended_by      UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,
  target_type        TEXT,
  target_id          TEXT,
  org_id             UUID REFERENCES organizations(id) ON DELETE SET NULL,
  support_session_id UUID REFERENCES support_sessions(id) ON DELETE SET NULL,
  metadata           JSONB NOT NULL DEFAULT '{}',
  ip_hash            TEXT,
  user_agent_hash    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_platform_admins_active
  ON platform_admins (active, level);

CREATE INDEX IF NOT EXISTS idx_support_sessions_actor_status
  ON support_sessions (actor_user_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_sessions_org_status
  ON support_sessions (org_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created
  ON platform_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor
  ON platform_audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_org
  ON platform_audit_logs (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION expire_support_sessions()
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE support_sessions
  SET status = 'expired',
      ended_at = now()
  WHERE status = 'active'
    AND expires_at <= now();
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON support_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION expire_support_sessions() TO service_role;

REVOKE ALL ON platform_admins FROM anon, authenticated;
REVOKE ALL ON support_sessions FROM anon, authenticated;
REVOKE ALL ON platform_audit_logs FROM anon, authenticated;
REVOKE ALL ON FUNCTION expire_support_sessions() FROM anon, authenticated;
