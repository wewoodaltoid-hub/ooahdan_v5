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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Audio, Video, ResizeMode } from 'expo-av';
import {
  AdBannerPlaceholder,
  useAdBannerScrollContentStyle,
} from '@/components/AdBannerPlaceholder';
import { ArchiveAdWatchModal } from '@/components/archive-ad-watch-modal';
import { ViewerModeBanner } from '@/components/viewer-mode-banner';
import { useArchiveVideoPlayQuota } from '@/hooks/use-archive-video-play-quota';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import {
  fetchArchiveRecordingsForBaby,
  type ArchiveListItem,
} from '@/lib/archive-recordings-api';
import { subscribeArchiveRefresh } from '@/lib/archive-refresh-events';
import {
  addArchiveRecordingComment,
  deleteArchiveRecordingComment,
  fetchArchiveSocialForBaby,
  sumLikesForWord,
  toggleArchiveRecordingLike,
  type ArchiveSocialMap,
} from '@/lib/archive-social-api';
import { useUserStore, childNameWithSubject } from '@/stores/user-store';
import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';

export type ArchiveRecordWithMemo = ArchiveListItem & {
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

type WordListSortKind = 'latest' | 'oldest' | 'word' | 'likes';
type TimelineSortKind = 'latest' | 'oldest' | 'likes';

export default function ArchiveScreen() {
  const { activeBaby } = useBaby();
  const isAdmin = isBabyAdmin(activeBaby);
  const childName = useUserStore((s) => s.childName);
  const userName = useUserStore((s) => s.userName);
  const [archive, setArchive] = useState<ArchiveListItem[]>([]);
  const [socialByRecordingId, setSocialByRecordingId] = useState<ArchiveSocialMap>({});
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<WordListSortKind>('latest');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [timelineSortBy, setTimelineSortBy] = useState<TimelineSortKind>('latest');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmittingId, setCommentSubmittingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  /** 타임라인 각 행의 인라인 Video — 재생/트림 제어용 */
  const videoItemRefs = useRef<Record<string, Video | null>>({});
  const trimEndMsRef = useRef<number | null>(null);
  const trimStartMsRef = useRef(0);
  const listScrollContentStyle = useAdBannerScrollContentStyle(styles.listContent);
  const timelineScrollContentStyle = useAdBannerScrollContentStyle(styles.timelineContent);
  const {
    adModalVisible,
    requestArchiveVideoPlay,
    completeAdAndPlay,
    dismissAdModal,
  } = useArchiveVideoPlayQuota();

  const loadArchive = useCallback(async () => {
    const bid = activeBaby?.id;
    if (!bid) {
      setArchive([]);
      setArchiveLoading(false);
      return;
    }
    setArchiveLoading(true);
    const [rows, social] = await Promise.all([
      fetchArchiveRecordingsForBaby(bid),
      fetchArchiveSocialForBaby(bid),
    ]);
    setArchive(rows);
    setSocialByRecordingId(social);
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
    if (sortBy === 'likes') {
      return (
        sumLikesForWord(b.word, archive, socialByRecordingId) -
        sumLikesForWord(a.word, archive, socialByRecordingId)
      );
    }
    return a.word.localeCompare(b.word);
  });

  const getTimelineForWord = useCallback(
    (word: string): ArchiveRecordWithMemo[] => {
      const items = archive
        .filter((i) => i.word === word)
        .map((i) => ({ ...i, monthAge: undefined as number | undefined }));
      if (timelineSortBy === 'likes') {
        return [...items].sort(
          (a, b) =>
            (socialByRecordingId[b.id]?.likeCount ?? 0) -
            (socialByRecordingId[a.id]?.likeCount ?? 0),
        );
      }
      if (timelineSortBy === 'oldest') {
        return [...items].sort((a, b) => a.createdAt - b.createdAt);
      }
      return [...items].sort((a, b) => b.createdAt - a.createdAt);
    },
    [archive, timelineSortBy, socialByRecordingId],
  );

  const timelineRecords = selectedWord ? getTimelineForWord(selectedWord) : [];

  const authorDisplayName = userName.trim() || '가족';
  const authorRelation = activeBaby?.relation_name?.trim() || '가족';

  const handleToggleLike = useCallback(
    async (recordingId: string) => {
      const babyId = activeBaby?.id;
      if (!babyId) return;
      const social = socialByRecordingId[recordingId];
      const result = await toggleArchiveRecordingLike(
        recordingId,
        babyId,
        social?.likedByMe ?? false,
      );
      if (!result.ok) {
        Alert.alert('좋아요', result.message ?? '처리하지 못했어요.');
        return;
      }
      const nextSocial = await fetchArchiveSocialForBaby(babyId);
      setSocialByRecordingId(nextSocial);
    },
    [activeBaby?.id, socialByRecordingId],
  );

  const handleSubmitComment = useCallback(
    async (recordingId: string) => {
      const babyId = activeBaby?.id;
      if (!babyId) return;
      const body = commentDrafts[recordingId]?.trim() ?? '';
      if (!body) return;
      setCommentSubmittingId(recordingId);
      const result = await addArchiveRecordingComment({
        recordingId,
        babyId,
        body,
        authorDisplayName,
        authorRelation,
      });
      setCommentSubmittingId(null);
      if (!result.ok) {
        Alert.alert('댓글', result.message ?? '등록하지 못했어요.');
        return;
      }
      setCommentDrafts((prev) => ({ ...prev, [recordingId]: '' }));
      const nextSocial = await fetchArchiveSocialForBaby(babyId);
      setSocialByRecordingId(nextSocial);
    },
    [activeBaby?.id, commentDrafts, authorDisplayName, authorRelation],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const babyId = activeBaby?.id;
      if (!babyId) return;
      Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await deleteArchiveRecordingComment(commentId);
              if (!result.ok) {
                Alert.alert('삭제 실패', result.message ?? '삭제하지 못했어요.');
                return;
              }
              const nextSocial = await fetchArchiveSocialForBaby(babyId);
              setSocialByRecordingId(nextSocial);
            })();
          },
        },
      ]);
    },
    [activeBaby?.id],
  );

  /** 목록 복귀·단어 전환 시 재생 완전 정지 (pause 잔류·playingId 잠금 방지) */
  const stopAllPlayback = useCallback(async () => {
    trimEndMsRef.current = null;
    trimStartMsRef.current = 0;
    setPlayingId(null);

    try {
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }
    } catch {
      soundRef.current = null;
    }

    const videos = Object.values(videoItemRefs.current);
    videoItemRefs.current = {};
    for (const video of videos) {
      if (!video) continue;
      try {
        await video.stopAsync();
        await video.unloadAsync();
      } catch {
        /* noop */
      }
    }
  }, []);

  const startVideoPlayback = useCallback(async (record: ArchiveRecordWithMemo) => {
    const startMs = Math.max(0, record.trimStartMs ?? 0);
    const endMs = record.trimEndMs;
    trimStartMsRef.current = startMs;
    trimEndMsRef.current = endMs;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const v = videoItemRefs.current[record.id];
      if (!v) {
        setPlayingId(record.id);
        return;
      }
      await v.setProgressUpdateIntervalAsync(100);
      await v.setPositionAsync(startMs);
      setPlayingId(record.id);
      await v.playAsync();
    } catch {
      trimEndMsRef.current = null;
      trimStartMsRef.current = 0;
      setPlayingId(null);
    }
  }, []);

  const startAudioPlayback = useCallback(async (record: ArchiveRecordWithMemo) => {
    const startMs = Math.max(0, record.trimStartMs ?? 0);
    const endMs = record.trimEndMs;
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
  }, []);

  const handlePlay = useCallback(
    async (record: ArchiveRecordWithMemo) => {
      if (playingId === record.id) {
        try {
          if (record.mediaType === 'video') {
            const v = videoItemRefs.current[record.id];
            if (v) {
              await v.stopAsync();
              await v.unloadAsync();
              delete videoItemRefs.current[record.id];
            }
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

      if (record.mediaType === 'video') {
        await requestArchiveVideoPlay(() => startVideoPlayback(record));
        return;
      }

      await startAudioPlayback(record);
    },
    [playingId, requestArchiveVideoPlay, startVideoPlayback, startAudioPlayback],
  );

  const openTimeline = useCallback(
    (word: string) => {
      void stopAllPlayback();
      setSelectedWord(word);
    },
    [stopAllPlayback],
  );

  const closeTimeline = useCallback(() => {
    void stopAllPlayback();
    setSelectedWord(null);
  }, [stopAllPlayback]);

  useEffect(() => {
    if (selectedWord == null) {
      void stopAllPlayback();
    }
  }, [selectedWord, stopAllPlayback]);

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
                <Pressable
                  style={[styles.sortChip, sortBy === 'likes' && styles.sortChipActive]}
                  onPress={() => setSortBy('likes')}
                >
                  <Text style={[styles.sortChipText, sortBy === 'likes' && styles.sortChipTextActive]}>좋아요순</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={listScrollContentStyle}
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
                      기록 {s.count}개 · ♥ {sumLikesForWord(s.word, archive, socialByRecordingId)} · 마지막{' '}
                      {formatDate(s.latestAt)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.timelineContainer}>
            <View style={styles.timelineHeaderBlock}>
              <View style={styles.timelineHeader}>
                <Pressable onPress={closeTimeline} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← 목록</Text>
                </Pressable>
                <Text style={styles.timelineTitle} numberOfLines={1}>
                  {selectedWord} 성장 기록
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timelineSortRow}
              >
                <Pressable
                  style={[styles.sortChip, timelineSortBy === 'latest' && styles.sortChipActive]}
                  onPress={() => setTimelineSortBy('latest')}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      timelineSortBy === 'latest' && styles.sortChipTextActive,
                    ]}
                  >
                    최신순
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.sortChip, timelineSortBy === 'oldest' && styles.sortChipActive]}
                  onPress={() => setTimelineSortBy('oldest')}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      timelineSortBy === 'oldest' && styles.sortChipTextActive,
                    ]}
                  >
                    과거순
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.sortChip, timelineSortBy === 'likes' && styles.sortChipActive]}
                  onPress={() => setTimelineSortBy('likes')}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      timelineSortBy === 'likes' && styles.sortChipTextActive,
                    ]}
                  >
                    좋아요순
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
            <ScrollView
              style={styles.timelineScroll}
              contentContainerStyle={timelineScrollContentStyle}
              showsVerticalScrollIndicator={false}
            >
              {timelineRecords.map((record, index) => {
                const social = socialByRecordingId[record.id];
                const likeCount = social?.likeCount ?? 0;
                const likedByMe = social?.likedByMe ?? false;
                const comments = social?.comments ?? [];
                return (
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
                        shouldPlay={false}
                        useNativeControls={false}
                        isLooping={false}
                        onLoad={() => {
                          if (playingId !== record.id) return;
                          const startMs = Math.max(0, record.trimStartMs ?? 0);
                          const video = videoItemRefs.current[record.id];
                          void (async () => {
                            try {
                              await video?.setPositionAsync(startMs);
                              if (playingId === record.id) {
                                await video?.playAsync();
                              }
                            } catch {
                              /* noop */
                            }
                          })();
                        }}
                        onPlaybackStatusUpdate={(status) => {
                          if (!status.isLoaded || playingId !== record.id) return;
                          const startMs = Math.max(0, record.trimStartMs ?? 0);
                          const endLimit = record.trimEndMs;
                          const pos = status.positionMillis ?? 0;
                          const video = videoItemRefs.current[record.id];

                          if (pos < startMs - 80) {
                            void video?.setPositionAsync(startMs).catch(() => {});
                            return;
                          }

                          if (
                            endLimit != null &&
                            status.isPlaying &&
                            pos >= endLimit - 50
                          ) {
                            void (async () => {
                              try {
                                await video?.pauseAsync();
                                await video?.setPositionAsync(startMs);
                              } catch {
                                /* noop */
                              }
                              trimEndMsRef.current = null;
                              trimStartMsRef.current = 0;
                              setPlayingId(null);
                            })();
                            return;
                          }

                          if (status.didJustFinish) {
                            trimEndMsRef.current = null;
                            trimStartMsRef.current = 0;
                            setPlayingId(null);
                          }
                        }}
                      />
                    ) : null}
                    <View style={styles.socialRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.likeBtn,
                          likedByMe && styles.likeBtnActive,
                          pressed && styles.likeBtnPressed,
                        ]}
                        onPress={() => void handleToggleLike(record.id)}
                      >
                        <Text style={[styles.likeBtnText, likedByMe && styles.likeBtnTextActive]}>
                          {likedByMe ? '♥' : '♡'} {likeCount}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.commentsBlock}>
                      <Text style={styles.commentsTitle}>가족 댓글</Text>
                      {comments.length === 0 ? (
                        <Text style={styles.commentsEmpty}>첫 댓글을 남겨 보세요!</Text>
                      ) : (
                        comments.map((c) => (
                          <View key={c.id} style={styles.commentItem}>
                            <View style={styles.commentHeader}>
                              <Text style={styles.commentAuthor}>
                                {c.authorDisplayName}
                                <Text style={styles.commentRelation}> · {c.authorRelation}</Text>
                              </Text>
                              {c.isMine ? (
                                <Pressable
                                  onPress={() => void handleDeleteComment(c.id)}
                                  hitSlop={8}
                                >
                                  <Text style={styles.commentDelete}>삭제</Text>
                                </Pressable>
                              ) : null}
                            </View>
                            <Text style={styles.commentBody}>{c.body}</Text>
                            <Text style={styles.commentDate}>{formatDate(c.createdAt)}</Text>
                          </View>
                        ))
                      )}
                      <View style={styles.commentComposer}>
                        <TextInput
                          style={styles.commentInput}
                          placeholder="댓글을 남겨보세요 (예: 처음으로 뚜렷하게 말한 날!)"
                          placeholderTextColor={PastelColors.textSecondary}
                          value={commentDrafts[record.id] ?? ''}
                          onChangeText={(v) =>
                            setCommentDrafts((prev) => ({ ...prev, [record.id]: v }))
                          }
                          multiline
                          editable={commentSubmittingId !== record.id}
                        />
                        <Pressable
                          style={({ pressed }) => [
                            styles.commentSubmitBtn,
                            pressed && styles.commentSubmitBtnPressed,
                            commentSubmittingId === record.id && styles.commentSubmitBtnDisabled,
                          ]}
                          onPress={() => void handleSubmitComment(record.id)}
                          disabled={commentSubmittingId === record.id}
                        >
                          <Text style={styles.commentSubmitText}>
                            {commentSubmittingId === record.id ? '…' : '등록'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
              })}
            </ScrollView>
          </View>
        )}
        </KeyboardAvoidingView>
        <AdBannerPlaceholder fixedBottom />
      </SafeAreaView>

      <ArchiveAdWatchModal
        visible={adModalVisible}
        onComplete={() => void completeAdAndPlay()}
        onCancel={dismissAdModal}
      />
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
  timelineHeaderBlock: {
    backgroundColor: PastelColors.primaryLight,
    paddingBottom: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  timelineSortRow: {
    paddingHorizontal: 24,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
  socialRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
  },
  likeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: PastelColors.primaryLight,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  likeBtnActive: {
    backgroundColor: '#F3E8FF',
    borderColor: PastelColors.accent,
  },
  likeBtnPressed: {
    opacity: 0.88,
  },
  likeBtnText: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    fontWeight: '600',
  },
  likeBtnTextActive: {
    color: PastelColors.accent,
  },
  commentsBlock: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PastelColors.border,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  commentsEmpty: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
  },
  commentItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    flex: 1,
  },
  commentRelation: {
    fontWeight: '500',
    color: PastelColors.textSecondary,
  },
  commentDelete: {
    fontSize: 12,
    color: '#9E4A62',
    fontFamily: Fonts.rounded,
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  commentDate: {
    marginTop: 6,
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    textAlignVertical: 'top',
  },
  commentSubmitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
  },
  commentSubmitBtnPressed: {
    opacity: 0.88,
  },
  commentSubmitBtnDisabled: {
    opacity: 0.5,
  },
  commentSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
