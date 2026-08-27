-- Migration 064 — Backfill injury_events for diagnoses 061 resolved directly.
--
-- 061's dedup step resolved every non-newest diagnosis in a duplicate group
-- with a direct UPDATE (is_resolved = true, resolved_at = now()), bypassing
-- resolveDiagnosis (lib/actions/clinical.ts) — which, for an 'injury'
-- diagnosis, also inserts a matching injury_events row so the athlete's
-- injury history/timeline (built from injury_events, not from raw diagnoses
-- rows) doesn't lose it. Any 'injury' diagnosis 061 resolved this way is now
-- invisible in the app despite still existing in the database.
--
-- resolved_by IS NULL identifies these rows precisely: resolveDiagnosis
-- always sets resolved_by from the authenticated session (possibly NULL
-- only in a genuinely unauthenticated call, which this app's RLS doesn't
-- allow for clinical writes), so an is_resolved diagnosis with no
-- resolved_by can only have been resolved by 061's raw UPDATE.
--
-- Mirrors resolveDiagnosis's own field derivation exactly (injury_date from
-- the linked occurrence's occurrence_date, falling back to diagnosed_at;
-- severity approximated from days_absent). confirmed_by is left NULL —
-- there's no clinician to attribute a migration-driven resolution to.
-- Guarded by NOT EXISTS on (athlete_id, injury_date, diagnosis) so this is
-- safe to run more than once.

INSERT INTO injury_events (
  athlete_id, injury_date, return_date, diagnosis, osiics_code,
  severity, days_absent, is_recurrence, confirmed_by
)
SELECT
  d.athlete_id,
  injury_date,
  return_date,
  diagnosis_text,
  d.osiics_code,
  CASE
    WHEN (return_date - injury_date) > 84 THEN 'severe'
    WHEN (return_date - injury_date) > 28 THEN 'major'
    WHEN (return_date - injury_date) > 7 THEN 'moderate'
    ELSE 'minor'
  END,
  GREATEST(0, return_date - injury_date),
  false,
  NULL
FROM diagnoses d
LEFT JOIN occurrences o ON o.id = d.occurrence_id
CROSS JOIN LATERAL (
  SELECT
    COALESCE(o.occurrence_date, d.diagnosed_at::date) AS injury_date,
    COALESCE(d.resolved_at::date, now()::date) AS return_date,
    COALESCE(d.osiics_description, d.custom_description, 'Diagnóstico sem descrição') AS diagnosis_text
) derived
WHERE d.is_resolved = true
  AND d.resolved_by IS NULL
  AND d.resolved_at IS NOT NULL
  AND d.diagnosis_type = 'injury'
  AND d.occurrence_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM injury_events ie
    WHERE ie.athlete_id = d.athlete_id
      AND ie.injury_date = injury_date
      AND ie.diagnosis = diagnosis_text
  );
