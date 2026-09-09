-- Migration 076 — Null out pre-existing cross-athlete rehab_session/plan links.
--
-- 052 installed a BEFORE INSERT OR UPDATE trigger enforcing that
-- rehab_sessions.rehab_plan_id belongs to the same athlete_id, but only
-- validates future writes. In the window before 052 was applied, an
-- authorized Data API caller could have stored a session for athlete A
-- with a plan belonging to athlete B — 037's FK only checked the plan
-- existed, not who it belonged to. Any such existing mismatch stays
-- forever, with the UI continuing to associate that session with another
-- athlete's plan. Same "clean before/alongside constraining" shape as
-- 072's dedup step for rehab_plan_days.phase_id.

UPDATE rehab_sessions s
SET rehab_plan_id = NULL
WHERE s.rehab_plan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rehab_plans p
    WHERE p.id = s.rehab_plan_id AND p.athlete_id = s.athlete_id
  );
