-- Migration 074 — Add the physio session-log columns to rehab_sessions.
--
-- rehab_sessions is shared, by name only, between two unrelated features (see
-- 027/033's own header comments, which already documented this exact gap):
--   1. The RTP protocol tracker (001_initial_schema.sql) — protocol_id,
--      start_date, current_day, rtp_criteria, clinical_data.
--   2. The physio/rehab session log on the Treatments tab
--      (008_treatments.sql, merged into 008_nationality.sql) —
--      session_date, session_type, duration_minutes, description,
--      clinician_name, notes.
-- 008 declared feature 2's columns via `CREATE TABLE IF NOT EXISTS
-- rehab_sessions (...)`. Since 001 already created the table, that whole
-- CREATE TABLE was a no-op — none of those columns were ever actually
-- added to it by any migration. Production has apparently had them added
-- out-of-band (directly, outside the tracked migration history — see 033's
-- comment), which is why the physio-log route has been working there, but
-- a fresh install (or any environment without that manual step) is left
-- with a rehab_sessions table missing every column the log route reads
-- and writes beyond id/athlete_id/created_at/updated_at.
--
-- Add them now with IF NOT EXISTS: a safe no-op wherever they already
-- exist (production), and the actual fix wherever they don't (fresh
-- installs). session_date is deliberately left nullable, not NOT NULL as
-- 008_treatments.sql originally declared it — same reasoning 027 already
-- used to relax start_date: this table's RTP-protocol rows (feature 1)
-- never set session_date, so a table-wide NOT NULL is meaningless for a
-- column that only feature 2 actually populates.

ALTER TABLE rehab_sessions
  ADD COLUMN IF NOT EXISTS session_date     DATE,
  ADD COLUMN IF NOT EXISTS session_type     TEXT NOT NULL DEFAULT 'physio',
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS clinician_name   TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT;
