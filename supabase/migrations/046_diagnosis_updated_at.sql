-- Migration 046 — Add diagnoses.updated_at so edits are rankable.
--
-- diagnoses only had `diagnosed_at` (set once, at creation) — updateDiagnosis
-- never bumped any timestamp on the diagnosis row itself when editing it.
-- recomputeAthleteAvailability/recomputeAvailability rank open diagnoses by
-- `diagnosed_at` as an independent "most recent write wins" candidate, so an
-- edited diagnosis's status change never actually moved it up in that
-- ranking — for a standalone diagnosis (no occurrence_id) this could leave a
-- stale, lower ranking in place after a real edit; for a linked one, the
-- occurrence's own mirrored `updated_at` masked the gap. Also needed so
-- updateOccurrenceRecord can tell whether a diagnosis was edited (not just
-- created) after the reassessment it's about to resync from.

ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE diagnoses SET updated_at = diagnosed_at WHERE updated_at IS NULL;
ALTER TABLE diagnoses ALTER COLUMN updated_at SET DEFAULT now();
