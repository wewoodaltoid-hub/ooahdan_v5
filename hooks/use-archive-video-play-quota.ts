import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ARCHIVE_FREE_VIDEO_PLAYS,
  consumeArchiveVideoPlay,
  getArchiveVideoPlayCount,
  isArchiveVideoPlayQuotaExceeded,
  resetArchiveVideoPlayCount,
} from '@/lib/archive-video-play-quota';

type PendingPlay = () => void | Promise<void>;

/**
 * 아카이브 영상 재생 횟수(AsyncStorage) + 무료 횟수 초과 시 광고 모달 게이트
 */
export function useArchiveVideoPlayQuota() {
  const [playCount, setPlayCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [adModalVisible, setAdModalVisible] = useState(false);
  const pendingPlayRef = useRef<PendingPlay | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const count = await getArchiveVideoPlayCount();
      if (!cancelled) {
        setPlayCount(count);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissAdModal = useCallback(() => {
    setAdModalVisible(false);
    pendingPlayRef.current = null;
  }, []);

  const completeAdAndPlay = useCallback(async () => {
    await resetArchiveVideoPlayCount();
    setPlayCount(0);
    setAdModalVisible(false);

    const play = pendingPlayRef.current;
    pendingPlayRef.current = null;
    if (!play) return;

    const next = await consumeArchiveVideoPlay();
    setPlayCount(next);
    await play();
  }, []);

  /**
   * 영상 재생 직전 호출. quota 초과 시 모달만 띄우고 false.
   * 허용 시 카운트 +1 후 onPlay 실행.
   */
  const requestArchiveVideoPlay = useCallback(
    async (onPlay: PendingPlay): Promise<boolean> => {
      if (!loaded) {
        const count = await getArchiveVideoPlayCount();
        setPlayCount(count);
        setLoaded(true);
      }

      const exceeded = await isArchiveVideoPlayQuotaExceeded();
      if (exceeded) {
        pendingPlayRef.current = onPlay;
        setAdModalVisible(true);
        return false;
      }

      const next = await consumeArchiveVideoPlay();
      setPlayCount(next);
      await onPlay();
      return true;
    },
    [loaded],
  );

  const remainingFreePlays = Math.max(0, ARCHIVE_FREE_VIDEO_PLAYS - playCount);

  return {
    playCount,
    loaded,
    remainingFreePlays,
    adModalVisible,
    requestArchiveVideoPlay,
    completeAdAndPlay,
    dismissAdModal,
  };
}
