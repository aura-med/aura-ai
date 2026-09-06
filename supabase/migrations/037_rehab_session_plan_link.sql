-- Migration 037 — Link physio/rehab sessions to a rehab plan.
--
-- rehab_plans (034) is the *planned* day-by-day calendar; rehab_sessions
-- (008/027/033/035, the physio-log side of the naming collision — see 027's
-- comment for the history) is the *actual* session log physios fill in daily.
-- Physios need to tag a logged session against whichever plan it belongs to
-- (there can be more than one plan per athlete over a season), the same way
-- 033 let a session be tagged against an occurrence/diagnosis.
ALTER TABLE rehab_sessions
  ADD COLUMN IF NOT EXISTS rehab_plan_id UUID REFERENCES rehab_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rehab_sessions_plan ON rehab_sessions(rehab_plan_id);
