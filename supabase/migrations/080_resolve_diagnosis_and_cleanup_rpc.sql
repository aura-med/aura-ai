-- Migration 080 — Atomic diagnosis resolve + occurrence cleanup.
--
-- resolveDiagnosis (lib/actions/clinical.ts) only resolved the diagnoses
-- row. If that diagnosis was still linked to an open occurrence with
-- decision_source = 'diagnosis', the occurrence kept the diagnosis's
-- mirrored availability_status/restrictions/notes indefinitely — 078's
-- recompute_and_persist_athlete_availability only excludes RESOLVED
-- occurrences/diagnoses from its ranking, and this occurrence was never
-- resolved or updated, so its now-stale, diagnosis-derived status stayed
-- a perfectly valid (and often winning, since it's not stale in any way
-- the SQL can see) candidate event — keeping the athlete restricted by a
-- diagnosis that no longer exists as an open clinical issue.
--
-- Same fix as 067's detach cleanup, folded into the resolve itself: after
-- resolving, if the diagnosis's occurrence is still open and still
-- attributes its status to this diagnosis, re-derive from the
-- occurrence's own latest reassessment (verbatim, timestamped with the
-- reassessment's own created_at rather than now() — same reasoning as 067,
-- so this administrative cleanup can never outrank a genuinely later
-- clinical event for the athlete).
--
-- When there's no reassessment to fall back on, this is actually WORSE
-- than 067's own no-fallback case: there, the diagnosis is only moving
-- (still active, still a legitimate competing event elsewhere in 078's
-- ranking), so a stale leftover copy is merely a duplicate. Here the
-- diagnosis is being RESOLVED — permanently excluded from that ranking —
-- so a stale 'unavailable' left in place has NO live source behind it at
-- all; the athlete could stay restricted indefinitely by a diagnosis that
-- no longer exists as an open issue. Reset to 'available' (the same
-- no-open-issues fallback resolveDiagnosis's own athlete-level recompute
-- already uses) with restrictions/notes cleared — but deliberately leave
-- updated_at untouched rather than stamping now(): if this occurrence's
-- (unchanged, already-old) timestamp still wins 078's ranking, 'available'
-- is exactly correct (nothing else is currently more recent); if it
-- doesn't win, whatever genuinely-newer event exists correctly takes over
-- instead. Stamping now() here would risk the same bug 067's header
-- documents for its own reassessment-fallback branch — this administrative
-- update looking like the newest clinical event and wrongly outranking a
-- still-active, more-restrictive one elsewhere for the same athlete.
--
-- Locks the occurrence (via an unlocked prediction read, occurrence-first,
-- re-verified after locking the diagnosis) before the diagnosis row, same
-- order as 067/069/070 — see 067's header for why diagnosis-first would
-- risk a deadlock against a concurrent create_diagnosis_and_mirror (069)
-- call on the same occurrence.
--
-- Also returns the linked occurrence's own occurrence_date (NULL when
-- there isn't one), rather than making the caller (resolveDiagnosis,
-- lib/actions/clinical.ts) fetch it separately afterward: that follow-up
-- query's error was easy to drop silently (Supabase resolves a failed
-- query as { data: null, error }, not a throw), which would fall back to
-- diagnosed_at and record a wrong injury_date/days_absent/severity on the
-- injury_events row — irrecoverably, since the diagnosis is already
-- resolved by that point. Returning it here means there's no separate
-- query left to fail.
--
-- resolveDiagnosis (lib/actions/clinical.ts) also inserted the athlete's
-- permanent injury_events history row as a SEPARATE statement after this
-- RPC returned. If that insert failed (transient network/DB error, RLS,
-- a constraint), the diagnosis was already committed as resolved by this
-- function — and is now permanently unresolvable to retry, since the
-- UPDATE above only ever matches is_resolved = false: a retry finds
-- nothing, returns no rows, and the caller sees "already resolved" with
-- no way to re-attempt the history insert. The injury is then silently
-- missing from that athlete's history forever. Fold the injury_events
-- insert into this same transaction instead (only for diagnosis_type =
-- 'injury' — matches resolveDiagnosis's own exclusion of 'disease'
-- diagnoses, whose location/severity fields don't describe an illness):
-- either both the resolution and the history row commit together, or a
-- failure rolls back the resolution too, leaving the diagnosis open for
-- a genuine retry. confirmed_by is looked up from the caller's own
-- profile here rather than passed as a parameter, for the same reason
-- diagnosed_by/resolved_by are derived from auth.uid() rather than
-- trusted from the caller.
--
-- RETURNS TABLE declares id/occurrence_id/is_resolved/created_at (etc.) as
-- OUT parameters, which PL/pgSQL treats as variables visible everywhere in
-- the function body — including inside embedded SQL. Any bare reference to
-- a same-named column in a query against diagnoses/occurrences/
-- occurrence_records is therefore ambiguous between "the OUT parameter"
-- and "the table column" and fails at runtime (plpgsql.variable_conflict
-- defaults to error), which made every call to this function fail before
-- resolving anything. Every table in the body is now aliased and every
-- such column reference qualified by that alias.

CREATE OR REPLACE FUNCTION resolve_diagnosis_and_cleanup(p_diagnosis_id uuid)
RETURNS TABLE (
  id uuid, athlete_id uuid, occurrence_id uuid, org_id uuid,
  osiics_code text, osiics_description text, diagnosis_type text, custom_description text,
  availability_status text, load_management_restrictions text[], load_management_notes text,
  diagnosed_by uuid, diagnosed_at timestamptz,
  is_resolved boolean, resolved_at timestamptz, resolved_by uuid, resolution_status text,
  notes text, created_at timestamptz, updated_at timestamptz,
  occurrence_date date
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_predicted_occurrence_id uuid;
  v_diagnosis diagnoses;
  v_fallback_record occurrence_records;
  v_occurrence_date date;
  v_injury_date date;
  v_return_date date;
  v_days_absent int;
  v_severity text;
  v_confirmed_by text;
BEGIN
  SELECT d.occurrence_id INTO v_predicted_occurrence_id
  FROM diagnoses d
  WHERE d.id = p_diagnosis_id;

  IF v_predicted_occurrence_id IS NOT NULL THEN
    PERFORM 1 FROM occurrences o WHERE o.id = v_predicted_occurrence_id FOR UPDATE;
  END IF;

  UPDATE diagnoses d
  SET is_resolved = true, resolved_at = now(), resolved_by = auth.uid()
  WHERE d.id = p_diagnosis_id AND d.is_resolved = false
  RETURNING d.* INTO v_diagnosis;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Rare race: a concurrent update_diagnosis_and_mirror (067) call — the
  -- only path that ever changes occurrence_id — moved this diagnosis
  -- between the prediction read above and the lock just taken. Lock its
  -- actual occurrence too if so.
  IF v_diagnosis.occurrence_id IS NOT NULL
     AND v_diagnosis.occurrence_id IS DISTINCT FROM v_predicted_occurrence_id THEN
    PERFORM 1 FROM occurrences o WHERE o.id = v_diagnosis.occurrence_id FOR UPDATE;
  END IF;

  IF v_diagnosis.occurrence_id IS NOT NULL THEN
    SELECT o.occurrence_date INTO v_occurrence_date
    FROM occurrences o
    WHERE o.id = v_diagnosis.occurrence_id;

    SELECT * INTO v_fallback_record
    FROM occurrence_records r
    WHERE r.occurrence_id = v_diagnosis.occurrence_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE occurrences o
      SET
        availability_status = v_fallback_record.availability_status,
        load_management_restrictions = v_fallback_record.load_management_restrictions,
        load_management_notes = v_fallback_record.load_management_notes,
        updated_at = v_fallback_record.created_at,
        decision_source = 'reassessment'
      WHERE o.id = v_diagnosis.occurrence_id AND o.decision_source = 'diagnosis' AND o.is_resolved = false;
    ELSE
      UPDATE occurrences o
      SET
        availability_status = 'available',
        load_management_restrictions = '{}',
        load_management_notes = NULL,
        decision_source = 'own'
      WHERE o.id = v_diagnosis.occurrence_id AND o.decision_source = 'diagnosis' AND o.is_resolved = false;
    END IF;
  END IF;

  -- Preserve the injury permanently in the athlete's history, atomically
  -- with the resolution itself (see header). 'disease' diagnoses are
  -- excluded — injury_events' location/severity fields describe
  -- musculoskeletal injuries, not illness.
  IF v_diagnosis.diagnosis_type = 'injury' THEN
    v_injury_date := COALESCE(v_occurrence_date, v_diagnosis.diagnosed_at::date);
    v_return_date := COALESCE(v_diagnosis.resolved_at::date, CURRENT_DATE);
    v_days_absent := GREATEST(0, v_return_date - v_injury_date);
    v_severity := CASE
      WHEN v_days_absent > 84 THEN 'severe'
      WHEN v_days_absent > 28 THEN 'major'
      WHEN v_days_absent > 7 THEN 'moderate'
      ELSE 'minor'
    END;

    SELECT p.full_name INTO v_confirmed_by FROM profiles p WHERE p.id = auth.uid();

    INSERT INTO injury_events (
      athlete_id, injury_date, return_date, diagnosis, osiics_code,
      severity, days_absent, is_recurrence, confirmed_by
    ) VALUES (
      v_diagnosis.athlete_id, v_injury_date, v_return_date,
      COALESCE(v_diagnosis.osiics_description, v_diagnosis.custom_description, 'Diagnóstico sem descrição'),
      v_diagnosis.osiics_code, v_severity, v_days_absent, false, v_confirmed_by
    );
  END IF;

  RETURN QUERY SELECT
    v_diagnosis.id, v_diagnosis.athlete_id, v_diagnosis.occurrence_id, v_diagnosis.org_id,
    v_diagnosis.osiics_code, v_diagnosis.osiics_description, v_diagnosis.diagnosis_type, v_diagnosis.custom_description,
    v_diagnosis.availability_status, v_diagnosis.load_management_restrictions, v_diagnosis.load_management_notes,
    v_diagnosis.diagnosed_by, v_diagnosis.diagnosed_at,
    v_diagnosis.is_resolved, v_diagnosis.resolved_at, v_diagnosis.resolved_by, v_diagnosis.resolution_status,
    v_diagnosis.notes, v_diagnosis.created_at, v_diagnosis.updated_at,
    v_occurrence_date;
END;
$$;
