import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { CommunityAdCard } from '@/components/community/CommunityAdCard';
import { CommunityNicknameRow } from '@/components/community/CommunityNicknameRow';
import { CommunityPostCard } from '@/components/community/CommunityPostCard';
import { fetchCommunityPosts } from '@/lib/community-api';
import { getOrCreateCommunityNickname } from '@/lib/community-nickname';
import {
  buildFeedWithAds,
  COMMUNITY_TABS,
  type CommunityTabKey,
  type FeedListItem,
} from '@/lib/community-feed';
import { PastelColors, Fonts, softShadow } from '@/constants/theme';

export default function CommunityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CommunityTabKey>('all');
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof fetchCommunityPosts>>>([]);
  const [loading, setLoading] = useState(true);
  const [myNickname, setMyNickname] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const rows = await fetchCommunityPosts({ tab: activeTab });
    setPosts(rows);
    setLoading(false);
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
      void getOrCreateCommunityNickname().then(setMyNickname);
    }, [loadPosts]),
  );

  const feedItems = useMemo(() => buildFeedWithAds(posts), [posts]);

  const renderItem = useCallback(
    ({ item }: { item: FeedListItem }) => {
      if (item.type === 'ad') {
        return <CommunityAdCard copy={item.copy} />;
      }
      return (
        <CommunityPostCard
          post={item.post}
          onPress={() =>
            router.push({
              pathname: '/community/[id]',
              params: { id: item.post.id },
            } as import('expo-router').Href)
          }
        />
      );
    },
    [router],
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
      </ScrollView>

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
              <Text style={styles.emptyTitle}>아직 글이 없어요</Text>
              <Text style={styles.emptySub}>첫 이야기를 남겨 보세요!</Text>
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
