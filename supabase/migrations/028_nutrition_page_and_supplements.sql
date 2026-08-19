-- Migration 028 — Team-wide Nutrição page support + athlete supplements list.
--
-- The team-wide /nutrition page reads/writes the SAME athlete_daily_weight and
-- nutrition_assessments tables as the athlete clinical file's Nutrição tab
-- (migration 026), so the two stay in sync automatically — no new tables
-- needed for that part. This migration only adds:
--   1. athlete_supplements — list + add supplements in the clinical file.

CREATE TABLE IF NOT EXISTS athlete_supplements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organizations(id),
  name             TEXT NOT NULL,
  dosage           TEXT,
  frequency        TEXT,
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,
  notes            TEXT,
  recorded_by      UUID REFERENCES auth.users(id),
  recorded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplements_athlete ON athlete_supplements(athlete_id, start_date DESC);

ALTER TABLE athlete_supplements ENABLE ROW LEVEL SECURITY;

-- Same read audience as nutrition_assessments (022/026 pattern): owner
-- (org-wide) + doctor/physio/masseur/nutritionist (own squads).
DROP POLICY IF EXISTS "supplements_read" ON athlete_supplements;
CREATE POLICY "supplements_read" ON athlete_supplements FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
-- Write: owner + nutritionist only, matching nutrition_assessments (the
-- nutritionist owns the supplementation plan).
DROP POLICY IF EXISTS "supplements_write" ON athlete_supplements;
CREATE POLICY "supplements_write" ON athlete_supplements FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() = 'nutritionist'
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() = 'nutritionist'
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

CREATE OR REPLACE FUNCTION freeze_supplement_author()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.recorded_by := OLD.recorded_by;
  NEW.recorded_by_name := OLD.recorded_by_name;
  NEW.athlete_id := OLD.athlete_id;
  NEW.org_id := OLD.org_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_freeze_supplement_author ON athlete_supplements;
CREATE TRIGGER trg_freeze_supplement_author
  BEFORE UPDATE ON athlete_supplements
  FOR EACH ROW EXECUTE FUNCTION freeze_supplement_author();

CREATE OR REPLACE FUNCTION set_supplement_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recorded_by := auth.uid();
  NEW.recorded_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_supplement_author ON athlete_supplements;
CREATE TRIGGER trg_set_supplement_author
  BEFORE INSERT ON athlete_supplements
  FOR EACH ROW EXECUTE FUNCTION set_supplement_author();
