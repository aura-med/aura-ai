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
--
-- If the exact scenario above already happened on this database, some
-- occurrence already has more than one active diagnosis right now —
-- CREATE UNIQUE INDEX would fail outright on that pre-existing violation
-- and abort. Resolve every duplicate but the most recently
-- updated/diagnosed one in each group first (data is preserved, not
-- deleted — just no longer counted as "active"), so the index can always
-- be created regardless of prior data.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY occurrence_id
      ORDER BY COALESCE(updated_at, diagnosed_at) DESC, id DESC
    ) AS rn
  FROM diagnoses
  WHERE is_resolved = false AND occurrence_id IS NOT NULL
)
UPDATE diagnoses d
SET is_resolved = true, resolved_at = now()
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS diagnoses_one_active_per_occurrence
  ON diagnoses (occurrence_id)
  WHERE is_resolved = false AND occurrence_id IS NOT NULL;
