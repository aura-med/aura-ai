-- Migration 077 — Defensively recreate the `notifications` table (002's
-- merged-in second half), in case it was silently skipped.
--
-- 002_medical_portal.sql and 002_notifications.sql originally shared the
-- version "002" before being merged (see that file's own header comment).
-- Of the six duplicate-version pairs merged across this branch (002, 004,
-- 006, 007, 008, 009), "002" is the only one where the skip risk that
-- header comment warns about is actually plausible for THIS repo's real
-- history: `supabase db push` processes pending migrations in ascending
-- version order and stops at the first failure, so the very first
-- duplicate-key collision it could ever have hit — before any of these six
-- pairs were merged — would have been at "002" (the lowest of the six
-- version numbers), recording 002_medical_portal.sql's content alone
-- before erroring on 002_notifications.sql's attempt to reuse the same
-- version. That failure would have blocked the push right there — nothing
-- at "004" or higher could have run yet at that point, in that state.
--
-- This branch's occurrences/diagnoses/occurrence_records tables (created
-- by 009's merged-in second half, several versions after 002) are the
-- foundation nearly every later migration in this repo builds on,
-- including many already confirmed applied to production. That could only
-- be true if 009's full merged content — and therefore everything at 004,
-- 006, 007, and 008 too, all positioned between 002 and 009 — actually ran
-- in full on whatever push eventually got past the original "002" failure
-- (by which point the merge fix already existed, so "004" onward were
-- never at risk of being pre-recorded from just one half). Only "002"
-- itself could have been recorded before the fix shipped.
--
-- Recreate `notifications` defensively rather than assume: harmless
-- no-op if 002_notifications.sql's content did run (CREATE TABLE IF NOT
-- EXISTS / DROP POLICY IF EXISTS + CREATE POLICY are idempotent), the
-- actual fix if it didn't. Nothing later in this repo references
-- `notifications`, so there's no risk of overriding later hardening the
-- way replaying 004/007/008/009's content would (see their own header
-- comments).

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

DROP POLICY IF EXISTS "Users can read org notifications" ON notifications;
CREATE POLICY "Users can read org notifications"
  ON notifications FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Scoped to the caller's own org (and, if set, a squad/athlete that
-- genuinely belongs to it) — the original 002_notifications.sql's
-- `WITH CHECK (auth.role() = 'authenticated')` let ANY authenticated user
-- insert a notification claiming ANY org_id, which the SELECT policy above
-- then trusts at face value: that other org's members would receive a
-- forged injury/readiness/RTP alert. Faithfully reproducing that original
-- policy here would reintroduce a real vulnerability into a freshly
-- (re)created table, not just restore old behavior.
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND org_id IS NOT NULL)
    AND (squad_id IS NULL OR squad_id IN (SELECT id FROM squads WHERE org_id = notifications.org_id))
    AND (athlete_id IS NULL OR athlete_id IN (SELECT id FROM athletes WHERE org_id = notifications.org_id))
  );

-- No general UPDATE policy: the original 002_notifications.sql's "Users
-- can mark notifications read" policy was USING/WITH CHECK
-- (auth.role() = 'authenticated') — even scoped to the caller's own org,
-- a blanket UPDATE grant lets any org member rewrite type/title/body/
-- metadata/subject-references on every notification, not just append
-- their own id to read_by as the policy's name implies. Any authenticated
-- staff member (including a non-clinical role) could rewrite official
-- clinical/readiness alerts for the whole org. Mark-as-read goes through
-- mark_notifications_read() below instead, which only ever appends
-- auth.uid() to read_by; RLS leaves UPDATE unreachable any other way.

CREATE OR REPLACE FUNCTION mark_notifications_read(p_notification_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET read_by = array_append(read_by, auth.uid())
  WHERE id = ANY(p_notification_ids)
    AND org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND org_id IS NOT NULL)
    AND NOT (auth.uid() = ANY(read_by));
$$;

GRANT EXECUTE ON FUNCTION mark_notifications_read(uuid[]) TO authenticated;
