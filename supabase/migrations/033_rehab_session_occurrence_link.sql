-- Migration 033 — Link physio/rehab session log entries to an occurrence.
--
-- rehab_sessions is shared by two unrelated features (see 027): the RTP
-- protocol tracker (001: protocol_id/start_date/current_day/...) and the
-- physio session log (session_date/session_type/description/..., added
-- out-of-band — 008's CREATE TABLE IF NOT EXISTS was a no-op against 001's
-- table). This column belongs to the session-log side only; the RTP tracker
-- ignores it.

ALTER TABLE rehab_sessions
  ADD COLUMN IF NOT EXISTS occurrence_id UUID REFERENCES occurrences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rehab_sessions_occurrence ON rehab_sessions(occurrence_id);
