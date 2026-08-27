-- Migration 050 — Correct 049's backfill: preserve 'own' for direct edits.
--
-- 049's CASE always picked 'diagnosis' or 'reassessment' whenever either
-- existed, never considering that a direct edit via updateOccurrence could
-- have happened AFTER both — the occurrence's own updated_at is then the
-- true latest event, but 049 would still mislabel it.
--
-- The first version of this fix (superseded here) picked 'own' whenever the
-- occurrence's updated_at led both linked sources by more than 5 seconds.
-- Codex correctly flagged that as unsound: a mirror write is two separate
-- statements (insert diagnosis/record, then update occurrence), and under
-- real latency the gap between them can exceed 5 seconds with no direct
-- edit ever happening — mislabeling a legitimately-mirrored row as 'own'.
--
-- Backfill from a durable, timing-independent invariant instead: a mirror
-- write always copies availability_status/load_management_restrictions/
-- load_management_notes verbatim onto the occurrence (see createDiagnosis,
-- updateDiagnosis, addOccurrenceRecord, updateOccurrenceRecord in the app
-- code). So the occurrence's current values either still match its latest
-- linked diagnosis/reassessment's own values (the mirror still stands) or
-- they don't (a direct edit changed them afterward) — no clock comparison
-- needed. If both sources happen to match (e.g. both left the occurrence at
-- its untouched default), recency is only used to break that tie, not to
-- manufacture an 'own' verdict.

WITH latest_diagnosis AS (
  SELECT DISTINCT ON (occurrence_id)
    occurrence_id, availability_status, load_management_restrictions,
    load_management_notes, COALESCE(updated_at, diagnosed_at) AS at
  FROM diagnoses
  WHERE occurrence_id IS NOT NULL AND is_resolved = false
  ORDER BY occurrence_id, COALESCE(updated_at, diagnosed_at) DESC
),
latest_reassessment AS (
  SELECT DISTINCT ON (occurrence_id)
    occurrence_id, availability_status, load_management_restrictions,
    load_management_notes, created_at AS at
  FROM occurrence_records
  ORDER BY occurrence_id, created_at DESC
),
classified AS (
  SELECT
    o.id,
    ld.at AS ld_at,
    lr.at AS lr_at,
    (ld.occurrence_id IS NOT NULL
      AND o.availability_status IS NOT DISTINCT FROM ld.availability_status
      AND o.load_management_restrictions = ld.load_management_restrictions
      AND o.load_management_notes IS NOT DISTINCT FROM ld.load_management_notes
    ) AS matches_diagnosis,
    (lr.occurrence_id IS NOT NULL
      AND o.availability_status IS NOT DISTINCT FROM lr.availability_status
      AND o.load_management_restrictions = lr.load_management_restrictions
      AND o.load_management_notes IS NOT DISTINCT FROM lr.load_management_notes
    ) AS matches_reassessment
  FROM occurrences o
  LEFT JOIN latest_diagnosis ld ON ld.occurrence_id = o.id
  LEFT JOIN latest_reassessment lr ON lr.occurrence_id = o.id
  WHERE ld.occurrence_id IS NOT NULL OR lr.occurrence_id IS NOT NULL
)
UPDATE occurrences o
SET decision_source = CASE
  WHEN c.matches_diagnosis AND c.matches_reassessment
    THEN CASE WHEN c.ld_at >= c.lr_at THEN 'diagnosis' ELSE 'reassessment' END
  WHEN c.matches_diagnosis THEN 'diagnosis'
  WHEN c.matches_reassessment THEN 'reassessment'
  ELSE 'own'
END
FROM classified c
WHERE o.id = c.id;
