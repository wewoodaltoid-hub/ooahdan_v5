-- babies 테이블에 생년월일 컬럼 추가 (아이 프로필 수정 화면용)
ALTER TABLE public.babies
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.babies.birth_date IS '아이 생년월일 (프로필 수정에서 설정)';

-- Storage 버킷 'avatars'는 Supabase Dashboard → Storage → New bucket 에서
-- 이름: avatars, Public bucket 체크 후 생성해 주세요.
