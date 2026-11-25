-- 094 replaced resolve_diagnosis_and_cleanup with a 2-arg version
-- (p_diagnosis_id, p_resolved_at) via CREATE OR REPLACE — which, because the
-- signature changed, created a second overload instead of replacing 080's
-- original 1-arg one. Drop the stale overload so only the 2-arg version
-- remains callable.
--
-- (Already applied directly to the live database when 094 was built; this
-- file backfills it into the migration history for repo/DB parity.)

DROP FUNCTION IF EXISTS resolve_diagnosis_and_cleanup(uuid);
