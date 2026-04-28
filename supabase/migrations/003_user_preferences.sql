CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale                text DEFAULT 'pt' CHECK (locale IN ('pt', 'en', 'es')),
  theme                 text DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_squad_id      uuid REFERENCES squads(id) ON DELETE SET NULL,
  notifications_enabled jsonb DEFAULT '{"score_critical": true, "score_high": true, "injury_new": true, "rehab_update": true, "checkin_missing": false, "rtp_ready": true, "readiness_drop": false}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own preferences"
  ON user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
