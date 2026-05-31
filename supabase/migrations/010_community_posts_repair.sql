-- =============================================================================
-- community_posts가 예전 스키마로 이미 있을 때 실행 (010 실패 후 복구용)
-- Table Editor에서 community_posts 행이 없거나 테스트 데이터만 있으면 안전합니다.
-- =============================================================================

-- 1) 누락 컬럼 추가 (이미 있으면 스킵)
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.babies(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_display_name TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_relation TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS baby_months INT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.community_post_comments ADD COLUMN IF NOT EXISTS baby_months INT;

-- 2) category 없던 기존 행 기본값
UPDATE public.community_posts
SET category = 'free_talk'
WHERE category IS NULL;

UPDATE public.community_posts
SET author_display_name = COALESCE(NULLIF(trim(author_display_name), ''), '익명')
WHERE author_display_name IS NULL OR trim(author_display_name) = '';

UPDATE public.community_posts SET category = 'parenting_tip' WHERE category = 'parenting_worry';
UPDATE public.community_posts SET category = 'free_talk' WHERE category = 'child_brag';

-- 3) likes / comments 테이블 (없을 때만 생성)
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  author_display_name TEXT NOT NULL DEFAULT '',
  author_relation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) 인덱스 (category 컬럼 추가 후)
DROP INDEX IF EXISTS public.idx_community_posts_category_created;
CREATE INDEX idx_community_posts_category_created
  ON public.community_posts(category, created_at DESC);

DROP INDEX IF EXISTS public.idx_community_posts_hot;
CREATE INDEX idx_community_posts_hot
  ON public.community_posts((likes_count + comments_count) DESC, created_at DESC);

DROP INDEX IF EXISTS public.idx_community_post_likes_post;
CREATE INDEX idx_community_post_likes_post ON public.community_post_likes(post_id);

DROP INDEX IF EXISTS public.idx_community_post_comments_post;
CREATE INDEX idx_community_post_comments_post
  ON public.community_post_comments(post_id, created_at ASC);

-- 5) RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
CREATE POLICY "community_posts_select"
  ON public.community_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
CREATE POLICY "community_posts_insert"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "community_posts_update_own" ON public.community_posts;
CREATE POLICY "community_posts_update_own"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "community_likes_select" ON public.community_post_likes;
CREATE POLICY "community_likes_select"
  ON public.community_post_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_likes_insert" ON public.community_post_likes;
CREATE POLICY "community_likes_insert"
  ON public.community_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_likes_delete" ON public.community_post_likes;
CREATE POLICY "community_likes_delete"
  ON public.community_post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_comments_select" ON public.community_post_comments;
CREATE POLICY "community_comments_select"
  ON public.community_post_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_comments_insert" ON public.community_post_comments;
CREATE POLICY "community_comments_insert"
  ON public.community_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_comments_delete" ON public.community_post_comments;
CREATE POLICY "community_comments_delete"
  ON public.community_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6) 익명 닉네임 · 커뮤니티 이미지 스토리지 (011과 동일)
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
