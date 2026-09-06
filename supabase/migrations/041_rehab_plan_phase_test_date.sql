-- Migration 041 — Progression-criteria test day on rehab_plan_phases.
--
-- A phase's `criteria` already holds free-text progression criteria; this
-- adds an optional day to actually test them against, shown as a marker on
-- that day's calendar cell. Deliberately just a marker (no pass/fail
-- workflow) — the physio still records the outcome as normal cell content
-- on that day, same as any other planned entry.

ALTER TABLE rehab_plan_phases
  ADD COLUMN IF NOT EXISTS test_date date;
