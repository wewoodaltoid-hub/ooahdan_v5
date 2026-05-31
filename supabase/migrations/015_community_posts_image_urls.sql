  -- 커뮤니티 게시글 사진 최대 3장 (JSON 배열)
  ALTER TABLE public.community_posts
    ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

  UPDATE public.community_posts
  SET image_urls = jsonb_build_array(image_url)
  WHERE image_url IS NOT NULL
    AND trim(image_url) <> ''
    AND (
      image_urls IS NULL
      OR image_urls = '[]'::jsonb
      OR jsonb_array_length(image_urls) = 0
    );
