-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Treatments tab
--   • rehab_sessions table (physiotherapy / rehab sessions)
--   • orthotics JSONB column on athletes_medical_history
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Rehab sessions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rehab_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_date     DATE NOT NULL,
  session_type     TEXT NOT NULL DEFAULT 'physio',   -- physio | gym | pool | field | other
  duration_minutes INT,
  description      TEXT,
  clinician_name   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rehab_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_rehab_sessions" ON rehab_sessions;
CREATE POLICY "auth_read_rehab_sessions"
  ON rehab_sessions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_insert_rehab_sessions" ON rehab_sessions;
CREATE POLICY "auth_insert_rehab_sessions"
  ON rehab_sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_update_rehab_sessions" ON rehab_sessions;
CREATE POLICY "auth_update_rehab_sessions"
  ON rehab_sessions FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_delete_rehab_sessions" ON rehab_sessions;
CREATE POLICY "auth_delete_rehab_sessions"
  ON rehab_sessions FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── Orthotics column ──────────────────────────────────────────────────────────

ALTER TABLE athletes_medical_history
  ADD COLUMN IF NOT EXISTS orthotics JSONB NOT NULL DEFAULT '[]'::jsonb;
