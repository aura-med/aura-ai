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
-- A single SQL UPDATE with a NOT EXISTS subquery (the first version of this
-- function) does NOT close this race under READ COMMITTED: if
-- addOccurrenceRecord's parent-mirror UPDATE (for the genuinely newer
-- record) is holding the occurrence row's lock when this statement starts,
-- this UPDATE blocks on that row; once the other transaction commits and
-- this one resumes, Postgres re-fetches only the LOCKED ROW itself fresh —
-- the NOT EXISTS subquery against occurrence_records is re-evaluated using
-- the SAME snapshot this statement started with, which predates the other
-- transaction's insert. It still doesn't see the newer record and proceeds
-- to overwrite it.
--
-- Close it properly with an explicit serialization point: lock the
-- occurrence row first (blocking until any concurrent mirror to it
-- completes), THEN look up the latest occurrence_record in a fresh
-- statement — under READ COMMITTED each statement gets its own snapshot, so
-- this one is taken after the lock is acquired and does see whatever just
-- committed. No SECURITY DEFINER, so the caller's own RLS still applies to
-- every statement exactly as it did before.

CREATE OR REPLACE FUNCTION resync_occurrence_from_latest_reassessment(
  p_occurrence_id uuid,
  p_record_id uuid,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text,
  p_bump_updated_at boolean
)
RETURNS SETOF occurrences
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest_id uuid;
BEGIN
  -- Serialization point: blocks until any concurrent write already holding
  -- this row's lock (e.g. addOccurrenceRecord's parent mirror) commits.
  PERFORM 1 FROM occurrences WHERE id = p_occurrence_id FOR UPDATE;

  -- Fresh statement -> fresh READ COMMITTED snapshot, taken after the lock
  -- above was acquired, so a just-committed newer occurrence_record is
  -- visible here.
  SELECT id INTO v_latest_id
  FROM occurrence_records
  WHERE occurrence_id = p_occurrence_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_id IS DISTINCT FROM p_record_id THEN
    RETURN;
  END IF;

  RETURN QUERY
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
  RETURNING o.*;
END;
$$;
