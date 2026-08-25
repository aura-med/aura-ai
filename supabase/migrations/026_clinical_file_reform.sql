-- Migration 026 — Clinical file reform: anamnese, nutrition, training plans,
-- occurrence titles, orthotics removal, dead-column cleanup.

-- ═══ 1. Dead column cleanup ═══════════════════════════════════════════════════
-- injury_events.availability_status (002) and rehab_sessions.availability_status
-- (002) use a different 4-value enum (unfit/modified/monitoring/recovered) than
-- the rest of the system (available/evaluation/unavailable/rtp) and are never
-- read by any UI component — confirmed by a full-codebase search. Drop them.
ALTER TABLE injury_events  DROP COLUMN IF EXISTS availability_status;
ALTER TABLE rehab_sessions DROP COLUMN IF EXISTS availability_status;

-- ═══ 2. Occurrences: title field ══════════════════════════════════════════════
-- Occurrences were only ever listed by date; clinicians need a short label to
-- tell rows apart at a glance without opening each one.
ALTER TABLE occurrences ADD COLUMN IF NOT EXISTS title TEXT;

-- ═══ 3. Remove orthotics entirely (unused) ════════════════════════════════════
-- Two parallel, never-consolidated representations existed: the JSONB
-- `athletes_medical_history.orthotics` legacy list and the `orthosis_records`
-- clinical table. Neither is in active use — drop both rather than merge.
DROP TABLE IF EXISTS orthosis_records CASCADE;
DROP FUNCTION IF EXISTS set_orthosis_registrar() CASCADE;
DROP FUNCTION IF EXISTS freeze_orthosis_registrar() CASCADE;
ALTER TABLE athletes_medical_history DROP COLUMN IF EXISTS orthotics;

-- ═══ 4. Anamnese / Ficha Clínica (structured pre-season medical assessment) ═══
-- One row per athlete per season. Free-text fields mirror the club's existing
-- paper template (histórico de lesões, condições pré-existentes, exame
-- objetivo, exames complementares) — clinicians write prose, consistent with
-- how the rest of the app records clinical findings (occurrences, consultas).
CREATE TABLE IF NOT EXISTS athlete_anamnesis (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id                UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id                    UUID REFERENCES organizations(id),
  season                    TEXT NOT NULL,
  assessment_date           DATE,
  -- Anamnese médica
  injury_history            TEXT,
  preexisting_conditions    TEXT,
  current_medications       TEXT,
  drug_allergies            TEXT,
  food_allergies            TEXT,
  cardiovascular_red_flags  TEXT,
  family_history            TEXT,
  -- Exame objetivo
  blood_pressure            TEXT,
  heart_rate_bpm            INT,
  cardiac_auscultation      TEXT,
  pulmonary_auscultation    TEXT,
  abdominal_exam            TEXT,
  lower_limb_inspection     TEXT,
  foot_structure            TEXT,
  knee_alignment            TEXT,
  knee_stability_tests      TEXT,
  ankle_stability_tests     TEXT,
  ultrasound_assessment     TEXT,
  -- Exames complementares de diagnóstico (freeform: isocinética, ecocardiograma,
  -- prova de esforço, Rx, etc. — variable per athlete, not worth hardcoding)
  complementary_exams       TEXT,
  -- Observações finais e recomendações
  final_observations        TEXT,
  clinician_id              UUID REFERENCES auth.users(id),
  clinician_name            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, season)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_athlete ON athlete_anamnesis(athlete_id, season);

ALTER TABLE athlete_anamnesis ENABLE ROW LEVEL SECURITY;

