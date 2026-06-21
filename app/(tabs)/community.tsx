import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { CommunityAdCard } from '@/components/community/CommunityAdCard';
import { CommunityNicknameRow } from '@/components/community/CommunityNicknameRow';
import { CommunityPostCard } from '@/components/community/CommunityPostCard';
import {
  deleteCommunityPost,
  fetchCommunityPosts,
  fetchPostIdsCommentedByMe,
} from '@/lib/community-api';
import { loadCommunityBookmarks, toggleCommunityBookmark } from '@/lib/community-bookmarks';
import { getOrCreateCommunityNickname } from '@/lib/community-nickname';
import {
  buildFeedWithAds,
  COMMUNITY_TABS,
  type CommunityTabKey,
  type FeedListItem,
} from '@/lib/community-feed';
import { supabase } from '@/lib/supabase';
import { PastelColors, Fonts, softShadow } from '@/constants/theme';

type ActivityFilter = 'my_posts' | 'my_comments';

export default function CommunityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CommunityTabKey>('all');
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof fetchCommunityPosts>>>([]);
  const [loading, setLoading] = useState(true);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('my_posts');
  const [commentedPostIds, setCommentedPostIds] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const rows = await fetchCommunityPosts({ tab: activeTab });
    setPosts(rows);
    setLoading(false);
  }, [activeTab]);

  const loadUserMeta = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setMyUserId(uid);
    if (uid) {
      const [commentedIds, bookmarkSet] = await Promise.all([
        fetchPostIdsCommentedByMe(),
        loadCommunityBookmarks(uid),
      ]);
      setCommentedPostIds(new Set(commentedIds));
      setBookmarks(bookmarkSet);
    } else {
      setCommentedPostIds(new Set());
      setBookmarks(new Set());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
      void getOrCreateCommunityNickname().then(setMyNickname);
      void loadUserMeta();
    }, [loadPosts, loadUserMeta]),
  );

  const filteredPosts = useMemo(() => {
    let rows = posts;
    const q = searchApplied.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
      );
    }
    if (activityOpen && myUserId) {
      if (activityFilter === 'my_posts') {
        rows = rows.filter((p) => p.authorUserId === myUserId);
      } else {
        rows = rows.filter((p) => commentedPostIds.has(p.id));
      }
    }
    return rows;
  }, [posts, searchApplied, activityOpen, activityFilter, myUserId, commentedPostIds]);

  const feedItems = useMemo(() => buildFeedWithAds(filteredPosts), [filteredPosts]);

  const handleSearch = useCallback(() => {
    setSearchApplied(searchQuery);
  }, [searchQuery]);

  const handleBookmarkPress = useCallback(
    async (postId: string) => {
      if (!myUserId) {
        Alert.alert('북마크', '로그인이 필요해요.');
        return;
      }
      const next = await toggleCommunityBookmark(myUserId, postId);
      setBookmarks((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(postId);
        else copy.delete(postId);
        return copy;
      });
    },
    [myUserId],
  );

  const handleDeletePost = useCallback(
    (postId: string) => {
      Alert.alert('글 삭제', '이 글을 삭제할까요? 복구할 수 없어요.', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await deleteCommunityPost(postId);
              if (!result.ok) {
                Alert.alert('삭제 실패', result.message);
                return;
              }
              setPosts((prev) => prev.filter((p) => p.id !== postId));
              if (myUserId) {
                setBookmarks((prev) => {
                  const copy = new Set(prev);
                  copy.delete(postId);
                  return copy;
                });
              }
            })();
          },
        },
      ]);
    },
    [myUserId],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedListItem }) => {
      if (item.type === 'ad') {
        return <CommunityAdCard copy={item.copy} />;
      }
      return (
        <CommunityPostCard
          post={item.post}
          currentUserId={myUserId}
          bookmarked={bookmarks.has(item.post.id)}
          onBookmarkPress={() => void handleBookmarkPress(item.post.id)}
          onDeletePress={() => handleDeletePost(item.post.id)}
          onPress={() =>
            router.push({
              pathname: '/community/[id]',
              params: { id: item.post.id },
            } as import('expo-router').Href)
          }
        />
      );
    },
    [router, myUserId, bookmarks, handleBookmarkPress, handleDeletePost],
  );

  const keyExtractor = useCallback((item: FeedListItem) => {
    if (item.type === 'ad') return item.id;
    return item.post.id;
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>커뮤니티</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="제목·본문 검색"
          placeholderTextColor={PastelColors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
          onPress={handleSearch}
        >
          <Text style={styles.searchBtnText}>검색</Text>
        </Pressable>
      </View>

      <CommunityNicknameRow
        nickname={myNickname}
        onNicknameChange={setMyNickname}
        variant="inline"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={styles.tabScroll}
      >
        {COMMUNITY_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.tabChip, styles.activityChip, activityOpen && styles.tabChipActive]}
          onPress={() => setActivityOpen((v) => !v)}
        >
          <Text style={[styles.tabChipText, activityOpen && styles.tabChipTextActive]}>
            📋 내 활동
          </Text>
        </Pressable>
      </ScrollView>

      {activityOpen ? (
        <View style={styles.activitySegment}>
          <Pressable
            style={[
              styles.activitySegmentBtn,
              activityFilter === 'my_posts' && styles.activitySegmentBtnActive,
            ]}
            onPress={() => setActivityFilter('my_posts')}
          >
            <Text
              style={[
                styles.activitySegmentText,
                activityFilter === 'my_posts' && styles.activitySegmentTextActive,
              ]}
            >
              내가 쓴 글
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.activitySegmentBtn,
              activityFilter === 'my_comments' && styles.activitySegmentBtnActive,
            ]}
            onPress={() => setActivityFilter('my_comments')}
          >
            <Text
              style={[
                styles.activitySegmentText,
                activityFilter === 'my_comments' && styles.activitySegmentTextActive,
              ]}
            >
              내가 댓글 단 글
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PastelColors.accent} />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {searchApplied || activityOpen ? '조건에 맞는 글이 없어요' : '아직 글이 없어요'}
              </Text>
              <Text style={styles.emptySub}>
                {searchApplied || activityOpen
                  ? '다른 검색어나 필터를 시도해 보세요.'
                  : '첫 이야기를 남겨 보세요!'}
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/community-compose' as import('expo-router').Href)}
      >
        <Text style={styles.fabIcon}>✎</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  searchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: PastelColors.buttonPrimary,
  },
  searchBtnPressed: {
    opacity: 0.9,
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  tabScroll: {
    flexGrow: 0,
    marginBottom: 8,
    minHeight: 52,
  },
  tabRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
    alignItems: 'center',
    minHeight: 52,
  },
  tabChip: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityChip: {
    marginLeft: 4,
  },
  tabChipActive: {
    backgroundColor: PastelColors.accent,
    borderColor: PastelColors.accent,
  },
  tabChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  tabChipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
  },
  activitySegment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PastelColors.border,
    overflow: 'hidden',
    backgroundColor: PastelColors.surface,
  },
  activitySegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activitySegmentBtnActive: {
    backgroundColor: PastelColors.primaryLight,
  },
  activitySegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  activitySegmentTextActive: {
    color: PastelColors.accent,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabIcon: {
    fontSize: 22,
    color: PastelColors.buttonTextOnPrimary,
    fontWeight: '700',
  },
});
