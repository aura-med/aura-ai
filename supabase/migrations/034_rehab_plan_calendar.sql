-- Migration 034 — Rehab plan calendar (day-by-day reabilitação planning).
--
-- New tables, deliberately NOT named "rehab_sessions" — that name already
-- carries a two-feature collision (see 027/033): the migration-001 gate-based
-- RTP protocol tracker (/rehab, /rehab/[sessionId]) and the migration-008
-- physio session log (Tratamentos tab). This is a third, unrelated concept: a
-- forward-looking day-by-day calendar plan (Manhã/Tarde per day) with named
-- phases and free-text criteria, matching the club's existing paper/Excel
-- planning workflow. It does not touch either existing rehab table.

-- ── rehab_plans ──────────────────────────────────────────────────────────────
-- One row per reabilitação plan. An athlete can have many plans over a season
-- (one per injury), but only one active at a time.

CREATE TABLE rehab_plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id             uuid REFERENCES organizations(id),
  squad_id           uuid REFERENCES squads(id),
  occurrence_id      uuid REFERENCES occurrences(id) ON DELETE SET NULL,
  title              text NOT NULL,
  start_date         date NOT NULL,
  expected_end_date  date,
  is_active          boolean NOT NULL DEFAULT true,
  is_completed       boolean NOT NULL DEFAULT false,
  closed_at          timestamptz,
  created_by         uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Only one active plan per athlete — DB-enforced as the safety net; the
-- createRehabPlan action also checks first so the clinician gets a clear
-- error message instead of a raw constraint violation.
CREATE UNIQUE INDEX rehab_plans_one_active_per_athlete
  ON rehab_plans(athlete_id) WHERE is_active;

CREATE INDEX idx_rehab_plans_athlete    ON rehab_plans(athlete_id);
CREATE INDEX idx_rehab_plans_occurrence ON rehab_plans(occurrence_id);

CREATE TRIGGER update_rehab_plans_updated_at
  BEFORE UPDATE ON rehab_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── rehab_plan_phases ────────────────────────────────────────────────────────
-- Named phases within a plan (Fase 1, Fase 2...), each with its own free-text
-- expected criteria — mirrors how the club's real plans embed phase names and
-- numeric thresholds/tests as prose at the point a phase begins. No end_date:
-- a phase's effective end is the next phase's start_date (or the plan's end),
-- computed in the UI rather than stored redundantly.

CREATE TABLE rehab_plan_phases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       uuid NOT NULL REFERENCES rehab_plans(id) ON DELETE CASCADE,
  phase_number  int NOT NULL,
  name          text NOT NULL,
  criteria      text,
  start_date    date NOT NULL,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, phase_number)
);

CREATE INDEX idx_rehab_plan_phases_plan ON rehab_plan_phases(plan_id, start_date);

CREATE TRIGGER update_rehab_plan_phases_updated_at
  BEFORE UPDATE ON rehab_plan_phases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── rehab_plan_days ──────────────────────────────────────────────────────────
-- One row per (plan, date, period) — the actual day-by-day calendar content.
-- No row = not yet planned. is_rest_day distinguishes an explicit "Folga"
-- (day off) from an unplanned cell, matching how the club's own plans mark
-- rest days explicitly rather than leaving them ambiguous.

CREATE TABLE rehab_plan_days (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       uuid NOT NULL REFERENCES rehab_plans(id) ON DELETE CASCADE,
  phase_id      uuid REFERENCES rehab_plan_phases(id) ON DELETE SET NULL,
  entry_date    date NOT NULL,
  period        text NOT NULL CHECK (period IN ('morning', 'afternoon')),
  content       text,
  is_rest_day   boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES auth.users(id),
  updated_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, entry_date, period)
);

CREATE INDEX idx_rehab_plan_days_plan_date ON rehab_plan_days(plan_id, entry_date);

CREATE TRIGGER update_rehab_plan_days_updated_at
  BEFORE UPDATE ON rehab_plan_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE rehab_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_plan_days   ENABLE ROW LEVEL SECURITY;

-- rehab_plans has athlete_id directly, so its own policies check it inline —
-- mirrors rehab_sessions' squad-scoped write / clinical+coach read (018) plus
-- an athlete-self-read branch (mirrors score_history_athlete /
-- injury_events_athlete / wellness_select_athlete).

CREATE POLICY rehab_plans_write ON rehab_plans FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
  );

CREATE POLICY rehab_plans_read ON rehab_plans FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'coach', 'fitness_coach')
      AND athlete_id IN (
        SELECT id FROM athletes
        WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids())
      )
    )
    OR (
      get_user_role() = 'athlete'
      AND athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
    )
  );

-- rehab_plan_phases / rehab_plan_days only carry plan_id, not athlete_id —
-- scope them through their parent plan via SECURITY DEFINER helpers (same
-- pattern as athlete_in_active_rehab, 019) rather than duplicating the
-- athlete/squad join predicate as a raw subquery, which would leak: a plain
-- "plan_id IN (SELECT id FROM rehab_plans)" subquery is itself subject to
-- rehab_plans' SELECT policy, not its (narrower) write policy, so a
-- read-only role (coach) would incorrectly pass a write check.

CREATE OR REPLACE FUNCTION user_can_write_rehab_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rehab_plans p
    JOIN athletes a ON a.id = p.athlete_id
    WHERE p.id = p_plan_id
      AND (
        (get_user_role() = 'owner' AND a.org_id = get_user_org_id())
        OR (
          get_user_role() IN ('doctor', 'physio')
          AND a.org_id = get_user_org_id() AND a.squad_id IN (SELECT get_user_squad_ids())
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION user_can_read_rehab_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rehab_plans p
    JOIN athletes a ON a.id = p.athlete_id
    WHERE p.id = p_plan_id
      AND (
        (get_user_role() = 'owner' AND a.org_id = get_user_org_id())
        OR (
          get_user_role() IN ('doctor', 'physio', 'masseur', 'coach', 'fitness_coach')
          AND a.org_id = get_user_org_id() AND a.squad_id IN (SELECT get_user_squad_ids())
        )
        OR (get_user_role() = 'athlete' AND a.user_id = auth.uid())
      )
  )
$$;

GRANT EXECUTE ON FUNCTION user_can_write_rehab_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_read_rehab_plan(uuid)  TO authenticated;

CREATE POLICY rehab_plan_phases_write ON rehab_plan_phases FOR ALL
  USING (user_can_write_rehab_plan(plan_id))
  WITH CHECK (user_can_write_rehab_plan(plan_id));

CREATE POLICY rehab_plan_phases_read ON rehab_plan_phases FOR SELECT
  USING (user_can_read_rehab_plan(plan_id));

CREATE POLICY rehab_plan_days_write ON rehab_plan_days FOR ALL
  USING (user_can_write_rehab_plan(plan_id))
  WITH CHECK (user_can_write_rehab_plan(plan_id));

CREATE POLICY rehab_plan_days_read ON rehab_plan_days FOR SELECT
  USING (user_can_read_rehab_plan(plan_id));
