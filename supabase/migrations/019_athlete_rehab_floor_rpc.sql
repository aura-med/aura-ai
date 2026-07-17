-- Migration 019 — SECURITY DEFINER helper for the active-rehab availability floor.
-- The availability recompute (occurrences/actions.ts, lib/actions/clinical.ts)
-- needs to know if an athlete is in active rehab so resolving their last
-- occurrence doesn't drop them out of RTP. It read rehab_sessions/injury_events
-- directly, but 018 grants masseurs no SELECT on those tables, so the signal was
-- silently missed for masseur actions. Encapsulate the check in a SECURITY
-- DEFINER function so every clinical role gets a consistent answer.
--
-- Active rehab = legacy athletes.status='rehab' OR (a rehab_sessions row AND an
-- unresolved injury), mirroring the 009 backfill.

CREATE OR REPLACE FUNCTION athlete_in_active_rehab(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM athletes a WHERE a.id = p_athlete_id AND a.status = 'rehab')
    OR (
      EXISTS (SELECT 1 FROM rehab_sessions rs WHERE rs.athlete_id = p_athlete_id)
      AND EXISTS (SELECT 1 FROM injury_events ie WHERE ie.athlete_id = p_athlete_id AND ie.return_date IS NULL)
    )
$$;

GRANT EXECUTE ON FUNCTION athlete_in_active_rehab(uuid) TO authenticated;
