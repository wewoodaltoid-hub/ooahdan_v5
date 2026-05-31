-- 예전 community_posts에 NOT NULL tag 컬럼만 있을 때 — category와 동기화
-- SQL Editor에서 실행 (tag 컬럼이 없으면 스킵해도 됨)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_posts'
      AND column_name = 'tag'
  ) THEN
    UPDATE public.community_posts
    SET tag = COALESCE(NULLIF(trim(tag), ''), category, 'free_talk')
    WHERE tag IS NULL;

    UPDATE public.community_posts
    SET category = COALESCE(NULLIF(trim(category), ''), tag, 'free_talk')
    WHERE category IS NULL;

    ALTER TABLE public.community_posts
      ALTER COLUMN tag SET DEFAULT 'free_talk';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_posts'
      AND column_name = 'content'
  ) THEN
    UPDATE public.community_posts
    SET content = COALESCE(NULLIF(trim(content), ''), body, '')
    WHERE content IS NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'community_posts'
        AND column_name = 'body'
    ) THEN
      UPDATE public.community_posts
      SET body = COALESCE(NULLIF(trim(body), ''), content, '')
      WHERE body IS NULL;
    END IF;

    ALTER TABLE public.community_posts
      ALTER COLUMN content SET DEFAULT '';
  END IF;
END $$;
