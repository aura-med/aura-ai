-- Migration 050 — Correct 049's backfill: preserve 'own' for direct edits.
--
-- 049's CASE always picked 'diagnosis' or 'reassessment' whenever either
-- existed, never considering that a direct edit via updateOccurrence could
-- have happened AFTER both — the occurrence's own updated_at is then the
-- true latest event, but 049 would still mislabel it. Re-run the backfill,
-- this time keeping 'own' whenever the occurrence's own timestamp leads both
-- linked sources by more than a few seconds (the same tolerance the
-- application briefly used at runtime before decision_source existed — fine
-- here since this is a one-time historical reconstruction, not the ongoing
-- derivation, which is now exact going forward).

UPDATE occurrences o
SET decision_source = CASE
  WHEN ld.at IS NOT NULL AND (lr.at IS NULL OR ld.at >= lr.at)
       AND o.updated_at - ld.at < interval '5 seconds' THEN 'diagnosis'
  WHEN lr.at IS NOT NULL
       AND o.updated_at - lr.at < interval '5 seconds' THEN 'reassessment'
  ELSE 'own'
END
FROM (SELECT id, updated_at FROM occurrences) base
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
