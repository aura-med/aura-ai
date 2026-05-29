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
