-- Sophi Sports rebrand: new users default to the light theme.
-- Existing rows keep their saved preference.
ALTER TABLE user_preferences ALTER COLUMN theme SET DEFAULT 'light';
