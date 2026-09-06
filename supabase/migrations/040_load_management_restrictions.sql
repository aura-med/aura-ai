-- Migration 040 — Structured load-management restrictions + free-text notes.
--
-- When a clinician sets availability_status = 'load_management' on an
-- occurrence/reassessment/diagnosis, they also need to say WHAT is
-- restricted — a fixed checklist (volume/sprints/HSR/acc-dec/change of
-- direction) the fitness coach can scan at a glance, plus a free-text note
-- for anything specific. Added to all three places availability_status
-- already lives (038), so the same "current row carries the current
-- reason" pattern already used for availability_status extends naturally.

ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS load_management_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS load_management_notes text;

ALTER TABLE occurrence_records
  ADD COLUMN IF NOT EXISTS load_management_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS load_management_notes text;

ALTER TABLE diagnoses
  ADD COLUMN IF NOT EXISTS load_management_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS load_management_notes text;
