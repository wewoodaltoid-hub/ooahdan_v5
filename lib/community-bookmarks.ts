import AsyncStorage from '@react-native-async-storage/async-storage';

const bookmarkKey = (userId: string) => `community_bookmarks_v1:${userId}`;

export async function loadCommunityBookmarks(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(bookmarkKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveCommunityBookmarks(userId: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(bookmarkKey(userId), JSON.stringify([...ids]));
}

/** 북마크 토글 — 토글 후 북마크 여부 반환 */
export async function toggleCommunityBookmark(
  userId: string,
  postId: string,
): Promise<boolean> {
  const ids = await loadCommunityBookmarks(userId);
  if (ids.has(postId)) {
    ids.delete(postId);
  } else {
    ids.add(postId);
  }
  await saveCommunityBookmarks(userId, ids);
  return ids.has(postId);
}
