-- 커뮤니티 게시글 · 좋아요 · 댓글
-- 이미 community_posts 테이블이 다른 구조로 있으면 010_community_posts_repair.sql 을 대신 실행하세요.

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID REFERENCES public.babies(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'free_talk' CHECK (
    category IN ('child_brag', 'parenting_worry', 'free_talk')
  ),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  author_display_name TEXT NOT NULL DEFAULT '',
  author_relation TEXT,
  baby_months INT,
  likes_count INT NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INT NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 테이블에 컬럼만 없을 때 보강 (IF NOT EXISTS)
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS baby_id UUID REFERENCES public.babies(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'free_talk';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_display_name TEXT DEFAULT '';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS author_relation TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS baby_months INT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.community_posts SET category = 'free_talk' WHERE category IS NULL;

DROP INDEX IF EXISTS public.idx_community_posts_category_created;
CREATE INDEX idx_community_posts_category_created
  ON public.community_posts(category, created_at DESC);

DROP INDEX IF EXISTS public.idx_community_posts_hot;
CREATE INDEX idx_community_posts_hot
  ON public.community_posts((likes_count + comments_count) DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

DROP INDEX IF EXISTS public.idx_community_post_likes_post;
CREATE INDEX idx_community_post_likes_post ON public.community_post_likes(post_id);

CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  author_display_name TEXT NOT NULL DEFAULT '',
  author_relation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS public.idx_community_post_comments_post;
CREATE INDEX idx_community_post_comments_post
  ON public.community_post_comments(post_id, created_at ASC);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_select" ON public.community_posts;
CREATE POLICY "community_posts_select"
  ON public.community_posts FOR SELECT TO authenticated
  USING (true);

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
  ON public.community_post_likes FOR SELECT TO authenticated
  USING (true);

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
  ON public.community_post_comments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "community_comments_insert" ON public.community_post_comments;
CREATE POLICY "community_comments_insert"
  ON public.community_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_comments_delete" ON public.community_post_comments;
CREATE POLICY "community_comments_delete"
  ON public.community_post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
