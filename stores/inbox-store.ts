/**
 * 인박스(우아기록) 공유 저장소.
 * 우아놀이에서 녹음 저장 시 추가되고, 우아기록 화면에서 조회/삭제합니다.
 * 확정 아카이브는 Supabase archive_recordings + Storage audios를 사용합니다.
 */

export type InboxRecordingItem = {
  id: string;
  uri: string;
  cardId: string;
  word: string;
  createdAt: number;
  /** 미지정 시 오디오(기존 동작) */
  mediaType?: "audio" | "video";
};

let inbox: InboxRecordingItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export function getInbox(): InboxRecordingItem[] {
  return inbox;
}

export function addInboxItem(item: InboxRecordingItem): void {
  inbox = [...inbox, item];
  emit();
}

export function removeInboxItem(id: string): void {
  inbox = inbox.filter((x) => x.id !== id);
  emit();
}

/** 인박스 전체 비우기 (소음 일괄 삭제) */
export function clearAllInbox(): void {
  inbox = [];
  emit();
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
