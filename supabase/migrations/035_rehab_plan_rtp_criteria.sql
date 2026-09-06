-- Migration 035 — RTP criteria checklist on rehab_plans.
--
-- Adds a JSONB column to rehab_plans so clinicians can define manual
-- Return-To-Play criteria per plan (e.g. "Sem dor ao remate", "Sprints a
-- 100% sem limitação") and mark them done with a single click. No separate
-- table needed: it's a small, ordered list that belongs to exactly one plan.
--
-- Shape: [{id: uuid, label: text, done: boolean}]
-- The `id` is generated client-side (crypto.randomUUID()) for stable React
-- keys; `done` is toggled via an UPDATE on the whole array.

ALTER TABLE rehab_plans
  ADD COLUMN IF NOT EXISTS rtp_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN rehab_plans.rtp_criteria IS
  'Manual RTP checklist — array of {id, label, done}. Toggled by clinicians.';
