/**
 * 우아 아카이브 — 확정 저장된 단어 목록 + 단어별 녹음 타임라인
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Audio, Video, ResizeMode } from 'expo-av';
import { ViewerModeBanner } from '@/components/viewer-mode-banner';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import {
  fetchArchiveRecordingsForBaby,
  type ArchiveListItem,
} from '@/lib/archive-recordings-api';
import { subscribeArchiveRefresh } from '@/lib/archive-refresh-events';
import { useUserStore, childNameWithSubject } from '@/stores/user-store';
import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';

/** 녹음 1건 + 메모(로컬) */
export type ArchiveRecordWithMemo = ArchiveListItem & {
  memo?: string;
  /** 목업용 월령 표시 (실제로는 생일 기준 계산 가능) */
  monthAge?: number;
};

/** 단어별로 그룹핑한 항목 (목록용) */
type WordSummary = {
  word: string;
  count: number;
  latestAt: number;
  latestId: string;
};

function buildWordSummaries(archive: ArchiveListItem[]): WordSummary[] {
  const byWord = new Map<string, { count: number; latestAt: number; latestId: string }>();
  archive.forEach((item) => {
    const existing = byWord.get(item.word);
    const t = item.archivedAt ?? item.createdAt;
    if (!existing || t > existing.latestAt) {
      byWord.set(item.word, { count: (existing?.count ?? 0) + 1, latestAt: t, latestId: item.id });
    } else {
      existing.count += 1;
    }
  });
  return Array.from(byWord.entries()).map(([word, v]) => ({
    word,
    count: v.count,
    latestAt: v.latestAt,
    latestId: v.latestId,
  }));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

type SortKind = 'latest' | 'oldest' | 'word';

export default function ArchiveScreen() {
  const { activeBaby } = useBaby();
  const isAdmin = isBabyAdmin(activeBaby);
  const childName = useUserStore((s) => s.childName);
  const [archive, setArchive] = useState<ArchiveListItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKind>('latest');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [timelineSortNewestFirst, setTimelineSortNewestFirst] = useState(true);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  /** 타임라인 각 행의 인라인 Video — 재생/트림 제어용 */
  const videoItemRefs = useRef<Record<string, Video | null>>({});
  const trimEndMsRef = useRef<number | null>(null);

  const loadArchive = useCallback(async () => {
    const bid = activeBaby?.id;
    if (!bid) {
      setArchive([]);
      setArchiveLoading(false);
      return;
    }
    setArchiveLoading(true);
    const rows = await fetchArchiveRecordingsForBaby(bid);
    setArchive(rows);
    setArchiveLoading(false);
  }, [activeBaby?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadArchive();
    }, [loadArchive]),
  );

  useEffect(() => {
    return subscribeArchiveRefresh(() => {
      void loadArchive();
    });
  }, [loadArchive]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    return () => {
      trimEndMsRef.current = null;
      const s = soundRef.current;
      soundRef.current = null;
      void s?.unloadAsync();
      Object.values(videoItemRefs.current).forEach((v) => {
        void v?.unloadAsync();
      });
      videoItemRefs.current = {};
    };
  }, []);

  const summaries = buildWordSummaries(archive);
  const filtered = searchQuery.trim()
    ? summaries.filter((s) => s.word.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : summaries;
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'latest') return b.latestAt - a.latestAt;
    if (sortBy === 'oldest') return a.latestAt - b.latestAt;
    return a.word.localeCompare(b.word);
  });

  const getTimelineForWord = useCallback((word: string): ArchiveRecordWithMemo[] => {
    const items = archive
      .filter((i) => i.word === word)
      .map((i) => ({
        ...i,
        memo: memos[i.id] ?? '',
        monthAge: undefined as number | undefined,
      }));
    return items.sort((a, b) => (timelineSortNewestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
  }, [archive, memos, timelineSortNewestFirst]);

  const timelineRecords = selectedWord ? getTimelineForWord(selectedWord) : [];

  const setMemo = useCallback((id: string, value: string) => {
    setMemos((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handlePlay = useCallback(async (record: ArchiveRecordWithMemo) => {
    if (playingId === record.id) {
      try {
        if (record.mediaType === 'video') {
          await videoItemRefs.current[record.id]?.pauseAsync();
        } else {
          await soundRef.current?.stopAsync();
          await soundRef.current?.unloadAsync();
          soundRef.current = null;
        }
      } catch {
        /* noop */
      }
      trimEndMsRef.current = null;
      setPlayingId(null);
      return;
    }
    if (playingId) return;
    if (!record.uri) return;

    const startMs = Math.max(0, record.trimStartMs ?? 0);
    const endMs = record.trimEndMs;

    if (record.mediaType === 'video') {
      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        const v = videoItemRefs.current[record.id];
        if (v) {
          await v.setPositionAsync(startMs);
          await v.setProgressUpdateIntervalAsync(100);
        }
        trimEndMsRef.current = endMs;
        setPlayingId(record.id);
      } catch {
        trimEndMsRef.current = null;
        setPlayingId(null);
      }
      return;
    }

    trimEndMsRef.current = endMs;
    setPlayingId(record.id);

    try {
      Object.values(videoItemRefs.current).forEach((v) => {
        void v?.pauseAsync();
      });
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: record.uri });
      soundRef.current = sound;
      await sound.setVolumeAsync(1.0);
      await sound.setPositionAsync(startMs);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        const limit = trimEndMsRef.current;
        if (limit != null && status.isPlaying) {
          const pos = status.positionMillis ?? 0;
          if (pos >= limit - 50) {
            void (async () => {
              try {
                await sound.stopAsync();
                await sound.unloadAsync();
              } catch {
                /* noop */
              }
              if (soundRef.current === sound) {
                soundRef.current = null;
              }
              trimEndMsRef.current = null;
              setPlayingId(null);
            })();
            return;
          }
        }

        if (status.didJustFinish) {
          void sound.unloadAsync().then(() => {
            if (soundRef.current === sound) soundRef.current = null;
            trimEndMsRef.current = null;
            setPlayingId(null);
          }).catch(() => setPlayingId(null));
        }
      });

      await sound.playAsync();
    } catch {
      trimEndMsRef.current = null;
      setPlayingId(null);
    }
  }, [playingId]);

  const openTimeline = (word: string) => setSelectedWord(word);
  const closeTimeline = () => setSelectedWord(null);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '우아 아카이브',
          headerBackTitle: '메인',
          headerTintColor: PastelColors.text,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 18, color: PastelColors.text },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
        {!isAdmin && (
          <View style={styles.viewerBannerWrap}>
            <ViewerModeBanner />
          </View>
        )}
        {selectedWord == null ? (
          <>
            {/* 성장 요약(대시보드) 위젯 */}
            <View style={styles.dashboardCard}>
              <Text style={styles.dashboardMessage}>
                우아! {childNameWithSubject(childName || '우리 아이')} 지금까지 총 {summaries.length}개의 단어를 기록했어요! 🎉
              </Text>
            </View>
            <View style={styles.toolbar}>
              <TextInput
                style={styles.searchInput}
                placeholder="단어 검색..."
                placeholderTextColor={PastelColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>정렬:</Text>
                <Pressable
                  style={[styles.sortChip, sortBy === 'latest' && styles.sortChipActive]}
                  onPress={() => setSortBy('latest')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'latest' && styles.sortChipTextActive]}>최신순</Text>
                </Pressable>
                <Pressable
                  style={[styles.sortChip, sortBy === 'oldest' && styles.sortChipActive]}
                  onPress={() => setSortBy('oldest')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'oldest' && styles.sortChipTextActive]}>과거순</Text>
                </Pressable>
                <Pressable
                  style={[styles.sortChip, sortBy === 'word' && styles.sortChipActive]}
                  onPress={() => setSortBy('word')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'word' && styles.sortChipTextActive]}>가나다</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {archiveLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator size="large" color={PastelColors.accent} />
                  <Text style={[styles.emptySub, { marginTop: 16 }]}>아카이브 불러오는 중...</Text>
                </View>
              ) : sorted.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🗂️</Text>
                  <Text style={styles.emptyText}>아직 확정 저장된 단어가 없어요</Text>
                  <Text style={styles.emptySub}>우아기록에서 녹음 후 확정 저장하면 여기 쌓여요.</Text>
                </View>
              ) : (
                sorted.map((s) => (
                  <Pressable
                    key={s.word}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => openTimeline(s.word)}
                  >
                    <Text style={styles.cardWord}>{s.word}</Text>
                    <Text style={styles.cardMeta}>
                      기록 {s.count}개 · 마지막 {formatDate(s.latestAt)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.timelineContainer}>
            <View style={styles.timelineHeader}>
              <Pressable onPress={closeTimeline} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← 목록</Text>
              </Pressable>
              <Text style={styles.timelineTitle}>{selectedWord} 성장 기록</Text>
              <Pressable
                style={styles.timelineSortToggle}
                onPress={() => setTimelineSortNewestFirst((v) => !v)}
              >
                <Text style={styles.timelineSortToggleText}>
                  {timelineSortNewestFirst ? '최신순 ▼' : '과거순 ▲'}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineContent}
              showsVerticalScrollIndicator={false}
            >
              {timelineRecords.map((record, index) => (
                <View key={record.id} style={styles.timelineNode}>
                  <View style={styles.timelineDotLine}>
                    <View style={styles.timelineDot} />
                    {index < timelineRecords.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineBody}>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineDate}>
                        {formatDate(record.createdAt)}
                        {record.monthAge != null ? ` (${record.monthAge}개월)` : ''}
                      </Text>
                      <Pressable
                        style={[styles.playBtnSmall, playingId === record.id && styles.playBtnSmallActive]}
                        onPress={() => handlePlay(record)}
                        disabled={!!playingId && playingId !== record.id}
                      >
                        <Text style={styles.playBtnSmallText}>
                          {playingId === record.id ? '■ 정지' : '▶ 재생'}
                        </Text>
                      </Pressable>
                    </View>
                    {record.mediaType === 'video' && record.uri ? (
                      <Video
                        ref={(r) => {
                          if (r) {
                            videoItemRefs.current[record.id] = r;
                          } else {
                            delete videoItemRefs.current[record.id];
                          }
                        }}
                        source={{ uri: record.uri }}
                        style={styles.timelineVideo}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={playingId === record.id}
                        useNativeControls={false}
                        isLooping={false}
                        onPlaybackStatusUpdate={(status) => {
                          if (!status.isLoaded || playingId !== record.id) return;
                          const endLimit = record.trimEndMs;
                          if (endLimit != null && status.isPlaying) {
                            const pos = status.positionMillis ?? 0;
                            if (pos >= endLimit - 50) {
                              void videoItemRefs.current[record.id]
                                ?.pauseAsync()
                                .then(() => {
                                  trimEndMsRef.current = null;
                                  setPlayingId(null);
                                })
                                .catch(() => {
                                  trimEndMsRef.current = null;
                                  setPlayingId(null);
                                });
                              return;
                            }
                          }
                          if (status.didJustFinish) {
                            trimEndMsRef.current = null;
                            setPlayingId(null);
                          }
                        }}
                      />
                    ) : null}
                    <TextInput
                      style={styles.memoInput}
                      placeholder="메모를 남겨보세요 (예: 처음으로 뚜렷하게 말한 날!)"
                      placeholderTextColor={PastelColors.textSecondary}
                      value={record.memo ?? ''}
                      onChangeText={(v) => setMemo(record.id, v)}
                      multiline
                      editable
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  viewerBannerWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dashboardCard: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    overflow: 'hidden',
    ...flashcardShadow,
  },
  dashboardMessage: {
    fontSize: 18,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 26,
    textAlign: 'center',
  },
  toolbar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PastelColors.background,
  },
  searchInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    paddingHorizontal: 20,
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 14,
    ...flashcardShadow,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortLabel: {
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  sortChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: PastelColors.primaryLight,
  },
  sortChipActive: {
    backgroundColor: PastelColors.accent,
  },
  sortChipText: {
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  sortChipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  card: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 24,
    ...flashcardShadow,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardWord: {
    fontSize: 22,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  timelineContainer: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: PastelColors.primaryLight,
    borderBottomWidth: 0,
  },
  backBtn: {
    paddingVertical: 10,
    paddingRight: 16,
  },
  backBtnText: {
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  timelineTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  timelineSortToggle: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  timelineSortToggleText: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 150,
  },
  timelineNode: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineDotLine: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PastelColors.accent,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: PastelColors.backgroundMint,
    marginTop: 4,
    minHeight: 60,
  },
  timelineBody: {
    flex: 1,
    marginLeft: 14,
    paddingBottom: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timelineDate: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playBtnSmall: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
  },
  playBtnSmallActive: {
    backgroundColor: PastelColors.accent,
  },
  playBtnSmallText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  timelineVideo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#000',
  },
  memoInput: {
    minHeight: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    padding: 16,
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    textAlignVertical: 'top',
    ...flashcardShadow,
  },
});
