-- Migration 038 — "Gestão de Carga" becomes a 5th availability_status value,
-- replacing the plan_type approach from migration 036.
--
-- Real-world testing showed the plan_type/badge approach (036) doesn't match
-- how the club actually works: gestão de carga isn't a treatment plan, it's
-- an availability signal for coaches/fitness staff ("this player trains, but
-- is conditioned") — always tied to an open occurrence/diagnosis, exactly
-- like the other 4 availability states already are. Bolting it onto
-- rehab_plans meant it only showed up for athletes who also had a full
-- day-by-day plan, and required every athlete listing (squad/athletes/
-- dashboard) to remember a second, separate signal alongside
-- availability_status. Folding it into availability_status instead means
-- every existing consumer (dashboard groupings, PDF exports, notifications,
-- STATUS_CONFIG maps) picks it up for free, the same way it already handles
-- 'rtp' or 'evaluation'.
--
-- 1. Revert 036 — drop plan_type from rehab_plans. rehab_plans/phases/days
--    keep working exactly as before as the clinical day-by-day calendar tool;
--    they're just no longer the thing that flags an athlete's availability.
DROP INDEX IF EXISTS idx_rehab_plans_type;
ALTER TABLE rehab_plans DROP COLUMN IF EXISTS plan_type;

-- 2. Add 'load_management' everywhere availability_status is constrained.
-- Constraints were declared inline (no explicit name), so look each one up
-- by table+column rather than guessing Postgres's auto-generated name.
DO $$
DECLARE
  r record;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['athletes', 'occurrences', 'occurrence_records', 'diagnoses']
  LOOP
    FOR r IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'c'
        AND rel.relname = t
        AND att.attname = 'availability_status'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, r.conname);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE athletes
  ADD CONSTRAINT athletes_availability_status_check
  CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp', 'load_management'));

ALTER TABLE occurrences
  ADD CONSTRAINT occurrences_availability_status_check
  CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp', 'load_management'));

ALTER TABLE occurrence_records
  ADD CONSTRAINT occurrence_records_availability_status_check
  CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp', 'load_management'));

ALTER TABLE diagnoses
  ADD CONSTRAINT diagnoses_availability_status_check
  CHECK (availability_status IN ('available', 'evaluation', 'unavailable', 'rtp', 'load_management'));

-- update_athlete_availability (013) and the occurrence/diagnosis actions
-- write `text` with no constraint of their own — the CHECK above is what
-- actually validates the value, so no RPC signature changes are needed.
