-- 095 extended update_diagnosis_and_mirror with 13 new trailing params the
-- same way it extended create_diagnosis_and_mirror — leaving behind a stale
-- 9-arg overload (095's CREATE OR REPLACE created a new, distinct-arity
-- overload rather than replacing it, the same issue already cleaned up for
-- create_diagnosis_and_mirror in 099 and resolve_diagnosis_and_cleanup in
-- 097/102). Harmless as-is (Postgres prefers the fewest-defaults match) but
-- dead weight now that every caller passes the full parameter list.
DROP FUNCTION IF EXISTS update_diagnosis_and_mirror(
  uuid, text, text, text, text, text, text[], text, uuid
);
