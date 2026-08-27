-- M2 Server-First Platform: targeted RLS coverage for DTO-backed clinical reads.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatigue_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_passport ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;

CREATE POLICY organizations_member_select_m2
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

CREATE POLICY squads_member_select_m2
  ON squads FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY gps_sessions_member_select_m2
  ON gps_sessions FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY injury_events_member_select_m2
  ON injury_events FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY performance_data_member_select_m2
  ON performance_data FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY fatigue_profiles_member_select_m2
  ON fatigue_profiles FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY athlete_passport_member_select_m2
  ON athlete_passport FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY athlete_passport_clinical_update_m2
  ON athlete_passport FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY rehab_protocols_authenticated_select_m2
  ON rehab_protocols FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY rehab_sessions_clinical_write_m2
  ON rehab_sessions FOR ALL
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "004" (004_platform_admin_control.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: same reasoning as the 002 pair.
-- Merging into the file that already holds this version preserves the exact
-- original ordering relative to every other migration.
--
-- Caveat (Codex): if this version is ever marked "applied" via `migration
-- repair` (or any path other than actually running this exact file) on a
-- database that doesn't already have both halves' objects, this file will
-- be silently skipped by `db push` forever after and the missing objects
-- will never get created. Only safe to repair-baseline this version once
-- you've confirmed the target database already has everything below.
-- ─────────────────────────────────────────────────────────────────────────────

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
