-- Aura Health & Performance Intelligence Platform
-- Database schema v1.1 — Supabase PostgreSQL (Frankfurt EU-West)
-- Architecture doc: Aura_Arquitectura_Tecnica_v1.1

-- Enable RLS on all tables
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations & squads ──────────────────────────────────────────────

CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN ('federation', 'club')) DEFAULT 'club',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE squads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT CHECK (type IN ('male', 'female')) DEFAULT 'male',
  season     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Athletes ─────────────────────────────────────────────────────────────

CREATE TABLE athletes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id         UUID REFERENCES squads(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organizations(id),
  name             TEXT NOT NULL,
  shirt_number     INT,
  position         TEXT CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  date_of_birth    DATE,
  club             TEXT,
  status           TEXT CHECK (status IN ('available', 'rehab')) DEFAULT 'available',
  -- Female cycle tracking
  menstrual_day    INT CHECK (menstrual_day BETWEEN 1 AND 35),
  cycle_length     INT DEFAULT 28,
  -- GDPR consent gate (architecture doc §7.2)
  consent_date     DATE,
  consent_version  TEXT,
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Trigger: block wellness/GPS inserts without consent
CREATE OR REPLACE FUNCTION check_athlete_consent()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM athletes
    WHERE id = NEW.athlete_id
    AND consent_date IS NOT NULL
    AND active = true
  ) THEN
    RAISE EXCEPTION 'Athlete consent not registered (GDPR gate)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Wellness checkins (from Athlete App) ─────────────────────────────────

CREATE TABLE wellness_checkins (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id           UUID REFERENCES athletes(id) ON DELETE CASCADE,
  checkin_date         DATE NOT NULL,
  checkin_type         TEXT CHECK (checkin_type IN ('morning', 'post_session')) DEFAULT 'morning',
  fatigue              INT CHECK (fatigue BETWEEN 1 AND 7),
  sleep_quality        INT CHECK (sleep_quality BETWEEN 1 AND 7),
  sleep_hours          FLOAT CHECK (sleep_hours BETWEEN 0 AND 24),
  doms                 INT CHECK (doms BETWEEN 1 AND 7),
  stress               INT CHECK (stress BETWEEN 1 AND 10),
  tqr                  INT CHECK (tqr BETWEEN 6 AND 20),
  hrv_ms               FLOAT,
  body_weight_kg       FLOAT,
  rpe                  FLOAT,
  session_duration_min INT,
  session_rpe          FLOAT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_id, checkin_date, checkin_type)
);

CREATE TRIGGER wellness_consent_check
  BEFORE INSERT ON wellness_checkins
  FOR EACH ROW EXECUTE FUNCTION check_athlete_consent();

-- ─── GPS sessions ─────────────────────────────────────────────────────────

CREATE TABLE gps_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID REFERENCES athletes(id) ON DELETE CASCADE,
  session_date       DATE NOT NULL,
  session_type       TEXT CHECK (session_type IN ('training', 'match', 'recovery')),
  total_distance_m   FLOAT,
  hsr_distance_m     FLOAT,
  sprint_distance_m  FLOAT,
  accel_high_count   INT,
  decel_high_count   INT,
  max_speed_kmh      FLOAT,
  player_load        FLOAT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER gps_consent_check
  BEFORE INSERT ON gps_sessions
  FOR EACH ROW EXECUTE FUNCTION check_athlete_consent();

-- ─── Injury events (critical for Phase 2 model calibration) ───────────────

CREATE TABLE injury_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID REFERENCES athletes(id) ON DELETE CASCADE,
  injury_date   DATE NOT NULL,
  return_date   DATE,
  diagnosis     TEXT,
  location      TEXT,
  mechanism     TEXT,
  severity      TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'severe')),
  days_absent   INT,
  is_recurrence BOOLEAN DEFAULT false,
  confirmed_by  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Model weights (versioned — Phase 1 expert, Phase 2 logistic regression)

CREATE TABLE model_weights (
  variable      TEXT PRIMARY KEY,
  weight        FLOAT NOT NULL CHECK (weight >= 0 AND weight <= 1),
  threshold_lo  FLOAT,
  threshold_hi  FLOAT,
  evidence_ref  TEXT,
  version       INT DEFAULT 1,
  n_events_used INT DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed Phase 1 weights (v1.1 — expert-defined, sums to 1.0)
INSERT INTO model_weights (variable, weight, threshold_lo, threshold_hi, evidence_ref) VALUES
  ('history', 0.20, 0,   1,   'Ekstrand BJSM 2022/23'),
  ('acwr',    0.20, 0.8, 1.5, 'Gabbett 2016; Rev.Syst. 2024'),
  ('hrv',     0.18, -5,  -30, 'Plews 2013; Sanchez 2025'),
  ('fatigue', 0.13, 4,   7,   'Hooper 1995; Neumann 2024'),
  ('sleep',   0.12, 7,   5,   'Meta-analysis OR=1.34 (2025)'),
  ('tqr',     0.07, 14,  9,   'Kenttä 1998'),
  ('stress',  0.04, 4,   7,   'Borato & Pedroni 2022'),
  ('decel',   0.04, 0.8, 1.5, 'Saberisani 2025 (AUC=0.91)'),
  ('md',      0.02, 4,   1,   'Chang 2024; Page 2023');

-- ─── Score history ─────────────────────────────────────────────────────────

CREATE TABLE score_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       UUID REFERENCES athletes(id) ON DELETE CASCADE,
  score_date       DATE NOT NULL,
  total_score      FLOAT NOT NULL CHECK (total_score BETWEEN 0 AND 1),
  acwr_partial     FLOAT,
  hrv_partial      FLOAT,
  fatigue_partial  FLOAT,
  sleep_partial    FLOAT,
  tqr_partial      FLOAT,
  history_partial  FLOAT,
  stress_partial   FLOAT,
  decel_partial    FLOAT,
  days_since_match INT,
  confidence       TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  weights_version  INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_id, score_date)
);

