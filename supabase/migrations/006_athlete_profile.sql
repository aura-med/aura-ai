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


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "006" (006_recommendations.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: 007_fix_rls.sql (unchanged, still at 007) references recommendation_log directly — it must exist by the time 007 runs, not after.
-- Merging into the file that already holds this version preserves the exact
-- original ordering relative to every other migration.
--
-- Caveat (Codex) resolved: see 077's header for the full reasoning — only
-- the lowest-numbered of these six pairs ("002") could ever have had its
-- version pre-recorded from just one half before this branch's merge fix
-- existed; db push stops at the first failure, so "006" and every higher
-- pair here could only be reached (and hence recorded) AFTER the merge
-- fix already made both halves part of the same file. Not at risk — and
-- 007 (immediately after) directly depends on recommendation_log existing,
-- so if 006 had been skipped, 007 would have failed too, stalling the
-- entire push long before it ever reached 034/061 as it's now confirmed to
-- have.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 006_recommendations.sql
-- Aura — Recommendations Model
-- Tables: org_recommendation_config · org_recommendation_overrides · recommendation_log
--
-- Architecture:
--   • Base rules live in code (lib/recommendations.ts) — versioned, reviewed clinically
--   • Org config overrides thresholds + weights per club/federation
--   • Org rule overrides customise text (never clinical direction)
--   • recommendation_log is append-only — EU AI Act Art. 12 compliance
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. org_recommendation_config ────────────────────────────────────────────
-- One row per organisation. Created by platform admins via admin portal.
-- Stores risk thresholds and variable weight overrides.

CREATE TABLE IF NOT EXISTS org_recommendation_config (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Risk band thresholds (score 0–100)
  -- Defaults match Aura v1.1 model
  risk_thresholds jsonb NOT NULL DEFAULT
    '{"medium": 40, "high": 65, "critical": 85}'::jsonb,

  -- Variable weights (should sum to 1.0; validated in application layer)
  -- Defaults match BASE_WEIGHTS_V1 in lib/scoring/engine.ts
  variable_weights jsonb NOT NULL DEFAULT
    '{"history":0.20,"acwr":0.20,"hrv":0.18,"fatigue":0.13,"sleep":0.12,"tqr":0.07,"stress":0.04,"decel":0.04,"md":0.02}'::jsonb,

  -- Deployment context affects ACWR calculation and rule selection
  context_type  text NOT NULL DEFAULT 'club' CHECK (context_type IN ('club', 'federation')),

  -- Language for recommendation text
  language      text NOT NULL DEFAULT 'pt'   CHECK (language IN ('pt', 'en', 'es')),

  -- Platform audit
  updated_by    uuid REFERENCES auth.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE org_recommendation_config IS
  'Per-organisation configuration for the Aura recommendations model. '
  'Managed exclusively by Aura platform admins. '
  'Absence of a row means the org uses global defaults.';

COMMENT ON COLUMN org_recommendation_config.risk_thresholds IS
  'JSON: {"medium": N, "high": N, "critical": N} — score 0-100 boundaries.';

COMMENT ON COLUMN org_recommendation_config.variable_weights IS
  'JSON: weight per variable — must sum to 1.0. Validated in application layer.';


-- ─── 2. org_recommendation_overrides ─────────────────────────────────────────
-- Allows per-org customisation of individual recommendation rules.
-- CRITICAL CONSTRAINT: override_type = 'text_only' preserves clinical_direction.
-- Platform admins cannot invert clinical guidance through overrides.

CREATE TABLE IF NOT EXISTS org_recommendation_overrides (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Rule coordinates
  variable    text NOT NULL,  -- e.g. 'acwr', 'sleep', 'hrv'
  risk_level  text NOT NULL CHECK (risk_level  IN ('low', 'medium', 'high', 'critical')),
  stakeholder text NOT NULL CHECK (stakeholder IN ('clinical', 'coach', 'athlete')),

  -- Override behaviour
  -- 'text_only'  → replace rule text with custom_text; clinical_direction is unchanged
  -- 'add_rule'   → append a supplementary rule alongside base rules
  -- 'deactivate' → hide the base rule for this org; requires justification
  override_type text NOT NULL CHECK (override_type IN ('text_only', 'add_rule', 'deactivate')),

  -- Custom content (text_only + add_rule)
  custom_text   text,
  custom_icon   text,
  custom_timing text,

  -- Mandatory for deactivate — creates audit trail for EU AI Act
  justification text,

  is_active boolean NOT NULL DEFAULT true,

  -- Platform audit
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, variable, risk_level, stakeholder, override_type)
);

COMMENT ON TABLE org_recommendation_overrides IS
  'Per-org overrides for individual recommendation rules. '
  'text_only overrides may only customise presentation — clinical direction is immutable. '
  'deactivate overrides require written justification for audit purposes.';

COMMENT ON COLUMN org_recommendation_overrides.override_type IS
  'text_only: changes wording only. add_rule: appends supplementary rule. '
  'deactivate: hides base rule (requires justification — EU AI Act traceability).';


-- ─── 3. recommendation_log ───────────────────────────────────────────────────
-- Append-only audit log. Every generated RecommendationSet is persisted here.
-- EU AI Act Art. 12: immutable record of model outputs with full traceability.
-- NEVER add UPDATE or DELETE RLS policies to this table.

CREATE TABLE IF NOT EXISTS recommendation_log (
  id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source linkage
  score_history_id  uuid REFERENCES score_history(id),
  athlete_id        uuid NOT NULL REFERENCES athletes(id),
  org_id            uuid REFERENCES organizations(id),

  -- Model state at generation time
  generated_at      timestamptz NOT NULL DEFAULT now(),
  risk_level        text NOT NULL,
  dominant_variable text,
  confidence        text,
  model_version     integer NOT NULL DEFAULT 1,

  -- Full recommendation snapshots (stored at generation — immutable)
  clinical_recs  jsonb NOT NULL DEFAULT '[]'::jsonb,
  athlete_recs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  coach_recs     jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Engine metadata
  generated_by         text NOT NULL DEFAULT 'scoring_engine_v1',
  org_config_snapshot  jsonb,  -- snapshot of org_recommendation_config used

  -- Non-destructive acknowledgment tracking
  clinical_acknowledged_at  timestamptz,
  clinical_acknowledged_by  uuid REFERENCES auth.users(id),
  coach_acknowledged_at     timestamptz,
  coach_acknowledged_by     uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE recommendation_log IS
  'Immutable audit log of all generated recommendation sets. '
  'EU AI Act Art. 12 compliance: every model output is persisted with full context. '
  'No UPDATE or DELETE policies — append-only by design.';


-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_rec_config_org
  ON org_recommendation_config(org_id);

CREATE INDEX IF NOT EXISTS idx_org_rec_overrides_org
  ON org_recommendation_overrides(org_id);

CREATE INDEX IF NOT EXISTS idx_org_rec_overrides_lookup
  ON org_recommendation_overrides(org_id, variable, risk_level, stakeholder)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rec_log_athlete
  ON recommendation_log(athlete_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rec_log_score
  ON recommendation_log(score_history_id);

CREATE INDEX IF NOT EXISTS idx_rec_log_org_date
  ON recommendation_log(org_id, generated_at DESC);


-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE org_recommendation_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_recommendation_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_log           ENABLE ROW LEVEL SECURITY;

-- org_recommendation_config: org staff can read their own config
DROP POLICY IF EXISTS "org staff read own rec config" ON org_recommendation_config;
CREATE POLICY "org staff read own rec config"
  ON org_recommendation_config FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid() AND org_id IS NOT NULL
    )
  );

-- org_recommendation_overrides: org staff can read their own overrides
DROP POLICY IF EXISTS "org staff read own rec overrides" ON org_recommendation_overrides;
CREATE POLICY "org staff read own rec overrides"
  ON org_recommendation_overrides FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid() AND org_id IS NOT NULL
    )
  );

-- recommendation_log: clinical + coaching staff can read their org's logs
DROP POLICY IF EXISTS "clinical staff read own org rec logs" ON recommendation_log;
CREATE POLICY "clinical staff read own org rec logs"
  ON recommendation_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND org_id IS NOT NULL
        AND role IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    )
  );

-- recommendation_log: acknowledgment update (non-destructive — only timestamp columns)
-- Physio/doctor can acknowledge clinical recs; coach can acknowledge coach recs
DROP POLICY IF EXISTS "clinical staff acknowledge recs" ON recommendation_log;
CREATE POLICY "clinical staff acknowledge recs"
  ON recommendation_log FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'doctor', 'physio')
    )
  )
  WITH CHECK (
    -- Only acknowledgment fields can be written; core data is immutable
    clinical_acknowledged_at IS NOT NULL OR coach_acknowledged_at IS NOT NULL
  );

DROP POLICY IF EXISTS "coach staff acknowledge recs" ON recommendation_log;
CREATE POLICY "coach staff acknowledge recs"
  ON recommendation_log FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'coach', 'fitness_coach')
    )
  )
  WITH CHECK (
    coach_acknowledged_at IS NOT NULL
  );
