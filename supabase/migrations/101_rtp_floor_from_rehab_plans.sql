-- Migration 101 — RTP semantics change (B7, user-confirmed): 'rtp' means
-- "specifically in the RTP-type phase of an active rehab plan," not "any
-- active rehab plan." Athletes in an earlier phase now floor to
-- 'unavailable' instead — still a floor (an unrelated, less-restrictive
-- occurrence/diagnosis can't silently clear a mid-rehab athlete), just a
-- different status while the clinical reality is "not yet field-ready."
--
-- athlete_in_active_rehab (019/082) keeps its name and its "is this athlete
-- RTP-floored" meaning, but the rehab_sessions.protocol_id check (082) is
-- replaced with: an active rehab_plans row whose current_phase_id points at
-- a phase_type='rtp' phase (096). Dropping the injury_events double-guard
-- that accompanied the old rehab_sessions check — rehab_plans.is_active
-- already means the injury hasn't been resolved (closeRehabPlan sets both
-- together), so it's redundant here.
--
-- A NEW helper, athlete_in_pre_rtp_rehab, covers the other half: an active
-- plan that exists but hasn't reached its RTP phase yet (or has no RTP
-- phase at all). recompute_and_persist_athlete_availability (078) checks
-- this SECOND, after the RTP floor, and only when it's not already RTP —
-- floors to 'unavailable' in that case.
--
-- The legacy athletes.status='rehab' flag is kept in both checks (still
-- live data on 2 athletes as of this migration) — 102 removes it once the
-- column itself is dropped.

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
      OR EXISTS (
        SELECT 1 FROM rehab_plans rp
        JOIN rehab_plan_phases ph ON ph.id = rp.current_phase_id
        WHERE rp.athlete_id = p_athlete_id AND rp.is_active = true AND ph.phase_type = 'rtp'
      )
    )
  END
$$;

CREATE OR REPLACE FUNCTION athlete_in_pre_rtp_rehab(p_athlete_id uuid)
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
    ELSE EXISTS (
      SELECT 1 FROM rehab_plans rp
      WHERE rp.athlete_id = p_athlete_id AND rp.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM rehab_plan_phases ph
          WHERE ph.id = rp.current_phase_id AND ph.phase_type = 'rtp'
        )
    )
  END
$$;

GRANT EXECUTE ON FUNCTION athlete_in_active_rehab(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION athlete_in_pre_rtp_rehab(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_and_persist_athlete_availability(p_athlete_id uuid, p_fallback text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result text;
  v_in_active_rehab boolean;
  v_in_pre_rtp_rehab boolean;
BEGIN
  IF get_user_role() IS NULL OR get_user_role() NOT IN ('owner', 'doctor', 'physio', 'masseur') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  PERFORM 1 FROM athletes
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR squad_id IN (SELECT get_user_squad_ids()))
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Athlete not found';
  END IF;

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

  -- Active rehab is a floor, not just another candidate event. RTP floors
  -- first; an active plan that hasn't reached its RTP phase yet floors to
  -- 'unavailable' instead — but never downgrades an already-'rtp' result
  -- (a plan can only be ahead of, not behind, its own current_phase_id).
  v_in_active_rehab := athlete_in_active_rehab(p_athlete_id);
  IF v_in_active_rehab AND v_result NOT IN ('rtp', 'unavailable') THEN
    v_result := 'rtp';
  END IF;

  IF NOT v_in_active_rehab THEN
    v_in_pre_rtp_rehab := athlete_in_pre_rtp_rehab(p_athlete_id);
    IF v_in_pre_rtp_rehab AND v_result <> 'unavailable' THEN
      v_result := 'unavailable';
    END IF;
  END IF;

  UPDATE athletes
  SET availability_status = v_result
  WHERE id = p_athlete_id
    AND org_id = get_user_org_id()
    AND (get_user_role() = 'owner' OR squad_id IN (SELECT get_user_squad_ids()));

  RETURN v_result;
END;
$function$;
