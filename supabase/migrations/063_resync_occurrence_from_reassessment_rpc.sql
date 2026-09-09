-- Migration 063 — Atomic reassessment update + "is this still the latest" resync.
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
-- A second version locked the occurrence row first, then re-derived
-- "latest" fresh — closing that race — but still took the mirrored
-- availability_status/restrictions/notes as caller-supplied PARAMETERS
-- rather than reading them from the record itself, and the app updated
-- occurrence_records in a SEPARATE transaction before calling this one.
-- Two clinicians correcting the SAME reassessment (an in-place edit — the
-- row's own created_at never changes, so "latest by created_at" can't
-- distinguish them) could then race across those two transactions: A's
-- record update commits, B's record update commits (overwriting A's
-- values), B's RPC call correctly mirrors B's values — then A's RPC call
-- runs, sees the same record id is still "latest" (true — it's the same
-- row), and mirrors A's own now-stale parameters, leaving the occurrence
-- out of sync with what occurrence_records actually holds.
--
-- Fold the record's own UPDATE into this function too: lock and update
-- occurrence_records first, then mirror using the just-committed row's own
-- columns (not the caller's parameters) — so the mirrored values can never
-- diverge from what's actually stored. Returns only what the caller
-- (updateOccurrenceRecord) needs afterward — athlete_id/occurrence_id (to
-- know the record was found, and for cache revalidation) and whether the
-- mirror actually applied (to gate the athlete-availability recompute) —
-- rather than the full record, since nothing else is used. No SECURITY
-- DEFINER, so the caller's own RLS still applies to every statement exactly
-- as it did before.

CREATE OR REPLACE FUNCTION update_occurrence_record_and_mirror(
  p_record_id uuid,
  p_record_date date,
  p_assessment text,
  p_availability_status text,
  p_load_management_restrictions text[],
  p_load_management_notes text
)
RETURNS TABLE (out_athlete_id uuid, out_occurrence_id uuid, out_mirrored boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text;
  v_old_restrictions text[];
  v_old_notes text;
  v_decision_changed boolean;
  v_record occurrence_records;
  v_occ_decision_source text;
  v_latest_id uuid;
  v_mirrored boolean := false;
BEGIN
  -- Serialization point for this record: locks it, blocking until any
  -- concurrent correction to the SAME record completes, then reads its
  -- guaranteed-current values (not a stale earlier snapshot) to derive
  -- decisionChanged.
  SELECT availability_status, load_management_restrictions, load_management_notes
  INTO v_old_status, v_old_restrictions, v_old_notes
  FROM occurrence_records
  WHERE id = p_record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_decision_changed :=
    v_old_status IS DISTINCT FROM p_availability_status
    OR ARRAY(SELECT unnest(v_old_restrictions) ORDER BY 1)
       IS DISTINCT FROM ARRAY(SELECT unnest(p_load_management_restrictions) ORDER BY 1)
    OR v_old_notes IS DISTINCT FROM p_load_management_notes;

  UPDATE occurrence_records
  SET
    record_date = p_record_date,
    assessment = p_assessment,
    availability_status = p_availability_status,
    load_management_restrictions = p_load_management_restrictions,
    load_management_notes = p_load_management_notes
  WHERE id = p_record_id
  RETURNING * INTO v_record;

  -- Serialization point for the parent: blocks until any concurrent write
  -- already holding this row's lock (e.g. addOccurrenceRecord's own mirror,
  -- or another correction's mirror for a different record on the same
  -- occurrence) commits.
  SELECT decision_source INTO v_occ_decision_source
  FROM occurrences
  WHERE id = v_record.occurrence_id AND is_resolved = false
  FOR UPDATE;

  IF FOUND AND v_occ_decision_source = 'reassessment' THEN
    -- Fresh statement -> fresh READ COMMITTED snapshot, taken after the
    -- lock above, so it reflects the guaranteed-current latest record.
    SELECT id INTO v_latest_id
    FROM occurrence_records
    WHERE occurrence_id = v_record.occurrence_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_latest_id = p_record_id THEN
      UPDATE occurrences
      SET
        availability_status = v_record.availability_status,
        load_management_restrictions = v_record.load_management_restrictions,
        load_management_notes = v_record.load_management_notes,
        updated_at = CASE WHEN v_decision_changed THEN now() ELSE updated_at END,
        decision_source = 'reassessment'
      WHERE id = v_record.occurrence_id;
      v_mirrored := true;
    END IF;
  END IF;

  out_athlete_id := v_record.athlete_id;
  out_occurrence_id := v_record.occurrence_id;
  out_mirrored := v_mirrored;
  RETURN NEXT;
END;
$$;
