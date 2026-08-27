-- Migration 049 — Backfill occurrences.decision_source for existing rows.
--
-- 048's DEFAULT 'own' is correct going forward (every write path now sets
-- this column explicitly), but it mislabels every occurrence that already
-- existed before that migration ran — including ones whose current status
-- was actually last synchronized from a diagnosis or reassessment. Left
-- unfixed, the dashboard would show the occurrence's own (stale) title
-- instead of the real decision for those rows, and updateOccurrenceRecord's
-- decision_source = 'reassessment' check would refuse to propagate a
-- correction to a pre-migration reassessment that genuinely is still the
-- occurrence's current driver.
--
-- Best-effort reconstruction from existing data: compare each occurrence's
-- linked open diagnosis (updated_at ?? diagnosed_at) against its latest
-- occurrence_record (created_at) and take whichever is later — the same
-- comparison the application briefly used at runtime before decision_source
-- existed, now applied once as a one-time backfill rather than on every read.

UPDATE occurrences o
SET decision_source = CASE
  WHEN ld.at IS NOT NULL AND (lr.at IS NULL OR ld.at >= lr.at) THEN 'diagnosis'
  WHEN lr.at IS NOT NULL THEN 'reassessment'
  ELSE 'own'
END
FROM (SELECT id FROM occurrences) base
LEFT JOIN (
  SELECT occurrence_id, MAX(COALESCE(updated_at, diagnosed_at)) AS at
  FROM diagnoses
  WHERE occurrence_id IS NOT NULL AND is_resolved = false
  GROUP BY occurrence_id
) ld ON ld.occurrence_id = base.id
LEFT JOIN (
  SELECT occurrence_id, MAX(created_at) AS at
  FROM occurrence_records
  GROUP BY occurrence_id
) lr ON lr.occurrence_id = base.id
WHERE o.id = base.id
  AND (ld.at IS NOT NULL OR lr.at IS NOT NULL);
