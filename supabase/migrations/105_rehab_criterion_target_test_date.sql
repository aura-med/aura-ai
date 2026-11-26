-- Migration 105 — Scheduled test date per rehab phase criterion
-- (user feedback: a criterion like "LSI > 90%" needs a planned date to be
-- tested, not just a completed_at stamped whenever someone happens to tick
-- it). target_test_date is the plan; completed_at (096) stays the actual
-- sign-off moment — they can differ (tested late, or not on the planned day).

ALTER TABLE rehab_phase_criteria
  ADD COLUMN target_test_date date;
