-- ─────────────────────────────────────────────────────────────────────────────
-- 007_fix_rls.sql
-- Fixes:
--   1. Missing INSERT policy on recommendation_log (EU AI Act Art. 12 logging
--      was silently rejected for every score recalculation).
--   2. rehab_clinical_write policy lacked org_id scope — any doctor/physio from
--      any org could read or write any rehab session by guessing a UUID.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. recommendation_log INSERT ─────────────────────────────────────────────
-- generateAndPersistRecommendations runs under the scorer's session context.
-- Allow any authenticated org member to insert; org_id must match their profile.
DROP POLICY IF EXISTS "org staff insert rec logs" ON recommendation_log;

CREATE POLICY "org staff insert rec logs"
  ON recommendation_log FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM profiles
      WHERE id = auth.uid()
        AND org_id IS NOT NULL
    )
  );


-- ── 2. score_history clinical write — support server-side recalculation ──────
-- The score route runs with the authenticated clinician session, so RLS must
-- permit org-scoped inserts and updates for the score_history upsert.
DROP POLICY IF EXISTS score_history_clinical_insert ON score_history;
DROP POLICY IF EXISTS score_history_clinical_update ON score_history;

CREATE POLICY score_history_clinical_insert ON score_history FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );

CREATE POLICY score_history_clinical_update ON score_history FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );


-- ── 3. rehab_sessions clinical write — add org scope ─────────────────────────
DROP POLICY IF EXISTS rehab_clinical_write ON rehab_sessions;
DROP POLICY IF EXISTS rehab_sessions_clinical_write_m2 ON rehab_sessions;

CREATE POLICY rehab_clinical_write ON rehab_sessions FOR ALL
  USING (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'doctor', 'physio')
    AND athlete_id IN (
      SELECT id FROM athletes WHERE org_id = get_user_org_id()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Merged in: originally a separate file also numbered "007" (007_sprint3.sql).
-- Two migrations shared the same leading version number, which the Supabase
-- migration history table can't represent (version is its primary key) —
-- db push failed with a duplicate-key error trying to record the second one.
-- Renumbering it to run later was tried and reverted: same reasoning as the 002 pair.
-- Merging into the file that already holds this version preserves the exact
-- original ordering relative to every other migration.
--
-- Caveat (Codex) resolved: see 077's header for the full reasoning — only
-- the lowest-numbered of these six pairs ("002") could ever have had its
-- version pre-recorded from just one half before this branch's merge fix
-- existed; db push stops at the first failure, so "007" and every higher
-- pair here could only be reached (and hence recorded) AFTER the merge
-- fix already made both halves part of the same file. Not at risk.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Sprint 3
--   • photo_url column on athletes
--   • athlete-photos Storage bucket + RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Athlete photo ─────────────────────────────────────────────────────────────

ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS photo_url text;

-- ── Storage bucket: athlete-photos ───────────────────────────────────────────
-- Run these manually in Dashboard → Storage if the SQL editor cannot
-- create buckets directly:
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('athlete-photos', 'athlete-photos', false)
--   ON CONFLICT (id) DO NOTHING;
--
--   CREATE POLICY "authenticated read athlete-photos"
--     ON storage.objects FOR SELECT TO authenticated
--     USING (bucket_id = 'athlete-photos' AND auth.role() = 'authenticated');
--
--   CREATE POLICY "authenticated upload athlete-photos"
--     ON storage.objects FOR INSERT TO authenticated
--     WITH CHECK (bucket_id = 'athlete-photos' AND auth.role() = 'authenticated');
--
--   CREATE POLICY "authenticated update athlete-photos"
--     ON storage.objects FOR UPDATE TO authenticated
--     USING (bucket_id = 'athlete-photos' AND auth.role() = 'authenticated');
