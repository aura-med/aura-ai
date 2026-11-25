-- Migration 103 — Club crest (Phase C). organizations.logo_url + a
-- public-read org-logos storage bucket, owner-write-only, scoped by a
-- path convention (<org_id>/<filename>) the same way other per-org storage
-- in this codebase is scoped (mirrors 026's training-plans bucket pattern,
-- but public since a crest is shown in the Topbar to every signed-in user
-- of that org, not just clinical roles).
--
-- Also adds the UPDATE policy organizations was missing entirely (only two
-- SELECT policies existed) — settings/organizations/page.tsx has long had a
-- "Guardar" button wired to update org name directly from the client, which
-- RLS silently rejected with no matching policy. One owner-scoped UPDATE
-- policy fixes both that and the new logo_url write.

ALTER TABLE organizations
  ADD COLUMN logo_url text;

CREATE POLICY organizations_update_owner ON organizations FOR UPDATE
  USING (id = get_user_org_id() AND get_user_role() = 'owner')
  WITH CHECK (id = get_user_org_id() AND get_user_role() = 'owner');

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org_logos_storage_read" ON storage.objects;
CREATE POLICY "org_logos_storage_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

-- Upload path convention: <org_id>/<filename> — storage.foldername(name)
-- splits on '/' and returns the folder segments, so [1] is the org_id an
-- uploader is writing into. Scoping on that (rather than trusting a
-- client-supplied org_id column, which storage.objects has no such column
-- for anyway) is what keeps one org's owner from overwriting another's crest.
DROP POLICY IF EXISTS "org_logos_storage_write" ON storage.objects;
CREATE POLICY "org_logos_storage_write" ON storage.objects FOR ALL
  USING (
    bucket_id = 'org-logos'
    AND get_user_role() = 'owner'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'org-logos'
    AND get_user_role() = 'owner'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );
