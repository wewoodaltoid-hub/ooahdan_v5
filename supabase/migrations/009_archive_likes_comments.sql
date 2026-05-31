-- 아카이브 영상/음성: 가족 공유 좋아요 · 댓글(메모)

-- -----------------------------------------------------------------------------
-- 1) 좋아요
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archive_recording_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.archive_recordings(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recording_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_archive_likes_recording_id
  ON public.archive_recording_likes(recording_id);
CREATE INDEX IF NOT EXISTS idx_archive_likes_baby_id
  ON public.archive_recording_likes(baby_id);

COMMENT ON TABLE public.archive_recording_likes IS '아카이브 녹음별 좋아요(가족 멤버).';

-- -----------------------------------------------------------------------------
-- 2) 댓글(메모) — 작성 시 닉네임·관계 스냅샷
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archive_recording_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.archive_recordings(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  author_display_name TEXT NOT NULL DEFAULT '',
  author_relation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_comments_recording_id
  ON public.archive_recording_comments(recording_id);
CREATE INDEX IF NOT EXISTS idx_archive_comments_baby_id
  ON public.archive_recording_comments(baby_id);

COMMENT ON TABLE public.archive_recording_comments IS '아카이브 녹음별 가족 댓글(메모).';

-- -----------------------------------------------------------------------------
-- 3) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.archive_recording_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_recording_comments ENABLE ROW LEVEL SECURITY;

-- likes: 같은 아이 가족만 조회, 본인만 추가/삭제
DROP POLICY IF EXISTS "archive_likes_select" ON public.archive_recording_likes;
CREATE POLICY "archive_likes_select"
  ON public.archive_recording_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recording_likes.baby_id
        AND fc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "archive_likes_insert" ON public.archive_recording_likes;
CREATE POLICY "archive_likes_insert"
  ON public.archive_recording_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recording_likes.baby_id
        AND fc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.archive_recordings ar
      WHERE ar.id = archive_recording_likes.recording_id
        AND ar.baby_id = archive_recording_likes.baby_id
    )
  );

DROP POLICY IF EXISTS "archive_likes_delete" ON public.archive_recording_likes;
CREATE POLICY "archive_likes_delete"
  ON public.archive_recording_likes FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recording_likes.baby_id
        AND fc.user_id = auth.uid()
    )
  );

-- comments: 같은 아이 가족 조회, 본인 작성·수정·삭제
DROP POLICY IF EXISTS "archive_comments_select" ON public.archive_recording_comments;
CREATE POLICY "archive_comments_select"
  ON public.archive_recording_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recording_comments.baby_id
        AND fc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "archive_comments_insert" ON public.archive_recording_comments;
CREATE POLICY "archive_comments_insert"
  ON public.archive_recording_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_connections fc
      WHERE fc.baby_id = archive_recording_comments.baby_id
        AND fc.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.archive_recordings ar
      WHERE ar.id = archive_recording_comments.recording_id
        AND ar.baby_id = archive_recording_comments.baby_id
    )
  );

DROP POLICY IF EXISTS "archive_comments_update" ON public.archive_recording_comments;
CREATE POLICY "archive_comments_update"
  ON public.archive_recording_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "archive_comments_delete" ON public.archive_recording_comments;
CREATE POLICY "archive_comments_delete"
  ON public.archive_recording_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
