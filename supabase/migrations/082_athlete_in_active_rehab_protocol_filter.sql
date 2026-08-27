-- Migration 082 — Filter athlete_in_active_rehab's rehab_sessions check to actual RTP protocol rows.
--
-- 019's EXISTS (SELECT 1 FROM rehab_sessions rs WHERE rs.athlete_id = ...)
-- matches ANY rehab_sessions row, but that table is shared, by name only,
-- with the unrelated physio/rehab session log (008/027/033/035/074) — an
-- ordinary treatment log entry (protocol_id IS NULL) satisfies this EXISTS
-- just as well as a real RTP protocol row. Combined with an open injury
-- (return_date IS NULL), an athlete who's simply had a physio session
-- logged — with no actual RTP protocol ever started — would be wrongly
-- floored to 'rtp' availability. Restrict the check to rows that are
-- actually RTP protocol sessions.

CREATE OR REPLACE FUNCTION athlete_in_active_rehab(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN get_user_role() NOT IN ('owner', 'doctor', 'physio', 'masseur') THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = p_athlete_id
        AND a.org_id = get_user_org_id()
        AND (get_user_role() = 'owner' OR a.squad_id IN (SELECT get_user_squad_ids()))
    ) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM athletes a WHERE a.id = p_athlete_id AND a.status = 'rehab')
      OR (
        EXISTS (SELECT 1 FROM rehab_sessions rs WHERE rs.athlete_id = p_athlete_id AND rs.protocol_id IS NOT NULL)
        AND EXISTS (SELECT 1 FROM injury_events ie WHERE ie.athlete_id = p_athlete_id AND ie.return_date IS NULL)
      )
    )
  END
$$;
