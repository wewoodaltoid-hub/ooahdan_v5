-- archive_recordings: 오디오/영상 구분 (재생 UI·트림 동일 적용)

ALTER TABLE public.archive_recordings
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'audio'
    CHECK (media_type IN ('audio', 'video'));

COMMENT ON COLUMN public.archive_recordings.media_type IS '저장 미디어 종류: audio | video';
