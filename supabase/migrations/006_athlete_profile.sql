-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Athlete Profile — Medical, Documents, SCAT-6, RTP
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. athletes_medical_history
CREATE TABLE IF NOT EXISTS athletes_medical_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  height_cm       NUMERIC(5,1),
  weight_kg       NUMERIC(5,1),
  blood_type      TEXT,
  allergies       TEXT,
  intolerances    TEXT,
  family_history  JSONB DEFAULT '{}',
  surgical_history JSONB DEFAULT '[]',
  medications     JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (athlete_id)
);

-- 2. medical_documents
CREATE TABLE IF NOT EXISTS medical_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('emd','cardio','imaging','labs','dental','reports','other')),
  exam_type     TEXT,
  exam_date     DATE,
  file_url      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     BIGINT,
  file_type     TEXT,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes         TEXT,
  is_archived   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medical_docs_athlete ON medical_documents(athlete_id);
CREATE INDEX IF NOT EXISTS idx_medical_docs_category ON medical_documents(athlete_id, category);

-- 3. medical_consultations (SOAP notes)
CREATE TABLE IF NOT EXISTS medical_consultations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  consultation_date   DATE NOT NULL,
  consultation_time   TIME,
  clinician_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinician_name      TEXT,
  subjective          TEXT,
  objective           TEXT,
  assessment          TEXT,
  plan                TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consultations_athlete ON medical_consultations(athlete_id, consultation_date DESC);

-- 4. emd_submissions (Exame Médico-Desportivo)
CREATE TABLE IF NOT EXISTS emd_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  season           TEXT NOT NULL,              -- e.g. '2024/25'
  submission_date  DATE NOT NULL,
  exam_type        TEXT NOT NULL DEFAULT 'upload' CHECK (exam_type IN ('upload', 'form')),
  pdf_url          TEXT,
  decision         TEXT CHECK (decision IN ('apto', 'apto_com_restricoes', 'inapto')),
  restrictions     TEXT,
  clinician_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinician_name   TEXT,
  signature_date   DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emd_athlete_season ON emd_submissions(athlete_id, season);

-- 5. scat6_assessments
CREATE TABLE IF NOT EXISTS scat6_assessments (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id                    UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  season                        TEXT NOT NULL,
  is_baseline                   BOOLEAN DEFAULT FALSE,
  incident_date                 DATE,
  incident_time                 TIME,
  context                       TEXT,
  mechanism                     TEXT,
  loss_of_consciousness         BOOLEAN DEFAULT FALSE,
  loc_duration_seconds          INT,
  post_traumatic_amnesia        BOOLEAN DEFAULT FALSE,
  pta_duration_minutes          INT,
  -- Symptoms (JSONB: {symptom_key: 0-6})
  symptoms                      JSONB DEFAULT '{}',
  total_symptom_severity        INT DEFAULT 0 CHECK (total_symptom_severity BETWEEN 0 AND 132),
  -- Cognitive
  immediate_memory_best         INT CHECK (immediate_memory_best BETWEEN 0 AND 15),
  delayed_recall                INT CHECK (delayed_recall BETWEEN 0 AND 10),
  orientation_score             INT CHECK (orientation_score BETWEEN 0 AND 5),
  digits_backward_score         INT CHECK (digits_backward_score BETWEEN 0 AND 4),
  -- Balance (mBESS)
  balance_total_errors          INT DEFAULT 0 CHECK (balance_total_errors BETWEEN 0 AND 30),
  -- Totals
  total_scat6_score             INT DEFAULT 0,
  -- Diagnosis & RTP
  diagnosis                     TEXT CHECK (diagnosis IN ('confirmed','suspected','not_concussion')),
  rtp_current_stage             INT DEFAULT 0 CHECK (rtp_current_stage BETWEEN 0 AND 6),
  rtp_stages_completed          JSONB DEFAULT '{}',
  -- Comparison
  baseline_scat6_id             UUID REFERENCES scat6_assessments(id) ON DELETE SET NULL,
  score_change_from_baseline    INT,
  percent_change_from_baseline  NUMERIC(6,2),
  -- Metadata
  clinician_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clinician_name                TEXT,
  signed_at                     TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scat6_athlete ON scat6_assessments(athlete_id, is_baseline, created_at DESC);

-- 6. rtp_protocol_tracking
CREATE TABLE IF NOT EXISTS rtp_protocol_tracking (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scat6_assessment_id    UUID NOT NULL REFERENCES scat6_assessments(id) ON DELETE CASCADE,
  athlete_id             UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  stage                  INT NOT NULL CHECK (stage BETWEEN 1 AND 6),
  stage_name             TEXT NOT NULL,
  description            TEXT,
  minimum_duration_hours INT DEFAULT 24,
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  is_current             BOOLEAN DEFAULT FALSE,
  clinician_notes        TEXT,
  completed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE (scat6_assessment_id, stage)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE athletes_medical_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_consultations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE emd_submissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE scat6_assessments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtp_protocol_tracking      ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all clinical data
CREATE POLICY "auth_read_medical_history"   ON athletes_medical_history   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_documents"         ON medical_documents          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_consultations"     ON medical_consultations      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_emd"               ON emd_submissions            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_scat6"             ON scat6_assessments          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_rtp"               ON rtp_protocol_tracking      FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can insert
CREATE POLICY "auth_insert_medical_history" ON athletes_medical_history   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_documents"       ON medical_documents          FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_consultations"   ON medical_consultations      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_emd"             ON emd_submissions            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_scat6"           ON scat6_assessments          FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_rtp"             ON rtp_protocol_tracking      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update
CREATE POLICY "auth_update_medical_history" ON athletes_medical_history   FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_update_consultations"   ON medical_consultations      FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_update_scat6"           ON scat6_assessments          FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_update_rtp"             ON rtp_protocol_tracking      FOR UPDATE USING (auth.role() = 'authenticated');
