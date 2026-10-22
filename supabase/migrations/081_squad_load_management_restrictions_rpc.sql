-- Migration 081 — Squad-scoped load-management restrictions RPC.
--
-- The dashboard's "Gestão de Carga" group shows each restricted athlete's
-- restrictions checklist (avoid sprints, reduce volume, etc.) and free-text
-- note (040) when the group is expanded — but expansion is gated entirely
-- behind canReadClinical, which only owner/doctor/physio/masseur satisfy
-- (018's occurrences/occurrence_records/diagnoses RLS grants SELECT to
-- exactly those roles, nobody else). coach/fitness_coach — the roles 040's
-- own header names as the intended audience for this checklist ("a fixed
-- checklist... the fitness coach can scan at a glance") — could never see
-- it at all: not just a UI gate, the underlying tables are genuinely
-- unreadable to them.
--
-- Expose a narrow, purpose-built projection instead of relaxing RLS on the
-- clinical tables themselves: restrictions + notes only, never diagnosis
-- text, OSIICS codes, or SOAP notes, for athletes already computed (078)
-- to be in 'load_management' — scoped the same way athlete_in_active_rehab
-- (019) scopes its own floor signal. Derives "current" restrictions the
-- same way recompute_and_persist_athlete_availability (078) derives the
-- winning status: most-recently-timestamped open occurrence/diagnosis
-- wins, restricted to rows whose own availability_status is
-- 'load_management' (guaranteed to exist for any athlete already
-- persisted as such).

CREATE OR REPLACE FUNCTION get_squad_load_management_restrictions()
RETURNS TABLE(athlete_id uuid, restrictions text[], notes text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_athletes AS (
    SELECT a.id
    FROM athletes a
    WHERE a.org_id = get_user_org_id()
      AND a.availability_status = 'load_management'
      AND (
        get_user_role() = 'owner'
        OR (
          get_user_role() IN ('doctor', 'physio', 'masseur', 'coach', 'fitness_coach')
          AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
  ),
  events AS (
    SELECT o.athlete_id, o.load_management_restrictions AS restrictions, o.load_management_notes AS notes,
           COALESCE(o.updated_at, o.created_at) AS at
    FROM occurrences o
    WHERE o.is_resolved = false
      AND o.availability_status = 'load_management'
      AND o.athlete_id IN (SELECT id FROM scoped_athletes)
    UNION ALL
    SELECT d.athlete_id, d.load_management_restrictions, d.load_management_notes,
           COALESCE(d.updated_at, d.diagnosed_at) AS at
    FROM diagnoses d
    WHERE d.is_resolved = false
      AND d.availability_status = 'load_management'
      AND d.athlete_id IN (SELECT id FROM scoped_athletes)
  )
  SELECT DISTINCT ON (e.athlete_id) e.athlete_id, e.restrictions, e.notes
  FROM events e
  ORDER BY e.athlete_id, e.at DESC
$$;

GRANT EXECUTE ON FUNCTION get_squad_load_management_restrictions() TO authenticated;
