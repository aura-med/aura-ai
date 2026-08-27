-- Migration 063 — Atomic "is this still the latest reassessment" resync.
--
-- updateOccurrenceRecord (app/(dashboard)/occurrences/actions.ts) corrects an
-- existing reassessment and, only when it's still the most recently created
-- one for its occurrence AND still the occurrence's decision_source, mirrors
-- the correction onto the parent occurrence/athlete. Until now that "is it
-- still latest" check and the mirroring update were two separate round
-- trips: SELECT the latest occurrence_record, then (if it matched) UPDATE
-- occurrences. If another clinician logged a genuinely newer reassessment on
-- the same occurrence in between, the corrected — now stale — record still
-- passed the cached check and overwrote the parent, leaving the live status
-- reflecting the older record while the newer one sat unreflected in
-- history.
--
-- Fold the check and the update into one statement instead: a plain SQL
-- function (no SECURITY DEFINER, so the caller's own RLS still applies to
-- the UPDATE exactly as it did before) whose WHERE clause re-derives
-- "is p_record_id still the latest occurrence_record for this occurrence"
-- against the same snapshot the UPDATE itself commits against — there is no
-- gap between the check and the write for a concurrent insert to land in.

CREATE OR REPLACE FUNCTION resync_occurrence_from_latest_reassessment(
  p_occurrence_id uuid,
  p_record_id uuid,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_bump_updated_at boolean
)
RETURNS SETOF occurrences
LANGUAGE sql
AS $$
  UPDATE occurrences o
  SET
    availability_status = p_availability_status,
    load_management_restrictions = p_load_management_restrictions,
    load_management_notes = p_load_management_notes,
    updated_at = CASE WHEN p_bump_updated_at THEN now() ELSE o.updated_at END,
    decision_source = 'reassessment'
  WHERE o.id = p_occurrence_id
    AND o.is_resolved = false
    AND o.decision_source = 'reassessment'
    AND NOT EXISTS (
      SELECT 1 FROM occurrence_records newer
      WHERE newer.occurrence_id = o.id
        AND newer.created_at > (SELECT created_at FROM occurrence_records WHERE id = p_record_id)
    )
  RETURNING o.*;
$$;
