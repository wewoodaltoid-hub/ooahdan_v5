import type { CommunityPost } from '@/lib/community-api';

export type CommunityTabKey = 'all' | 'hot' | 'parenting_tip' | 'free_talk';

export const COMMUNITY_TABS: { key: CommunityTabKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'hot', label: '🔥 HOT' },
  { key: 'parenting_tip', label: '💡 육아꿀팁' },
  { key: 'free_talk', label: '💬 자유수다' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  parenting_tip: '💡 육아꿀팁',
  free_talk: '💬 자유수다',
  /** 레거시 DB 행 호환 */
  parenting_worry: '💡 육아꿀팁',
  child_brag: '💬 자유수다',
};

export type FeedListItem =
  | { type: 'post'; post: CommunityPost }
  | { type: 'ad'; id: string; copy: string };

const AD_COPIES = [
  '한율이 또래 부모님들이 가장 많이 찾는 분유 정보',
  '우아단 엄마·아빠가 선택한 이유식 준비 체크리스트',
  '우리 아이 발달, 또래와 비교해보는 건강 가이드',
  '육아템 고민? 우아팬클럽이 추천한 베스트 아이템',
];

/** 게시글 3개마다 광고 카드 1개 삽입 */
export function buildFeedWithAds(posts: CommunityPost[]): FeedListItem[] {
  const items: FeedListItem[] = [];
  let adIndex = 0;
  posts.forEach((post, index) => {
    items.push({ type: 'post', post });
    if ((index + 1) % 3 === 0) {
      items.push({
        type: 'ad',
        id: `ad-slot-${index}`,
        copy: AD_COPIES[adIndex % AD_COPIES.length],
      });
      adIndex += 1;
    }
  });
  return items;
}
