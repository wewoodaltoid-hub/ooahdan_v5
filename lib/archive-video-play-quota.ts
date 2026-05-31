import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const STORAGE_KEY_PREFIX = '@ooahdan/archive_video_play_count/v1';

/** 무료 아카이브 영상 재생 횟수 */
export const ARCHIVE_FREE_VIDEO_PLAYS = 10;

/** 가짜 전면 광고 시청 시간(초) */
export const ARCHIVE_AD_WATCH_SECONDS = 5;

async function storageKey(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return `${STORAGE_KEY_PREFIX}/${user?.id ?? 'guest'}`;
}

export async function getArchiveVideoPlayCount(): Promise<number> {
  try {
    const key = await storageKey();
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function setArchiveVideoPlayCount(count: number): Promise<void> {
  try {
    const key = await storageKey();
    await AsyncStorage.setItem(key, String(Math.max(0, Math.round(count))));
  } catch {
    /* noop */
  }
}

export async function resetArchiveVideoPlayCount(): Promise<void> {
  await setArchiveVideoPlayCount(0);
}

/** 재생 1회 소비 후 새 카운트 반환 */
export async function consumeArchiveVideoPlay(): Promise<number> {
  const current = await getArchiveVideoPlayCount();
  const next = current + 1;
  await setArchiveVideoPlayCount(next);
  return next;
}

export async function isArchiveVideoPlayQuotaExceeded(): Promise<boolean> {
  const count = await getArchiveVideoPlayCount();
  return count >= ARCHIVE_FREE_VIDEO_PLAYS;
}
