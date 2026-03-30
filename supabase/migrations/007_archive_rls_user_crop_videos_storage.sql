-- archive_recordings: INSERT RLS 명시(WITH CHECK), user_id 자동 부여, 정방형 크롭 예약 컬럼
-- Storage: videos 버킷 정책(인증 사용자 INSERT/SELECT/UPDATE/DELETE)

-- -----------------------------------------------------------------------------
-- 1) 컬럼: 아카이빙 사용자(감사) — RLS·감사 추적용 (INSERT 시 auth.uid()와 일치)
-- -----------------------------------------------------------------------------
ALTER TABLE public.archive_recordings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.archive_recordings.user_id IS '아카이빙을 수행한 로그인 사용자. 트리거로 auth.uid() 설정.';

-- -----------------------------------------------------------------------------
-- 2) 정방형 크롭(향후 UI) — nullable, 0~1 정규화 또는 픽셀 단위 중 앱에서 선택
-- -----------------------------------------------------------------------------
ALTER TABLE public.archive_recordings
  ADD COLUMN IF NOT EXISTS crop_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS crop_y DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS crop_width DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS crop_height DOUBLE PRECISION;

COMMENT ON COLUMN public.archive_recordings.crop_x IS '비디오/썸네일 정방형 크롭 영역 (nullable).';
COMMENT ON COLUMN public.archive_recordings.crop_y IS '비디오/썸네일 정방형 크롭 영역 (nullable).';
COMMENT ON COLUMN public.archive_recordings.crop_width IS '비디오/썸네일 정방형 크롭 영역 (nullable).';
COMMENT ON COLUMN public.archive_recordings.crop_height IS '비디오/썸네일 정방형 크롭 영역 (nullable).';

-- -----------------------------------------------------------------------------
-- 3) INSERT 시 user_id = auth.uid() 자동 설정 (클라이언트 누락·조작 방지)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_recordings_set_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_recordings_set_user_id ON public.archive_recordings;
CREATE TRIGGER trg_archive_recordings_set_user_id
  BEFORE INSERT ON public.archive_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_recordings_set_user_id();

-- -----------------------------------------------------------------------------
-- 4) archive_recordings RLS: FOR ALL 단일 정책 제거 → INSERT에 WITH CHECK 명시
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "archive_recordings_all" ON public.archive_recordings;

DROP POLICY IF EXISTS "archive_recordings_select" ON public.archive_recordings;
CREATE POLICY "archive_recordings_select"
  ON public.archive_recordings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recordings.baby_id
        AND fc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "archive_recordings_insert" ON public.archive_recordings;
CREATE POLICY "archive_recordings_insert"
  ON public.archive_recordings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recordings.baby_id
        AND fc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "archive_recordings_update" ON public.archive_recordings;
CREATE POLICY "archive_recordings_update"
  ON public.archive_recordings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recordings.baby_id
        AND fc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recordings.baby_id
        AND fc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "archive_recordings_delete" ON public.archive_recordings;
CREATE POLICY "archive_recordings_delete"
  ON public.archive_recordings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recordings.baby_id
        AND fc.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5) Storage: videos 버킷 + RLS (인증 사용자 전체 작업)
-- -----------------------------------------------------------------------------
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
  USING (bucket_id = 'videos')
  WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_delete_authenticated" ON storage.objects;
CREATE POLICY "videos_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_select_anon" ON storage.objects;
CREATE POLICY "videos_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'videos');
