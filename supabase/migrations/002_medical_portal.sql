-- Aura Medical Portal — Schema additions v1.2
-- Run in: Supabase → SQL Editor
-- Adds OSIICS linkage, availability status, and RLS policies for the medical dashboard.

-- ─── 1. Link injury_events to OSIICS coding ──────────────────────────────────

ALTER TABLE injury_events
  ADD COLUMN IF NOT EXISTS osiics_code CHAR(4),
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IN ('unfit', 'modified', 'monitoring', 'recovered'))
    DEFAULT 'unfit';

-- FK: only if dim_osiics_codes exists in the same schema
-- ALTER TABLE injury_events
--   ADD CONSTRAINT fk_injury_osiics
--   FOREIGN KEY (osiics_code) REFERENCES dim_osiics_codes(code);

-- ─── 2. Link rehab_sessions to injury_events ─────────────────────────────────

ALTER TABLE rehab_sessions
  ADD COLUMN IF NOT EXISTS injury_event_id UUID REFERENCES injury_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IN ('unfit', 'modified', 'monitoring'))
    DEFAULT 'unfit';

-- Index for fast dashboard query
CREATE INDEX IF NOT EXISTS idx_rehab_injury ON rehab_sessions(injury_event_id);

-- ─── 3. RLS: allow clinical staff to read dim_osiics_codes ───────────────────

-- Enable RLS if not already on
ALTER TABLE dim_osiics_codes ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user (doctor/physio/admin/coach) to read
DROP POLICY IF EXISTS "clinical_read_osiics" ON dim_osiics_codes;
CREATE POLICY "clinical_read_osiics" ON dim_osiics_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 4. RLS: rehab_protocols readable by clinical staff ──────────────────────

ALTER TABLE rehab_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_read_protocols" ON rehab_protocols;
CREATE POLICY "clinical_read_protocols" ON rehab_protocols
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 5. Allow clinical staff to insert injury events ─────────────────────────

DROP POLICY IF EXISTS "injury_clinical_insert" ON injury_events;
CREATE POLICY "injury_clinical_insert" ON injury_events
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
  );

DROP POLICY IF EXISTS "injury_clinical_update" ON injury_events;
CREATE POLICY "injury_clinical_update" ON injury_events
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
  );

DROP POLICY IF EXISTS "injury_clinical_select" ON injury_events;
CREATE POLICY "injury_clinical_select" ON injury_events
  FOR SELECT USING (
    get_user_role() IN ('admin', 'doctor', 'physio', 'coach', 'fitness_coach')
    AND athlete_id IN (SELECT id FROM athletes WHERE org_id = get_user_org_id())
  );

-- ─── 6. Allow clinical staff to insert rehab sessions ────────────────────────

DROP POLICY IF EXISTS "rehab_clinical_insert" ON rehab_sessions;
CREATE POLICY "rehab_clinical_insert" ON rehab_sessions
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
  );

-- ─── 7. Edge function model weights: allow clinical staff to read ─────────────

DROP POLICY IF EXISTS "model_weights_read" ON model_weights;
CREATE POLICY "model_weights_read" ON model_weights
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON COLUMN rehab_sessions.clinical_data IS
  'JSONB store: { notes: [{text, created_at, author}], phase_progress: { [phaseId]: boolean[] } }';


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "002" (002_notifications.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: Codex found it broke fresh installs (007_fix_rls depends on recommendation_log existing early for the 006 case) and reintroduced pre-hardening RLS policies (017/018/021) for others.
-- Merging into the file that already holds this version preserves the exact
-- original ordering relative to every other migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  squad_id    uuid REFERENCES squads(id) ON DELETE SET NULL,
  athlete_id  uuid REFERENCES athletes(id) ON DELETE SET NULL,
  type        text NOT NULL CHECK (type IN (
    'score_critical', 'score_high', 'injury_new',
    'rehab_update', 'checkin_missing', 'rtp_ready', 'readiness_drop'
  )),
  title       text NOT NULL,
  body        text,
  metadata    jsonb DEFAULT '{}',
  read_by     uuid[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON notifications (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_athlete
  ON notifications (athlete_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read notifications for their org
DROP POLICY IF EXISTS "Users can read org notifications" ON notifications;
CREATE POLICY "Users can read org notifications"
  ON notifications FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow service role / admin to insert notifications
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update read_by (mark as read)
DROP POLICY IF EXISTS "Users can mark notifications read" ON notifications;
CREATE POLICY "Users can mark notifications read"
  ON notifications FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