-- Same access model as athletes_medical_history (022): owner (org-wide) +
-- doctor/physio/masseur (own squads only).
DROP POLICY IF EXISTS "anamnesis_read" ON athlete_anamnesis;
CREATE POLICY "anamnesis_read" ON athlete_anamnesis FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "anamnesis_insert" ON athlete_anamnesis;
CREATE POLICY "anamnesis_insert" ON athlete_anamnesis FOR INSERT
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "anamnesis_update" ON athlete_anamnesis;
CREATE POLICY "anamnesis_update" ON athlete_anamnesis FOR UPDATE
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- ═══ 5. Nutrition: daily weight (physio/masseur/nutritionist/owner write) ═════
CREATE TABLE IF NOT EXISTS athlete_daily_weight (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organizations(id),
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg        NUMERIC(5,2) NOT NULL,
  recorded_by      UUID REFERENCES auth.users(id),
  recorded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, measurement_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_weight_athlete ON athlete_daily_weight(athlete_id, measurement_date DESC);

ALTER TABLE athlete_daily_weight ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_weight_read" ON athlete_daily_weight;
CREATE POLICY "daily_weight_read" ON athlete_daily_weight FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "daily_weight_write" ON athlete_daily_weight;
CREATE POLICY "daily_weight_write" ON athlete_daily_weight FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

-- Freeze the recorder identity so an update can't reattribute a weigh-in.
CREATE OR REPLACE FUNCTION freeze_daily_weight_author()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.recorded_by := OLD.recorded_by;
  NEW.recorded_by_name := OLD.recorded_by_name;
  NEW.athlete_id := OLD.athlete_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_freeze_daily_weight_author ON athlete_daily_weight;
CREATE TRIGGER trg_freeze_daily_weight_author
  BEFORE UPDATE ON athlete_daily_weight
  FOR EACH ROW EXECUTE FUNCTION freeze_daily_weight_author();

CREATE OR REPLACE FUNCTION set_daily_weight_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recorded_by := auth.uid();
  NEW.recorded_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_daily_weight_author ON athlete_daily_weight;
CREATE TRIGGER trg_set_daily_weight_author
  BEFORE INSERT ON athlete_daily_weight
  FOR EACH ROW EXECUTE FUNCTION set_daily_weight_author();

-- ═══ 6. Nutrition: periodic skinfold/perimeter/urine assessments (nutritionist-only write) ═══
CREATE TABLE IF NOT EXISTS nutrition_assessments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id             UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id                 UUID REFERENCES organizations(id),
  assessment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 8-site skinfolds (mm)
  skinfold_tricep_mm     NUMERIC(4,1),
  skinfold_subscapular_mm NUMERIC(4,1),
  skinfold_bicep_mm      NUMERIC(4,1),
  skinfold_iliac_mm      NUMERIC(4,1),  -- supra-ilíaca
  skinfold_supraspinal_mm NUMERIC(4,1),
  skinfold_abdominal_mm  NUMERIC(4,1),
  skinfold_thigh_mm      NUMERIC(4,1),  -- crural
  skinfold_calf_mm       NUMERIC(4,1),  -- geminal
  -- 6 perimeters (cm)
  perimeter_arm_relaxed_cm NUMERIC(5,1),
  perimeter_arm_flexed_cm  NUMERIC(5,1),
  perimeter_waist_cm       NUMERIC(5,1),
  perimeter_hip_cm         NUMERIC(5,1),
  perimeter_thigh_cm       NUMERIC(5,1), -- medial da coxa
  perimeter_calf_cm        NUMERIC(5,1), -- geminal
  urine_specific_gravity NUMERIC(5,3),
  recorded_by            UUID REFERENCES auth.users(id),
  recorded_by_name       TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_athlete ON nutrition_assessments(athlete_id, assessment_date DESC);

ALTER TABLE nutrition_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutrition_read" ON nutrition_assessments;
CREATE POLICY "nutrition_read" ON nutrition_assessments FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'nutritionist')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
-- Only the nutritionist (+ owner) inserts/edits skinfolds and urine specific
-- gravity — explicitly narrower than the read audience above.
DROP POLICY IF EXISTS "nutrition_write" ON nutrition_assessments;
CREATE POLICY "nutrition_write" ON nutrition_assessments FOR ALL
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

CREATE OR REPLACE FUNCTION freeze_nutrition_author()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.recorded_by := OLD.recorded_by;
  NEW.recorded_by_name := OLD.recorded_by_name;
  NEW.athlete_id := OLD.athlete_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_freeze_nutrition_author ON nutrition_assessments;
