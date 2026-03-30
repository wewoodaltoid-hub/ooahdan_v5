/**
 * 우아카드 + 단어장(플레이리스트) 공유 저장소.
 * manage-cards에서 추가한 카드 목록과 manage-playlists에서 만든 단어장 목록을 유지합니다.
 */

export type WordStatus = "knows" | "says";

export type WordCard = {
  id: string;
  word: string;
  image: number | string;
  category: string;
  status?: WordStatus;
};

export type Playlist = {
  id: string;
  name: string;
  wordIds: string[];
  createdAt?: number; // 타임스탬프, 예전 데이터는 없을 수 있음
};

let cards: WordCard[] = [];
let playlists: Playlist[] = [];
/** 놀이 화면에 전달할 카드 배열 (메인에서 설정, play-cards에서 소비) */
let playSessionCards: WordCard[] | null = null;
/** 단어장 플레이 시: 플레이리스트 ID만 넘기고 play-cards에서 Supabase로 해당 단어 전부 로드 (store 카드 개수에 의존하지 않음) */
let playSessionPlaylistId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export function getCards(): WordCard[] {
  return cards;
}

export function setCards(next: WordCard[]): void {
  cards = next;
  emit();
}

export function addCard(card: WordCard): void {
  cards = [...cards, card];
  emit();
}

export function getPlaylists(): Playlist[] {
  return playlists;
}

export function addPlaylist(playlist: Omit<Playlist, 'id' | 'createdAt'>): void {
  playlists = [
    ...playlists,
    {
      ...playlist,
      id: Date.now().toString(),
      createdAt: Date.now(),
    },
  ];
  emit();
}

export function removePlaylist(id: string): void {
  playlists = playlists.filter((p) => p.id !== id);
  emit();
}

export function getPlaySessionCards(): WordCard[] | null {
  return playSessionCards;
}

export function setPlaySessionCards(next: WordCard[] | null): void {
  playSessionCards = next;
}

export function getPlaySessionPlaylistId(): string | null {
  return playSessionPlaylistId;
}

export function setPlaySessionPlaylistId(id: string | null): void {
  playSessionPlaylistId = id;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
