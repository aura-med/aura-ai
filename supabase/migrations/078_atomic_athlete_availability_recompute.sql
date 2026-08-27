-- Migration 078 — Atomic athlete-availability recompute + persist.
--
-- recomputeAthleteAvailability/persistAvailability (occurrences/actions.ts)
-- and their exact duplicate recomputeAvailability/persistAvailability
-- (lib/actions/clinical.ts) — eight call sites across the two files — read
-- the athlete's open occurrences/diagnoses/active-rehab state via a few
-- separate, unlocked SELECTs, decide the resulting availability_status in
-- TypeScript, then persist it via a SEPARATE RPC call moments later. Two
-- concurrent writes for the SAME athlete (e.g. a diagnosis edit on one
-- occurrence racing a reassessment on another) each do their own
-- source-RPC (already correctly serialized against each other — see
-- 063/067/069/070), then their own read-recompute-persist sequence
-- entirely outside that serialization: whichever recompute reads the
-- occurrence/diagnosis tables LAST sees both writes and computes the
-- genuinely-correct result, but whichever PERSIST call commits last is
-- the one that sticks — not necessarily the same one. A slower caller
-- whose source write actually landed FIRST can still persist its
-- now-stale computed status AFTER a faster caller's genuinely newer
-- result, leaving the athlete's displayed status wrong until another
-- write happens to correct it.
--
-- Fold read + decide + write into one function, locking the athletes row
-- FIRST: whichever caller's recompute-and-persist call acquires that lock
-- first runs fully to completion (reading current committed
-- occurrences/diagnoses state, computing, writing) before the other
-- proceeds — so the second caller's own read, once it acquires the lock,
-- sees the first caller's already-persisted result and computes
-- correctly from there. No app-side ordering can be lost this way, unlike
-- the previous two-separate-calls shape.
--
-- Ranking logic (most-recently-timestamped open occurrence/diagnosis
-- wins; active rehab is a floor, not just another candidate) is ported
-- verbatim from the TypeScript it replaces.
--
-- Role check and scoping are ported from 018's version of
-- update_athlete_availability (013's original, pre-018 shape used 'admin'
-- — removed by 017's owner rename — and org-only scoping, no squad
-- check). Copying 013's shape here instead of 018's would have let a
-- doctor/physio/masseur recompute and overwrite availability for an
-- athlete outside their own squad(s), and would have rejected every
-- owner outright with 'Insufficient permissions' since 'admin' no longer
-- matches any real role.

CREATE OR REPLACE FUNCTION recompute_and_persist_athlete_availability(
  p_athlete_id uuid,
  p_fallback text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
  v_in_active_rehab boolean;
BEGIN
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('owner', 'doctor', 'physio', 'masseur') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Serialization point: locks the athlete row, blocking any concurrent
  -- recompute-and-persist call for the same athlete until this one
  -- commits. Owners see every athlete in their org; other clinical roles
  -- are scoped to their own assigned squad(s).
  PERFORM 1 FROM athletes
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR squad_id IN (SELECT get_user_squad_ids()))
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Athlete not found';
  END IF;

  -- Most-recently-timestamped open occurrence/diagnosis wins — not the
  -- most restrictive one. A newer clinical call supersedes an older one,
  -- even if it's less restrictive.
  SELECT status INTO v_result
  FROM (
    SELECT availability_status AS status, COALESCE(updated_at, created_at) AS at
    FROM occurrences
    WHERE athlete_id = p_athlete_id AND is_resolved = false AND availability_status IS NOT NULL
    UNION ALL
    SELECT availability_status AS status, COALESCE(updated_at, diagnosed_at) AS at
    FROM diagnoses
    WHERE athlete_id = p_athlete_id AND is_resolved = false AND availability_status IS NOT NULL
  ) events
  ORDER BY at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_result := p_fallback;
  END IF;

  -- Active rehab is a floor, not just another candidate event: an ongoing
  -- RTP protocol must not be silently overridden just because an
  -- unrelated occurrence happens to carry a more recent timestamp.
  -- athlete_in_active_rehab (019) is itself a SECURITY DEFINER function
  -- scoped by the caller's role/org, unaffected by being called from here.
  v_in_active_rehab := athlete_in_active_rehab(p_athlete_id);
  IF v_in_active_rehab AND v_result NOT IN ('rtp', 'unavailable') THEN
    v_result := 'rtp';
  END IF;

  UPDATE athletes
  SET availability_status = v_result
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR squad_id IN (SELECT get_user_squad_ids()));

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION recompute_and_persist_athlete_availability(uuid, text) TO authenticated;
