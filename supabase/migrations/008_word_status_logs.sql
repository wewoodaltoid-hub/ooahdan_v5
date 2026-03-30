-- 단어 상태 변경 이력 (발달 통계 월별 누적용)
CREATE TABLE IF NOT EXISTS public.word_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  new_status TEXT NOT NULL CHECK (new_status IN ('knows', 'says')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_word_status_logs_baby_changed ON public.word_status_logs(baby_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_word_status_logs_word_id ON public.word_status_logs(word_id);

COMMENT ON TABLE public.word_status_logs IS '단어 카드 상태(knows/says) 변경 로그. 통계 월별 누적에 사용.';

ALTER TABLE public.word_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "word_status_logs_select" ON public.word_status_logs;
CREATE POLICY "word_status_logs_select" ON public.word_status_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.family_connections fc
    WHERE fc.baby_id = word_status_logs.baby_id AND fc.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "word_status_logs_insert" ON public.word_status_logs;
CREATE POLICY "word_status_logs_insert" ON public.word_status_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.family_connections fc
    WHERE fc.baby_id = word_status_logs.baby_id AND fc.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "word_status_logs_update" ON public.word_status_logs;
CREATE POLICY "word_status_logs_update" ON public.word_status_logs FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.family_connections fc
    WHERE fc.baby_id = word_status_logs.baby_id AND fc.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "word_status_logs_delete" ON public.word_status_logs;
CREATE POLICY "word_status_logs_delete" ON public.word_status_logs FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.family_connections fc
    WHERE fc.baby_id = word_status_logs.baby_id AND fc.user_id = auth.uid()
  )
);
