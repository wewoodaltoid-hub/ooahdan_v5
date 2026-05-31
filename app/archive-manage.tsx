/**
 * 단어(card)별 아카이브 기록 관리 — 한도 초과 시 삭제 유도
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useBaby } from '@/contexts/BabyContext';
import {
  deleteArchiveRecording,
  fetchArchiveRecordingsByCardId,
  type ArchiveListItem,
} from '@/lib/archive-recordings-api';
import { emitArchiveRefresh } from '@/lib/archive-refresh-events';
import {
  ARCHIVE_RECORDINGS_QUOTA_PER_CARD,
} from '@/lib/archive-quota';
import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ArchiveManageScreen() {
  const router = useRouter();
  const { activeBaby } = useBaby();
  const params = useLocalSearchParams<{ word?: string; cardId?: string }>();
  const word = typeof params.word === 'string' ? params.word : '';
  const cardId = typeof params.cardId === 'string' ? params.cardId : '';

  const [items, setItems] = useState<ArchiveListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const babyId = activeBaby?.id;
    if (!babyId || (!word && !cardId)) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchArchiveRecordingsByCardId(babyId, cardId, word);
    setItems(rows);
    setLoading(false);
  }, [activeBaby?.id, cardId, word]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleDelete = useCallback(
    (item: ArchiveListItem) => {
      const babyId = activeBaby?.id;
      if (!babyId) return;
      Alert.alert(
        '기록 삭제',
        `${formatDate(item.archivedAt ?? item.createdAt)} 기록을 삭제할까요? 복구할 수 없어요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setDeletingId(item.id);
                const result = await deleteArchiveRecording(item.id, babyId);
                setDeletingId(null);
                if (!result.ok) {
                  Alert.alert('삭제 실패', result.message);
                  return;
                }
                emitArchiveRefresh();
                await loadItems();
              })();
            },
          },
        ],
      );
    },
    [activeBaby?.id, loadItems],
  );

  const atQuota = items.length >= ARCHIVE_RECORDINGS_QUOTA_PER_CARD;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: word ? `「${word}」 기록 관리` : '기록 관리',
          headerBackTitle: '뒤로',
          headerTintColor: PastelColors.text,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: {
            fontFamily: Fonts.rounded,
            fontSize: 18,
            color: PastelColors.text,
          },
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>
            저장 {items.length} / {ARCHIVE_RECORDINGS_QUOTA_PER_CARD}개
          </Text>
          <Text style={styles.bannerSub}>
            {atQuota
              ? '한도에 도달했어요. 삭제하면 새 기록을 아카이빙할 수 있어요.'
              : '오래된 기록을 삭제해 공간을 비울 수 있어요.'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PastelColors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>이 단어의 아카이브 기록이 없어요.</Text>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>돌아가기</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardDate}>
                    {formatDate(item.archivedAt ?? item.createdAt)}
                  </Text>
                  <Text style={styles.cardType}>
                    {item.mediaType === 'video' ? '🎬 영상' : '🎙️ 음성'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed && styles.deleteBtnPressed,
                    deletingId === item.id && styles.deleteBtnDisabled,
                  ]}
                  onPress={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  <Text style={styles.deleteBtnText}>
                    {deletingId === item.id ? '삭제 중…' : '삭제'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  banner: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  bannerSub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: PastelColors.primaryLight,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 12,
  },
  card: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 18,
    ...flashcardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  cardType: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  deleteBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#F8E8EE',
    borderWidth: 1,
    borderColor: '#E8C4D0',
  },
  deleteBtnPressed: {
    opacity: 0.88,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E4A62',
    fontFamily: Fonts.rounded,
  },
});
