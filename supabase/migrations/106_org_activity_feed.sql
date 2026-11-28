-- Migration 106 — Real activity timeline (replaces the audit_logs-only feed)
--
-- The Phase D feed read only audit_logs, which only started being written
-- for clinical actions this session — so almost all real history (every
-- occurrence/diagnosis/rehab action created before that) was invisible, and
-- the user explicitly asked for "uma verdadeira timeline de todos os
-- acontecimentos". Every clinical table here already carries its own
-- authorship columns (created_by/diagnosed_by/resolved_by/completed_by/
-- recorded_by), so reading from the source tables directly gives full
-- history for free — no backfill needed, no dependency on when logging was
-- wired up. Administrative actions (athlete/squad/user management) have no
-- such columns on their own tables, so those still come from audit_logs,
-- which already has deeper history for them (logAudit predates this
-- session for the admin app).

-- rehab_plans had no closed_by/closed_by_name — closeRehabPlan did a plain
-- client-side .update(), so nothing recorded who closed a plan. Mirrors the
-- completed_by/completed_by_name pattern already on rehab_phase_criteria.
ALTER TABLE rehab_plans
  ADD COLUMN closed_by uuid REFERENCES profiles(id),
  ADD COLUMN closed_by_name text;

-- get_org_activity_feed — unions every feed-worthy event into one
-- normalized shape. SECURITY INVOKER (default): it reads nothing RLS
-- wouldn't already let the caller see, and the app calls it with the
-- service-role client (bypasses RLS) only after its own role check, same
-- security boundary the previous audit_logs-only version used — this
-- function doesn't widen anything, it's a different data source.
CREATE OR REPLACE FUNCTION get_org_activity_feed(
  p_org_id uuid,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0,
  p_athlete_id uuid DEFAULT NULL,
  p_squad_id uuid DEFAULT NULL,
  p_actions text[] DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  event_time timestamptz,
  action text,
  actor_user_id uuid,
  actor_name text,
  athlete_id uuid,
  athlete_name text,
  athlete_photo_url text,
  squad_id uuid,
  detail jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH events AS (
    -- occurrence.create
    SELECT o.id AS event_id, o.created_at AS event_time, 'occurrence.create'::text AS action,
           o.created_by AS actor_user_id, o.clinician_name AS actor_fallback_name,
           o.athlete_id, a.name AS athlete_name, a.photo_url AS athlete_photo_url, a.squad_id,
           jsonb_build_object('occurrenceType', o.occurrence_type, 'title', o.title, 'occurrenceDate', o.occurrence_date) AS detail
    FROM occurrences o JOIN athletes a ON a.id = o.athlete_id
    WHERE o.org_id = p_org_id

    UNION ALL

    -- occurrence.resolve
    SELECT o.id, o.resolved_at, 'occurrence.resolve',
           o.resolved_by, NULL::text,
           o.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('title', o.title)
    FROM occurrences o JOIN athletes a ON a.id = o.athlete_id
    WHERE o.org_id = p_org_id AND o.is_resolved AND o.resolved_at IS NOT NULL

    UNION ALL

    -- occurrence_record.create (reassessment)
    SELECT r.id, r.created_at, 'occurrence_record.create',
           r.created_by, r.clinician_name,
           r.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('availabilityStatus', r.availability_status, 'recordDate', r.record_date)
    FROM occurrence_records r JOIN athletes a ON a.id = r.athlete_id
    WHERE a.org_id = p_org_id

    UNION ALL

    -- diagnosis.create
    SELECT d.id, d.diagnosed_at, 'diagnosis.create',
           d.diagnosed_by, NULL::text,
           d.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('diagnosisType', d.diagnosis_type, 'description', COALESCE(d.osiics_description, d.custom_description), 'diagnosisDate', d.diagnosis_date)
    FROM diagnoses d JOIN athletes a ON a.id = d.athlete_id
    WHERE d.org_id = p_org_id

    UNION ALL

    -- diagnosis.resolve
    SELECT d.id, d.resolved_at, 'diagnosis.resolve',
           d.resolved_by, NULL::text,
           d.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('description', COALESCE(d.osiics_description, d.custom_description))
    FROM diagnoses d JOIN athletes a ON a.id = d.athlete_id
    WHERE d.org_id = p_org_id AND d.is_resolved AND d.resolved_at IS NOT NULL

    UNION ALL

    -- rehab_plan.create
    SELECT rp.id, rp.created_at, 'rehab_plan.create',
           rp.created_by, NULL::text,
           rp.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('title', rp.title)
    FROM rehab_plans rp JOIN athletes a ON a.id = rp.athlete_id
    WHERE rp.org_id = p_org_id

    UNION ALL

    -- rehab_plan.close
    SELECT rp.id, rp.closed_at, 'rehab_plan.close',
           rp.closed_by, rp.closed_by_name,
           rp.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('title', rp.title, 'completed', rp.is_completed)
    FROM rehab_plans rp JOIN athletes a ON a.id = rp.athlete_id
    WHERE rp.org_id = p_org_id AND rp.closed_at IS NOT NULL

    UNION ALL

    -- rehab_criterion.complete
    SELECT c.id, c.completed_at, 'rehab_criterion.complete',
           c.completed_by, c.completed_by_name,
           rp.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object(
             'description', c.description, 'metricLabel', c.metric_label,
             'thresholdOperator', c.threshold_operator, 'thresholdValue', c.threshold_value,
             'unit', c.unit, 'measuredValue', c.measured_value
           )
    FROM rehab_phase_criteria c
    JOIN rehab_plan_phases ph ON ph.id = c.phase_id
    JOIN rehab_plans rp ON rp.id = ph.plan_id
    JOIN athletes a ON a.id = rp.athlete_id
    WHERE rp.org_id = p_org_id AND c.is_completed AND c.completed_at IS NOT NULL

    UNION ALL

    -- weight.create
    SELECT w.id, w.created_at, 'weight.create',
           w.recorded_by, w.recorded_by_name,
           w.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('weightKg', w.weight_kg, 'measurementDate', w.measurement_date)
    FROM athlete_daily_weight w JOIN athletes a ON a.id = w.athlete_id
    WHERE w.org_id = p_org_id

    UNION ALL

    -- wellness.checkin (athlete self-reported — no staff actor)
    SELECT wc.id, wc.created_at, 'wellness.checkin',
           NULL::uuid, NULL::text,
           wc.athlete_id, a.name, a.photo_url, a.squad_id,
           jsonb_build_object('checkinType', wc.checkin_type, 'checkinDate', wc.checkin_date)
    FROM wellness_checkins wc JOIN athletes a ON a.id = wc.athlete_id
    WHERE a.org_id = p_org_id

    UNION ALL

    -- athlete.create / athlete.update / athlete.disable / athlete.enable
    SELECT al.id, al.created_at, al.action,
           al.user_id, al.user_email,
           a.id, a.name, a.photo_url, a.squad_id,
           COALESCE(al.metadata, '{}'::jsonb)
    FROM audit_logs al
    JOIN athletes a ON a.id::text = al.resource_id
    WHERE al.org_id = p_org_id AND al.resource_type = 'athlete'
      AND al.action IN ('athlete.create', 'athlete.update', 'athlete.disable', 'athlete.enable')

    UNION ALL

    -- squad.create / squad.update (no athlete)
    SELECT al.id, al.created_at, al.action,
           al.user_id, al.user_email,
           NULL::uuid, NULL::text, NULL::text, s.id,
           jsonb_build_object('squadName', s.name) || COALESCE(al.metadata, '{}'::jsonb)
    FROM audit_logs al
    LEFT JOIN squads s ON s.id::text = al.resource_id
    WHERE al.org_id = p_org_id AND al.action IN ('squad.create', 'squad.update')

    UNION ALL

    -- user.invite (no athlete, no squad)
    SELECT al.id, al.created_at, al.action,
           al.user_id, al.user_email,
           NULL::uuid, NULL::text, NULL::text, NULL::uuid,
           COALESCE(al.metadata, '{}'::jsonb)
    FROM audit_logs al
    WHERE al.org_id = p_org_id AND al.action = 'user.invite'
  )
  SELECT e.event_id, e.event_time, e.action,
         e.actor_user_id, COALESCE(p.full_name, e.actor_fallback_name, 'Equipa clínica') AS actor_name,
         e.athlete_id, e.athlete_name, e.athlete_photo_url, e.squad_id, e.detail
  FROM events e
  LEFT JOIN profiles p ON p.id = e.actor_user_id
  WHERE e.event_time IS NOT NULL
    AND (p_athlete_id IS NULL OR e.athlete_id = p_athlete_id)
    AND (p_squad_id IS NULL OR e.squad_id = p_squad_id)
    AND (p_actions IS NULL OR e.action = ANY(p_actions))
  ORDER BY e.event_time DESC
  LIMIT p_limit OFFSET p_offset
$$;
