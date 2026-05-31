-- 커뮤니티: 익명 닉네임 · 사진 · 카테고리 정리

-- 1) 게시글 사진 URL
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2) 댓글 작성 시 아기 개월 수
ALTER TABLE public.community_post_comments ADD COLUMN IF NOT EXISTS baby_months INT;

-- 3) 카테고리 데이터 마이그레이션
UPDATE public.community_posts SET category = 'parenting_tip' WHERE category = 'parenting_worry';
UPDATE public.community_posts SET category = 'free_talk' WHERE category = 'child_brag';

-- 4) 계정별 익명 닉네임
CREATE TABLE IF NOT EXISTS public.community_nicknames (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_nicknames_nickname
  ON public.community_nicknames(nickname);

COMMENT ON TABLE public.community_nicknames IS '커뮤니티 익명 닉네임. 계정당 1개.';

ALTER TABLE public.community_nicknames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_nicknames_select" ON public.community_nicknames;
CREATE POLICY "community_nicknames_select"
  ON public.community_nicknames FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "community_nicknames_insert" ON public.community_nicknames;
CREATE POLICY "community_nicknames_insert"
  ON public.community_nicknames FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_nicknames_update" ON public.community_nicknames;
CREATE POLICY "community_nicknames_update"
  ON public.community_nicknames FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5) Storage: community-images
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
