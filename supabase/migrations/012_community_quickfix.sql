-- 커뮤니티 WARN 해결용 (image_url · community_nicknames · 스토리지)
-- Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 011을 이미 실행했다면 스킵해도 됩니다 (IF NOT EXISTS / ON CONFLICT 안전).

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 예전 NOT NULL tag 컬럼이 있으면 category와 맞춤 (없으면 무시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'tag'
  ) THEN
    UPDATE public.community_posts SET tag = COALESCE(tag, category, 'free_talk') WHERE tag IS NULL;
    UPDATE public.community_posts SET category = COALESCE(category, tag, 'free_talk') WHERE category IS NULL;
    ALTER TABLE public.community_posts ALTER COLUMN tag SET DEFAULT 'free_talk';
  END IF;
END $$;
ALTER TABLE public.community_post_comments ADD COLUMN IF NOT EXISTS baby_months INT;

UPDATE public.community_posts SET category = 'parenting_tip' WHERE category = 'parenting_worry';
UPDATE public.community_posts SET category = 'free_talk' WHERE category = 'child_brag';

CREATE TABLE IF NOT EXISTS public.community_nicknames (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_nicknames_nickname
  ON public.community_nicknames(nickname);

ALTER TABLE public.community_nicknames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_nicknames_select" ON public.community_nicknames;
CREATE POLICY "community_nicknames_select"
  ON public.community_nicknames FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_nicknames_insert" ON public.community_nicknames;
CREATE POLICY "community_nicknames_insert"
  ON public.community_nicknames FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_nicknames_update" ON public.community_nicknames;
CREATE POLICY "community_nicknames_update"
  ON public.community_nicknames FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "community_images_select" ON storage.objects;
CREATE POLICY "community_images_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-images');

DROP POLICY IF EXISTS "community_images_insert" ON storage.objects;
CREATE POLICY "community_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-images');

DROP POLICY IF EXISTS "community_images_select_anon" ON storage.objects;
CREATE POLICY "community_images_select_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'community-images');
