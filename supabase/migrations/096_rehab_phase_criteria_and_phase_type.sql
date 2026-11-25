-- Migration 096 — Formal, signed-off rehab phase criteria + phase_type.
--
-- Today a phase's "criteria" is free text (rehab_plan_phases.criteria,
-- migration 034) with no completion state at all — 041 documents test_date
-- as "just a marker (no pass/fail workflow)". The only structured/checkable
-- thing in the whole module is rehab_plans.rtp_criteria, a flat plan-level
-- jsonb checkbox list with no sign-off metadata (who approved it, when,
-- what value was measured) and deliberately decoupled from the numbered
-- phases. Neither is good enough for a clinical gate like "LSI > 90%".
--
-- rehab_phase_criteria replaces both going forward: one row per criterion,
-- on a specific phase, with an optional metric/threshold/measured value and
-- a completed_by/completed_at pair derived server-side only (same trust
-- pattern as diagnosed_by/diagnosed_at) — never client-supplied, so the
-- sign-off itself can't be forged. The free-text rehab_plan_phases.criteria
-- column is kept alongside it (narrative context), not replaced.
--
-- phase_type distinguishes the terminal RTP phase (field work, physical-
-- trainer-led) from the ordinary numbered phases — needed so 099 can make
-- the athlete's 'rtp' availability status mean "specifically in the RTP
-- phase" instead of "any active rehab plan." At most one RTP-type phase per
-- plan (partial unique index) — it's the plan's single terminal phase, not
-- a numbered stage.
--
-- current_phase_id is an explicit, clinician-advanced pointer rather than
-- inferred from today's date vs phase start_dates: progression should be
-- criteria-driven (advance_rehab_plan_phase below), not calendar-driven —
-- a phase's real-world start can slip without the athlete having actually
-- met its entry criteria yet.

ALTER TABLE rehab_plan_phases
  ADD COLUMN phase_type text NOT NULL DEFAULT 'standard' CHECK (phase_type IN ('standard', 'rtp'));

CREATE UNIQUE INDEX rehab_plan_phases_one_rtp_per_plan
  ON rehab_plan_phases(plan_id) WHERE phase_type = 'rtp';

ALTER TABLE rehab_plans
  ADD COLUMN current_phase_id uuid REFERENCES rehab_plan_phases(id);

CREATE TABLE rehab_phase_criteria (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id          uuid NOT NULL REFERENCES rehab_plan_phases(id) ON DELETE CASCADE,
  description       text NOT NULL,
  metric_label      text,                 -- e.g. "LSI" — null for a plain yes/no criterion
  threshold_operator text CHECK (threshold_operator IN ('gte', 'lte', 'gt', 'lt', 'eq')),
  threshold_value   numeric,
  unit              text,                 -- e.g. "%", "kg"
  measured_value    numeric,              -- filled in at completion time
  is_completed      boolean NOT NULL DEFAULT false,
  completed_by      uuid REFERENCES auth.users(id),
  completed_by_name text,
  completed_at      timestamptz,
  display_order     int NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rehab_phase_criteria_phase ON rehab_phase_criteria(phase_id, display_order);

CREATE TRIGGER update_rehab_phase_criteria_updated_at
  BEFORE UPDATE ON rehab_phase_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A phase is complete iff it has at least one criterion and none are
-- incomplete — an empty phase (no criteria added yet) is NOT complete, so
-- advance_rehab_plan_phase can't be satisfied by simply adding zero gates.
CREATE OR REPLACE FUNCTION phase_is_complete(p_phase_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM rehab_phase_criteria WHERE phase_id = p_phase_id)
     AND NOT EXISTS (SELECT 1 FROM rehab_phase_criteria WHERE phase_id = p_phase_id AND NOT is_completed)
$$;

-- RLS — scoped through the phase's own plan via the existing
-- user_can_write_rehab_plan / user_can_read_rehab_plan helpers (034), the
-- same pattern rehab_plan_phases/rehab_plan_days already use.

ALTER TABLE rehab_phase_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY rehab_phase_criteria_write ON rehab_phase_criteria FOR ALL
  USING (user_can_write_rehab_plan((SELECT plan_id FROM rehab_plan_phases WHERE id = phase_id)))
  WITH CHECK (user_can_write_rehab_plan((SELECT plan_id FROM rehab_plan_phases WHERE id = phase_id)));

CREATE POLICY rehab_phase_criteria_read ON rehab_phase_criteria FOR SELECT
  USING (user_can_read_rehab_plan((SELECT plan_id FROM rehab_plan_phases WHERE id = phase_id)));

-- set_rehab_criterion_completion — derives completed_by/completed_at/
-- completed_by_name from the session, same reasoning as every other
-- authorship field in this codebase: a direct Data API caller could
-- otherwise forge who signed off a criterion and when. SECURITY INVOKER
-- (default) — RLS (the write policy above) still gates who may call this.
CREATE OR REPLACE FUNCTION set_rehab_criterion_completion(
  p_criterion_id uuid,
  p_is_completed boolean,
  p_measured_value numeric DEFAULT NULL
)
RETURNS SETOF rehab_phase_criteria
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
  v_row rehab_phase_criteria;
BEGIN
  IF p_is_completed THEN
    SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();
  END IF;

  UPDATE rehab_phase_criteria
  SET
    is_completed = p_is_completed,
    measured_value = COALESCE(p_measured_value, measured_value),
    completed_by = CASE WHEN p_is_completed THEN auth.uid() ELSE NULL END,
    completed_by_name = CASE WHEN p_is_completed THEN v_name ELSE NULL END,
    completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END
  WHERE id = p_criterion_id
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN NEXT v_row;
  END IF;
END;
$$;

-- advance_rehab_plan_phase — only succeeds once the plan's CURRENT phase is
-- complete (or there is no current phase yet, i.e. the very first advance),
-- so this is a genuine gate, not just a UI affordance a client could skip.
-- SECURITY INVOKER — the plan UPDATE below still runs under the caller's
-- own rehab_plans RLS policy (034).
CREATE OR REPLACE FUNCTION advance_rehab_plan_phase(
  p_plan_id uuid,
  p_next_phase_id uuid
)
RETURNS SETOF rehab_plans
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_phase_id uuid;
  v_row rehab_plans;
BEGIN
  SELECT current_phase_id INTO v_current_phase_id FROM rehab_plans WHERE id = p_plan_id;

  IF v_current_phase_id IS NOT NULL AND NOT phase_is_complete(v_current_phase_id) THEN
    RAISE EXCEPTION 'A fase atual ainda tem critérios por cumprir.';
  END IF;

  -- The target phase must actually belong to this plan — guards against a
  -- caller passing an unrelated phase id from a different plan entirely.
  IF NOT EXISTS (SELECT 1 FROM rehab_plan_phases WHERE id = p_next_phase_id AND plan_id = p_plan_id) THEN
    RAISE EXCEPTION 'Fase inválida para este plano.';
  END IF;

  UPDATE rehab_plans
  SET current_phase_id = p_next_phase_id, updated_at = now()
  WHERE id = p_plan_id
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN NEXT v_row;
  END IF;
END;
$$;
