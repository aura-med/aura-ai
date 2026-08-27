-- Migration 008 — Add nationality to athletes
ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS nationality TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "008" (008_treatments.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: 018_squad_scoped_access.sql (still at 018) replaces this file's global authenticated-only rehab_sessions policies — replaying them after 018 would re-widen access across squads.
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
