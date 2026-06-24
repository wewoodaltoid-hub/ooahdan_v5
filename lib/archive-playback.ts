/**
 * 아카이브 인라인 재생 — trim 메타데이터와 실제 영상 길이 정합
 */

export type ResolvedArchiveTrim = {
  startMs: number;
  endMs: number | null;
};

/** trim_end_ms=0 등 잘못된 DB 값 → 끝까지 재생 */
export function normalizeTrimEndMs(startMs: number, endMs: number | null | undefined): number | null {
  if (endMs == null || !Number.isFinite(endMs) || endMs <= 0) return null;
  if (endMs <= startMs + 200) return null;
  return endMs;
}

/** 실제 duration 기준으로 trim 구간 보정 (원격 스트리밍·DB 오차 대응) */
export function resolveArchivePlaybackTrim(
  trimStartMs: number | null | undefined,
  trimEndMs: number | null | undefined,
  durationMs: number,
): ResolvedArchiveTrim {
  const startMs = Math.max(0, Math.round(trimStartMs ?? 0));

  if (durationMs <= 0) {
    return { startMs, endMs: normalizeTrimEndMs(startMs, trimEndMs) };
  }

  let endMs = normalizeTrimEndMs(startMs, trimEndMs);
  if (endMs != null) {
    endMs = Math.min(endMs, durationMs);
    if (endMs <= startMs + 200) {
      endMs = null;
    }
  }

  const maxStart = endMs != null ? Math.max(0, endMs - 100) : Math.max(0, durationMs - 100);
  const clampedStart = Math.min(startMs, maxStart);

  return { startMs: clampedStart, endMs };
}

export function clampSeekMs(startMs: number, durationMs: number, endMs: number | null): number {
  if (durationMs <= 0) return Math.max(0, startMs);
  const maxStart =
    endMs != null && endMs > startMs ? endMs - 100 : Math.max(0, durationMs - 100);
  return Math.max(0, Math.min(startMs, maxStart));
}

/** setPositionAsync 후 실제 seek 반영 대기 (원격 URL에서 첫 프레임만 보이고 멈추는 현상 완화) */
export async function waitForVideoSeek(
  getStatus: () => Promise<{ isLoaded: boolean; positionMillis?: number }>,
  targetMs: number,
  maxAttempts = 12,
  intervalMs = 100,
): Promise<void> {
  const tolerance = Math.max(250, targetMs * 0.05);
  for (let i = 0; i < maxAttempts; i += 1) {
    const st = await getStatus();
    if (st.isLoaded && (st.positionMillis ?? 0) >= targetMs - tolerance) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
