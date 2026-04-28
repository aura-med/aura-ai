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
CREATE POLICY "Users can read org notifications"
  ON notifications FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow service role / admin to insert notifications
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update read_by (mark as read)
CREATE POLICY "Users can mark notifications read"
  ON notifications FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
