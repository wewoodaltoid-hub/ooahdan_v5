-- =============================================================================
-- 우아단: 가족 연동 & 다중 아이 프로필 DB 마이그레이션
-- 실행: Supabase Dashboard → SQL Editor → New query → 붙여넣기 → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. babies 테이블
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  profile_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.babies IS '아이(자녀) 프로필. 발달 기록·단어·단어장 등은 baby_id로 여기에 연결됨.';

-- -----------------------------------------------------------------------------
-- 2. family_connections (N:M — 유저 ↔ 아이, 역할 포함)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'observer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, baby_id)
);

CREATE INDEX IF NOT EXISTS idx_family_connections_user_id ON public.family_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_family_connections_baby_id ON public.family_connections(baby_id);

COMMENT ON TABLE public.family_connections IS '유저-아이 연결. admin=관리자, observer=보기만.';

-- -----------------------------------------------------------------------------
-- 3. invite_codes (가족 초대 코드)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'observer')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_baby_id ON public.invite_codes(baby_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON public.invite_codes(expires_at);

COMMENT ON TABLE public.invite_codes IS '아이별 초대 코드. code로 조회 후 family_connections에 추가.';

-- -----------------------------------------------------------------------------
-- 4. 기존 words 테이블에 baby_id 추가 (아이별 단어 카드)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'words' AND column_name = 'baby_id'
  ) THEN
    ALTER TABLE public.words
      ADD COLUMN baby_id UUID REFERENCES public.babies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_words_baby_id ON public.words(baby_id);
    COMMENT ON COLUMN public.words.baby_id IS '이 단어가 속한 아이. NULL=마이그레이션 전 기존 데이터.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. wordbooks(단어장) — baby_id 포함 생성 (테이블 없을 때만)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wordbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wordbooks_baby_id ON public.wordbooks(baby_id);

-- wordbook_words: 단어장 ↔ 단어 N:M (기존 앱의 playlist.wordIds 구조 대응)
CREATE TABLE IF NOT EXISTS public.wordbook_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wordbook_id UUID NOT NULL REFERENCES public.wordbooks(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wordbook_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_wordbook_words_wordbook_id ON public.wordbook_words(wordbook_id);
CREATE INDEX IF NOT EXISTS idx_wordbook_words_word_id ON public.wordbook_words(word_id);

-- 기존 wordbooks에 baby_id 컬럼이 없다면 추가 (이미 테이블이 있는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wordbooks')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wordbooks' AND column_name = 'baby_id') THEN
    ALTER TABLE public.wordbooks
      ADD COLUMN baby_id UUID REFERENCES public.babies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_wordbooks_baby_id ON public.wordbooks(baby_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. 아카이브 기록 테이블 (baby_id로 소속, 이관 시 UPDATE 가능)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archive_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  card_id TEXT,
  recording_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_time_sec NUMERIC(10,2),
  end_time_sec NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_archive_recordings_baby_id ON public.archive_recordings(baby_id);
CREATE INDEX IF NOT EXISTS idx_archive_recordings_archived_at ON public.archive_recordings(archived_at);

COMMENT ON TABLE public.archive_recordings IS '확정 저장된 녹음. baby_id 변경으로 다른 아이(형제)에게 이관 가능.';

-- 기존에 archive/recordings 등 다른 이름의 기록 테이블이 있다면 여기서 baby_id 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recordings')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'baby_id') THEN
    ALTER TABLE public.recordings ADD COLUMN baby_id UUID REFERENCES public.babies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_recordings_baby_id ON public.recordings(baby_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'archive')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'archive' AND column_name = 'baby_id') THEN
    ALTER TABLE public.archive ADD COLUMN baby_id UUID REFERENCES public.babies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_archive_baby_id ON public.archive(baby_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. RLS (Row Level Security) — baby 접근은 family_connections 기준
-- 기존 words 등에 정책이 있으면 Supabase 대시보드에서 기존 정책 삭제 후 재실행하거나
-- 아래 정책 생성 시 "already exists" 에러 나면 해당 CREATE POLICY 한 줄만 주석 처리 후 실행
-- -----------------------------------------------------------------------------
ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'words') THEN
    ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

ALTER TABLE public.wordbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wordbook_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_recordings ENABLE ROW LEVEL SECURITY;

-- babies: 연결된 유저만 조회/수정
DROP POLICY IF EXISTS "babies_select" ON public.babies;
CREATE POLICY "babies_select" ON public.babies FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = babies.id AND fc.user_id = auth.uid())
);
DROP POLICY IF EXISTS "babies_insert" ON public.babies;
CREATE POLICY "babies_insert" ON public.babies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "babies_update" ON public.babies;
CREATE POLICY "babies_update" ON public.babies FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = babies.id AND fc.user_id = auth.uid())
);

