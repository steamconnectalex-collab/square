-- SHIQI canonical Storage reference (extracted from original project catalog)
-- Buckets:
-- attachments: public, 3 MiB, image/jpeg,image/png,image/webp,image/gif
-- avatars: public, 1 MiB, image/jpeg,image/png,image/webp
-- The bucket metadata is descriptive; create/update is deferred to the reviewed migration.

CREATE POLICY attachments_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY attachments_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY attachments_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
