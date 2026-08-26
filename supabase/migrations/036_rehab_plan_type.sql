-- Migration 036 — plan_type on rehab_plans: "Gestão de Carga" vs "Reabilitação".
--
-- The club's Drive keeps a "Condicionados" folder structurally identical to
-- "Tratamentos" (same weekly-grid plan, same per-session exercise log) — it's
-- a different plan *category*, not a different availability state. Rather
-- than adding a 5th value to the athletes/occurrences/diagnoses
-- availability_status enum (available/evaluation/unavailable/rtp — load-
-- bearing across many tables, RLS policies and the recency-based recompute
-- logic), this is scoped to rehab_plans only: an athlete under load
-- management is still otherwise "available", just training under a managed
-- plan. Surfaced as a badge wherever a plan already renders.

ALTER TABLE rehab_plans
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'rehabilitation'
    CHECK (plan_type IN ('rehabilitation', 'load_management'));

CREATE INDEX IF NOT EXISTS idx_rehab_plans_type ON rehab_plans(plan_type);
