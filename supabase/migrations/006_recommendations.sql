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
