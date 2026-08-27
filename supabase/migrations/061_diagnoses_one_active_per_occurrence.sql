-- Migration 061 — Enforce at most one active diagnosis per occurrence.
--
-- createDiagnosis's "one active diagnosis per occurrence" guard is a
-- read-then-insert check, not atomic — a race between two concurrent calls,
-- or a direct Data API write bypassing the app entirely, could still create
-- two active diagnoses linked to the same occurrence. OccurrenceRow only
-- ever renders/resolves the first one, and the athlete profile's fallback
-- list excludes every diagnosis whose occurrence is already shown inline —
-- so the second diagnosis would become invisible and unmanageable. A
-- partial unique index makes the invariant atomic, closing both the race
-- and the direct-write path.

CREATE UNIQUE INDEX IF NOT EXISTS diagnoses_one_active_per_occurrence
  ON diagnoses (occurrence_id)
  WHERE is_resolved = false AND occurrence_id IS NOT NULL;
