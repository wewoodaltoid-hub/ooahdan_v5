-- 영상 아카이브용 Storage 버킷 (로컬 임시 저장 후 아카이빙 시 업로드)

INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "videos_select_authenticated" ON storage.objects;
CREATE POLICY "videos_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_insert_authenticated" ON storage.objects;
CREATE POLICY "videos_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_update_authenticated" ON storage.objects;
CREATE POLICY "videos_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_delete_authenticated" ON storage.objects;
CREATE POLICY "videos_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_select_anon" ON storage.objects;
CREATE POLICY "videos_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'videos');