CREATE TRIGGER trg_freeze_nutrition_author
  BEFORE UPDATE ON nutrition_assessments
  FOR EACH ROW EXECUTE FUNCTION freeze_nutrition_author();

CREATE OR REPLACE FUNCTION set_nutrition_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recorded_by := auth.uid();
  NEW.recorded_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_nutrition_author ON nutrition_assessments;
CREATE TRIGGER trg_set_nutrition_author
  BEFORE INSERT ON nutrition_assessments
  FOR EACH ROW EXECUTE FUNCTION set_nutrition_author();

-- Per-athlete skinfold-sum limit (mm). Club reference values: 60mm goalkeepers,
-- 58mm central defenders/forwards, 55mm the rest — but the app's position enum
-- (GK/DEF/MID/FWD) can't distinguish "central" from other outfield roles, and
-- the club has case-by-case exceptions anyway. Store it explicitly per athlete
-- instead of deriving it, so the nutritionist sets the real applicable value.
ALTER TABLE athletes_medical_history ADD COLUMN IF NOT EXISTS skinfold_limit_mm NUMERIC(4,1);

-- ═══ 7. Individual training plans (one PDF per athlete, coaching-scoped) ══════
CREATE TABLE IF NOT EXISTS training_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organizations(id),
  file_url         TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_size        BIGINT,
  uploaded_by      UUID REFERENCES auth.users(id),
  uploaded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_plans_athlete ON training_plans(athlete_id, created_at DESC);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

-- Broader than clinical: this is a coaching artifact, not a medical record.
-- Read: owner + clinical staff + coaching staff (own squads). Write: owner +
-- coach/fitness_coach/physio (the roles that actually produce these plans).
DROP POLICY IF EXISTS "training_plans_read" ON training_plans;
CREATE POLICY "training_plans_read" ON training_plans FOR SELECT
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('doctor', 'physio', 'masseur', 'coach', 'fitness_coach')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );
DROP POLICY IF EXISTS "training_plans_write" ON training_plans;
CREATE POLICY "training_plans_write" ON training_plans FOR ALL
  USING (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('coach', 'fitness_coach', 'physio')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  )
  WITH CHECK (
    (get_user_role() = 'owner' AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id()))
    OR (
      get_user_role() IN ('coach', 'fitness_coach', 'physio')
      AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id() AND squad_id IN (SELECT get_user_squad_ids()))
    )
  );

CREATE OR REPLACE FUNCTION freeze_training_plan_author()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.uploaded_by := OLD.uploaded_by;
  NEW.uploaded_by_name := OLD.uploaded_by_name;
  NEW.athlete_id := OLD.athlete_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_freeze_training_plan_author ON training_plans;
CREATE TRIGGER trg_freeze_training_plan_author
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION freeze_training_plan_author();

CREATE OR REPLACE FUNCTION set_training_plan_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.uploaded_by := auth.uid();
  NEW.uploaded_by_name := (SELECT full_name FROM profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_training_plan_author ON training_plans;
CREATE TRIGGER trg_set_training_plan_author
  BEFORE INSERT ON training_plans
  FOR EACH ROW EXECUTE FUNCTION set_training_plan_author();

-- ═══ 8. Storage bucket for training plan PDFs ═════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-plans', 'training-plans', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "training_plans_storage_read" ON storage.objects;
CREATE POLICY "training_plans_storage_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'training-plans'
    AND (
      get_user_role() = 'owner'
      OR get_user_role() IN ('doctor', 'physio', 'masseur', 'coach', 'fitness_coach')
    )
  );
DROP POLICY IF EXISTS "training_plans_storage_write" ON storage.objects;
CREATE POLICY "training_plans_storage_write" ON storage.objects FOR ALL
  USING (
    bucket_id = 'training-plans'
    AND (get_user_role() = 'owner' OR get_user_role() IN ('coach', 'fitness_coach', 'physio'))
  )
  WITH CHECK (
    bucket_id = 'training-plans'
    AND (get_user_role() = 'owner' OR get_user_role() IN ('coach', 'fitness_coach', 'physio'))
  );
