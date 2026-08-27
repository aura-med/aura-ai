-- Migration 048 — Track WHICH source last decided an occurrence's status.
--
-- Several rounds of fixes tried to infer "was this occurrence's status last
-- set by its own direct edit, a linked diagnosis, or a reassessment" purely
-- from comparing timestamps across the three tables (all of which mirror
-- onto occurrences.updated_at within the same request) — a fundamentally
-- unreliable signal: a genuinely later direct edit landing within the same
-- few seconds as an unrelated mirror write is indistinguishable from that
-- mirror write itself using timestamps alone.
--
-- Track the source explicitly instead. Each of the three write paths
-- (updateOccurrence's direct edit, createDiagnosis/updateDiagnosis's mirror,
-- addOccurrenceRecord's mirror) now sets this column to say who it was.

ALTER TABLE occurrences
  ADD COLUMN IF NOT EXISTS decision_source text NOT NULL DEFAULT 'own'
  CHECK (decision_source IN ('own', 'diagnosis', 'reassessment'));
