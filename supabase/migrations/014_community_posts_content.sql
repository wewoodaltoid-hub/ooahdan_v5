-- 예전 community_posts: NOT NULL content ↔ body 동기화

DO $$
BEGIN
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
