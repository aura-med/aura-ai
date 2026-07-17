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
  -- Scope the signal to athletes the caller may access (own org + owner/assigned
  -- squad). Otherwise a SECURITY DEFINER function granted to all authenticated
  -- users would leak a cross-tenant rehab/injury signal for any known UUID.
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = p_athlete_id
        AND a.org_id = get_user_org_id()
        AND (get_user_role() = 'owner' OR a.squad_id IN (SELECT get_user_squad_ids()))
    ) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM athletes a WHERE a.id = p_athlete_id AND a.status = 'rehab')
      OR (
        EXISTS (SELECT 1 FROM rehab_sessions rs WHERE rs.athlete_id = p_athlete_id)
        AND EXISTS (SELECT 1 FROM injury_events ie WHERE ie.athlete_id = p_athlete_id AND ie.return_date IS NULL)
      )
    )
  END
$$;

GRANT EXECUTE ON FUNCTION athlete_in_active_rehab(uuid) TO authenticated;
