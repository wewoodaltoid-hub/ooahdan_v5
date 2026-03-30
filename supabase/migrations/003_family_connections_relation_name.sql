-- 아이별 보호자 맞춤 호칭 (홈 인사말 등)
ALTER TABLE public.family_connections
  ADD COLUMN IF NOT EXISTS relation_name TEXT;

COMMENT ON COLUMN public.family_connections.relation_name IS '해당 아이에 대한 보호자 호칭(엄마, 아빠 등). NULL이면 앱에서 ''가족''으로 표시.';
