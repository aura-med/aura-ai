-- RENUMBERED: originally 036, renamed to 085 (2026-09-06) — same collision
-- as 084 (see that file): PR #82/#84 added their own unrelated 036. Sequence
-- requirement: must apply BEFORE 086, which drops the `plan_type` column
-- added below (086 needs the column to exist to correctly revert it).
--
-- Migration 085 — plan_type on rehab_plans: "Gestão de Carga" vs "Reabilitação".
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