-- ─── Rehabilitation ────────────────────────────────────────────────────────

CREATE TABLE rehab_protocols (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  location   TEXT,
  total_days INT,
  color      TEXT,
  evidence   TEXT,
  phases     JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE rehab_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID REFERENCES athletes(id) ON DELETE CASCADE,
  protocol_id   UUID REFERENCES rehab_protocols(id),
  start_date    DATE NOT NULL,
  current_day   INT DEFAULT 1,
  rtp_criteria  JSONB NOT NULL DEFAULT '[]',
  clinical_data JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Calendar ──────────────────────────────────────────────────────────────

CREATE TABLE calendar_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id   UUID REFERENCES squads(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT CHECK (event_type IN ('rest', 'training', 'match', 'travel')),
  intensity  TEXT CHECK (intensity IN ('low', 'medium', 'high', 'max')),
  label      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Fatigue profiles ──────────────────────────────────────────────────────

CREATE TABLE fatigue_profiles (
  athlete_id              UUID PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
  recovery_speed          FLOAT DEFAULT 1.0 CHECK (recovery_speed BETWEEN 0.5 AND 2.0),
  congestion_sensitivity  FLOAT DEFAULT 1.0 CHECK (congestion_sensitivity BETWEEN 0.5 AND 2.0),
  typical_md1_drop        INT DEFAULT 12,
  typical_md2_drop        INT DEFAULT 7,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ─── Performance snapshots ─────────────────────────────────────────────────

CREATE TABLE performance_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID REFERENCES athletes(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  vmax            FLOAT,
  vmax_today_pct  INT,
  dist_max        FLOAT,
  hsr_max         INT,
  sprint_max      INT,
  n_sprints_max   INT,
  accel_max       INT,
  decel_max       INT,
  player_load_max FLOAT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── Athlete passport ──────────────────────────────────────────────────────

CREATE TABLE athlete_passport (
  athlete_id    UUID PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
  passport_data JSONB DEFAULT '{}',
  is_shareable  BOOLEAN DEFAULT false,
  share_token   TEXT UNIQUE,
  last_updated  TIMESTAMPTZ DEFAULT now()
);

-- ─── Auth profiles (RBAC) ──────────────────────────────────────────────────

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID REFERENCES organizations(id),
  role       TEXT CHECK (role IN ('admin','doctor','physio','coach','fitness_coach','athlete')),
  full_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE squads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;

-- Org member helper
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Athletes: all org members can read; doctor/physio/admin can write
CREATE POLICY athletes_select ON athletes FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY athletes_insert ON athletes FOR INSERT
  WITH CHECK (
    org_id = get_user_org_id()
    AND get_user_role() IN ('admin', 'doctor', 'physio')
  );

CREATE POLICY athletes_update ON athletes FOR UPDATE
  USING (org_id = get_user_org_id())
  WITH CHECK (get_user_role() IN ('admin', 'doctor', 'physio'));

-- Score history: clinical roles see all; athletes see own only
CREATE POLICY score_history_clinical ON score_history FOR SELECT
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

CREATE POLICY score_history_athlete ON score_history FOR SELECT
  USING (
    get_user_role() = 'athlete'
    AND athlete_id IN (SELECT id FROM athletes WHERE id::text = auth.uid()::text)
  );

-- Wellness: all org members can insert; clinical roles can read all
CREATE POLICY wellness_insert ON wellness_checkins FOR INSERT
  WITH CHECK (
    athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

CREATE POLICY wellness_select_clinical ON wellness_checkins FOR SELECT
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- Rehab: doctor/physio write; coach/athlete (own) read
CREATE POLICY rehab_clinical_write ON rehab_sessions FOR ALL
  USING (get_user_role() IN ('admin', 'doctor', 'physio'));

CREATE POLICY rehab_others_read ON rehab_sessions FOR SELECT
  USING (
    get_user_role() IN ('coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- Calendar: admin/coach write; all org members read
CREATE POLICY calendar_write ON calendar_events FOR ALL
  USING (get_user_role() IN ('admin', 'coach'));

CREATE POLICY calendar_read ON calendar_events FOR SELECT
  USING (
    squad_id IN (SELECT id FROM squads WHERE org_id = get_user_org_id())
  );

-- Profiles: own row only
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_athletes_squad ON athletes(squad_id);
CREATE INDEX idx_athletes_org ON athletes(org_id);
CREATE INDEX idx_wellness_athlete_date ON wellness_checkins(athlete_id, checkin_date DESC);
CREATE INDEX idx_gps_athlete_date ON gps_sessions(athlete_id, session_date DESC);
CREATE INDEX idx_score_athlete_date ON score_history(athlete_id, score_date DESC);
CREATE INDEX idx_injury_athlete ON injury_events(athlete_id, injury_date DESC);
CREATE INDEX idx_calendar_squad_date ON calendar_events(squad_id, event_date);
