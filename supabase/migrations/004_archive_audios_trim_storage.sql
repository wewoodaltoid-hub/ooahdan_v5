-- archive_recordings: 원격 오디오 URL + 트림(ms) + word_id
-- Storage: audios 버킷 (공개 읽기, 인증 업로드)

ALTER TABLE public.archive_recordings
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS trim_start_ms BIGINT,
  ADD COLUMN IF NOT EXISTS trim_end_ms BIGINT,
  ADD COLUMN IF NOT EXISTS word_id UUID REFERENCES public.words(id) ON DELETE SET NULL;

ALTER TABLE public.archive_recordings
  ALTER COLUMN recording_uri DROP NOT NULL;

COMMENT ON COLUMN public.archive_recordings.audio_url IS 'Storage 공개 URL (audios 버킷).';
COMMENT ON COLUMN public.archive_recordings.trim_start_ms IS '재생 시작 오프셋(ms). NULL이면 0.';
COMMENT ON COLUMN public.archive_recordings.trim_end_ms IS '재생 종료 시각(ms, 파일 기준). NULL이면 끝까지.';
COMMENT ON COLUMN public.archive_recordings.recording_uri IS '레거시/로컬 URI. 신규는 audio_url 사용.';

-- audios 버킷 (대시보드에서 이미 있으면 정책만 적용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audios', 'audios', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
DROP POLICY IF EXISTS "audios_select_authenticated" ON storage.objects;
CREATE POLICY "audios_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audios');

DROP POLICY IF EXISTS "audios_insert_authenticated" ON storage.objects;
CREATE POLICY "audios_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audios');

DROP POLICY IF EXISTS "audios_update_authenticated" ON storage.objects;
CREATE POLICY "audios_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'audios');

DROP POLICY IF EXISTS "audios_delete_authenticated" ON storage.objects;
CREATE POLICY "audios_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audios');

-- anon도 공개 버킷이면 읽기 허용(앱에서 public URL 사용 시)
DROP POLICY IF EXISTS "audios_select_anon" ON storage.objects;
CREATE POLICY "audios_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'audios');
