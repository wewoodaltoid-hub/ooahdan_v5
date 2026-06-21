-- 본인 게시글 삭제 RLS
DROP POLICY IF EXISTS "community_posts_delete_own" ON public.community_posts;
CREATE POLICY "community_posts_delete_own"
  ON public.community_posts FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());
