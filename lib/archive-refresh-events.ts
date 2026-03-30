/** 아카이브 목록을 DB에서 다시 불러오도록 알림 */
const listeners = new Set<() => void>();

export function subscribeArchiveRefresh(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitArchiveRefresh(): void {
  listeners.forEach((cb) => cb());
}