-- family_connections: 본인 행만
DROP POLICY IF EXISTS "family_connections_all" ON public.family_connections;
CREATE POLICY "family_connections_all" ON public.family_connections
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- invite_codes
DROP POLICY IF EXISTS "invite_codes_select" ON public.invite_codes;
CREATE POLICY "invite_codes_select" ON public.invite_codes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "invite_codes_insert" ON public.invite_codes;
CREATE POLICY "invite_codes_insert" ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = invite_codes.baby_id AND fc.user_id = auth.uid()));

-- words: 해당 baby에 연결된 유저만 (baby_id NULL = 기존 데이터는 통과)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'words') THEN
    DROP POLICY IF EXISTS "words_select" ON public.words;
    CREATE POLICY "words_select" ON public.words FOR SELECT TO authenticated USING (
      baby_id IS NULL OR EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = words.baby_id AND fc.user_id = auth.uid())
    );
    DROP POLICY IF EXISTS "words_insert" ON public.words;
    CREATE POLICY "words_insert" ON public.words FOR INSERT TO authenticated WITH CHECK (
      baby_id IS NULL OR EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = words.baby_id AND fc.user_id = auth.uid())
    );
    DROP POLICY IF EXISTS "words_update" ON public.words;
    CREATE POLICY "words_update" ON public.words FOR UPDATE TO authenticated USING (
      baby_id IS NULL OR EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = words.baby_id AND fc.user_id = auth.uid())
    );
    DROP POLICY IF EXISTS "words_delete" ON public.words;
    CREATE POLICY "words_delete" ON public.words FOR DELETE TO authenticated USING (
      baby_id IS NULL OR EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = words.baby_id AND fc.user_id = auth.uid())
    );
  END IF;
END $$;

-- wordbooks
DROP POLICY IF EXISTS "wordbooks_all" ON public.wordbooks;
CREATE POLICY "wordbooks_all" ON public.wordbooks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = wordbooks.baby_id AND fc.user_id = auth.uid())
);

-- wordbook_words
DROP POLICY IF EXISTS "wordbook_words_all" ON public.wordbook_words;
CREATE POLICY "wordbook_words_all" ON public.wordbook_words FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.wordbooks wb
    JOIN public.family_connections fc ON fc.baby_id = wb.baby_id AND fc.user_id = auth.uid()
    WHERE wb.id = wordbook_words.wordbook_id
  )
);

-- archive_recordings: baby_id UPDATE 가능(이관)
DROP POLICY IF EXISTS "archive_recordings_all" ON public.archive_recordings;
CREATE POLICY "archive_recordings_all" ON public.archive_recordings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.family_connections fc WHERE fc.baby_id = archive_recordings.baby_id AND fc.user_id = auth.uid())
);

-- =============================================================================
-- 마이그레이션 완료. 기존 words 행은 baby_id = NULL 상태이므로,
-- 앱에서 "기본 아이" 생성 후 UPDATE words SET baby_id = ? WHERE baby_id IS NULL 로
-- 백필하거나, 신규 데이터부터 baby_id를 넣어 사용하면 됨.
-- =============================================================================
