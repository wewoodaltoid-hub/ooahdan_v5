/**
 * 우아카드 단어장 만들기 — 카드 선택 후 플레이리스트로 저장
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useRouter } from 'expo-router';
import Checkbox from 'expo-checkbox';
import { WordListToolbar } from '@/components/WordListToolbar';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import {
  getPlaylists,
  addPlaylist,
  removePlaylist,
  subscribe,
  setPlaySessionCards,
  setPlaySessionPlaylistId,
  type WordCard,
  type Playlist,
  type WordStatus,
} from '@/stores/cards-store';
import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';
import {
  collectCategoriesFromCards,
  filterWordCards,
  type WordSortKind,
  type WordStatusFilter,
} from '@/lib/word-list-filters';
import { supabase } from '@/lib/supabase';

const SAMPLE_IMAGE = require('@/assets/images/icon.png');

function mapRowToWordCard(row: {
  id: string;
  word: string;
  category: string;
  image_uri?: string | null;
  status?: string | null;
}): WordCard {
  return {
    id: String(row.id),
    word: row.word ?? '',
    category: row.category ?? '기타',
    image: row.image_uri ?? SAMPLE_IMAGE,
    status: row.status === 'says' ? 'says' : 'knows',
  };
}

type FilterCategory = string;

export default function ManagePlaylistsScreen() {
  const router = useRouter();
  const { activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [cards, setCards] = useState<WordCard[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(getPlaylists());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('');
  const [statusFilter, setStatusFilter] = useState<WordStatusFilter>('');
  const [sortBy, setSortBy] = useState<WordSortKind>('recent');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlistName, setPlaylistName] = useState('');
  const [showPlaylistList, setShowPlaylistList] = useState(false);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribe(() => setPlaylists(getPlaylists()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeBaby?.id) {
      setCards([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('words').select('*').eq('baby_id', activeBaby.id);
      if (cancelled) return;
      if (error) {
        console.warn('단어 목록 로드 실패:', error.message);
        setCards([]);
      } else {
        setCards((data ?? []).map(mapRowToWordCard));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeBaby?.id]);

  const categories = useMemo(() => collectCategoriesFromCards(cards), [cards]);

  const filteredAndSortedCards = useMemo(
    () =>
      filterWordCards(cards, {
        searchQuery,
        categoryFilter,
        statusFilter,
        sortBy,
      }),
    [cards, searchQuery, categoryFilter, statusFilter, sortBy],
  );

  const listMetaText = useMemo(() => {
    if (loading) return '불러오는 중…';
    if (cards.length === 0) return '등록된 단어 없음';
    if (filteredAndSortedCards.length === cards.length) return `단어 ${cards.length}개`;
    return `${filteredAndSortedCards.length}개 · 전체 ${cards.length}개`;
  }, [loading, cards.length, filteredAndSortedCards.length]);

  const selectAllChecked = filteredAndSortedCards.length > 0 && filteredAndSortedCards.every((c) => selectedIds.has(c.id));
  const selectAllIndeterminate = filteredAndSortedCards.some((c) => selectedIds.has(c.id)) && !selectAllChecked;

  const toggleSelectAll = useCallback(() => {
    if (selectAllChecked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredAndSortedCards.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredAndSortedCards.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }, [filteredAndSortedCards, selectAllChecked]);

  const toggleCard = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSavePlaylist = useCallback(() => {
    const name = playlistName.trim();
    if (!name) return;
    const wordIds = Array.from(selectedIds);
    if (wordIds.length === 0) return;
    addPlaylist({ name, wordIds });
    setPlaylistName('');
    setSelectedIds(new Set());
    Alert.alert('저장 완료 🎉', `'${name}' 단어장이 성공적으로 만들어졌어요!`);
  }, [playlistName, selectedIds]);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '단어장 만들기',
          headerBackTitle: '우아카드',
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: { fontFamily: Fonts.rounded, fontSize: 18, color: PastelColors.text },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: PastelColors.background }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <View style={styles.screenBody}>
            <View style={styles.mainColumn}>
              <Pressable
                style={({ pressed }) => [styles.togglePlaylistList, pressed && styles.togglePressed]}
                onPress={() => setShowPlaylistList((v) => !v)}
              >
                <Text style={styles.togglePlaylistListText}>
                  {showPlaylistList ? '단어 선택으로' : '내 단어장 목록'}
                </Text>
              </Pressable>

              {showPlaylistList ? (
                <View style={styles.playlistListSection}>
                  <Text style={styles.sectionTitle}>내가 만든 단어장</Text>
                  {playlists.length === 0 ? (
                    <Text style={styles.emptyHint}>아직 저장한 단어장이 없어요.</Text>
                  ) : (
                    <ScrollView style={styles.playlistScroll} showsVerticalScrollIndicator={false}>
                  {playlists.map((pl) => {
                    const playlistCards = pl.wordIds
                      .map((id) => cards.find((c) => c.id === id))
                      .filter((c): c is WordCard => !!c);
                    const wordsInPlaylist = pl.wordIds
                      .map((id) => cards.find((c) => c.id === id)?.word)
                      .filter((w): w is string => !!w);
                    const isExpanded = expandedPlaylistId === pl.id;
                    return (
                      <View key={pl.id} style={styles.playlistRowWrap}>
                        <View style={styles.playlistRow}>
                          <View style={styles.playlistRowLeft}>
                            <Text style={styles.playlistName}>{pl.name}</Text>
                            <Text style={styles.playlistMeta}>단어 {pl.wordIds.length}개</Text>
                          </View>
                          <View style={styles.playlistRowActions}>
                            <Pressable
                              style={({ pressed }) => [styles.playlistActionBtn, styles.playlistWordsBtn, pressed && styles.playlistActionBtnPressed]}
                              onPress={() => setExpandedPlaylistId((id) => (id === pl.id ? null : pl.id))}
                            >
                              <Text style={styles.playlistWordsBtnText}>👀 단어 확인</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.playlistActionBtn, styles.playlistPlayBtn, pressed && styles.playlistActionBtnPressed]}
                              onPress={() => {
                                setPlaySessionCards(null);
                                setPlaySessionPlaylistId(pl.id);
                                router.push('/play-cards');
                              }}
                            >
                              <Text style={styles.playlistPlayBtnText}>▶ 놀이 시작</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [styles.playlistActionBtn, styles.playlistDeleteBtn, pressed && styles.playlistActionBtnPressed]}
                              onPress={() => {
                                Alert.alert('단어장 삭제', `'${pl.name}' 단어장을 삭제할까요?`, [
                                  { text: '취소', style: 'cancel' },
                                  { text: '삭제', style: 'destructive', onPress: () => { removePlaylist(pl.id); setPlaylists(getPlaylists()); } },
                                ]);
                              }}
                            >
                              <Text style={styles.playlistDeleteBtnText}>삭제</Text>
                            </Pressable>
                          </View>
                        </View>
                        {isExpanded && (
                          <View style={styles.playlistWordsExpand}>
                            <View style={styles.playlistWordsChipRow}>
                              {wordsInPlaylist.length === 0 ? (
                                <Text style={styles.playlistWordsEmpty}>등록된 단어가 없어요.</Text>
                              ) : (
                                wordsInPlaylist.map((word, i) => (
                                  <View key={`${pl.id}-${word}-${i}`} style={styles.playlistWordChip}>
                                    <Text style={styles.playlistWordChipText}>{word}</Text>
                                  </View>
                                ))
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                    </ScrollView>
                  )}
                </View>
              ) : (
                <View style={styles.wordListContent}>
                  <WordListToolbar
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    categories={categories}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    metaText={listMetaText}
                  />

              <View style={styles.listSection}>
                <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
                  <Checkbox
                    style={styles.selectAllCheckbox}
                    value={selectAllChecked}
                    onValueChange={toggleSelectAll}
                    color={PastelColors.segmentHighlight}
                  />
                  <Text style={styles.selectAllText}>☑️ 전체 선택</Text>
                  {selectAllIndeterminate && (
                    <Text style={styles.selectAllHint}>(일부 선택됨)</Text>
                  )}
                </Pressable>
                <ScrollView
                  style={styles.cardScroll}
                  contentContainerStyle={styles.cardScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {loading ? (
                    <View style={styles.emptyCards}>
                      <ActivityIndicator size="large" color={PastelColors.segmentHighlight} />
                      <Text style={[styles.emptyCardsText, { marginTop: 12 }]}>단어 목록 불러오는 중...</Text>
                    </View>
                  ) : filteredAndSortedCards.length === 0 ? (
                    <View style={styles.emptyCards}>
                      <Text style={styles.emptyCardsText}>
                        {cards.length === 0 ? '우아카드 관리에서 단어를 먼저 추가해 주세요.' : '검색/필터 결과가 없어요.'}
                      </Text>
                    </View>
                  ) : (
                    filteredAndSortedCards.map((card, index) => (
                      <View key={card.id} style={styles.cardRow}>
                        <View style={styles.cardThumb}>
                          {typeof card.image === 'string' ? (
                            <Image source={{ uri: card.image }} style={styles.cardThumbImg} resizeMode="cover" />
                          ) : (
                            <Image source={card.image} style={styles.cardThumbImg} resizeMode="cover" />
                          )}
                        </View>
                        <View style={styles.cardInfo}>
                          <View style={styles.cardCategoryRow}>
                            <Text style={styles.cardCategory}>{card.category}</Text>
                            <View style={[styles.cardStatusBadge, (card.status ?? 'knows') === 'says' ? styles.cardStatusBadgeSays : styles.cardStatusBadgeKnows]}>
                              <Text style={styles.cardStatusBadgeText}>
                                {(card.status ?? 'knows') === 'says' ? '🗣️ 말하는 단어' : '👀 아는 단어'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.cardWord} numberOfLines={1}>{card.word}</Text>
                        </View>
                        <Checkbox
                          value={selectedIds.has(card.id)}
                          onValueChange={() => toggleCard(card.id)}
                          color={PastelColors.segmentHighlight}
                          style={styles.cardCheckbox}
                        />
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
                </View>
              )}
            </View>

            {!showPlaylistList && (
              <View style={styles.floatingForm}>
                <View style={styles.floatingFormTop}>
                  <Text style={styles.selectedCountLabel}>
                    선택된 단어 {selectedIds.size}개
                  </Text>
                </View>
                <View style={styles.floatingFormRow}>
                  <TextInput
                    style={styles.playlistNameInput}
                    placeholder="단어장 이름"
                    placeholderTextColor={PastelColors.textSecondary}
                    value={playlistName}
                    onChangeText={setPlaylistName}
                    returnKeyType="done"
                    onSubmitEditing={handleSavePlaylist}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.saveButton,
                      (selectedIds.size === 0 || !playlistName.trim()) && styles.saveButtonDisabled,
                      pressed && styles.saveButtonPressed,
                    ]}
                    onPress={handleSavePlaylist}
                    disabled={selectedIds.size === 0 || !playlistName.trim()}
                  >
                    <Text style={styles.saveButtonText}>저장하기</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  mainColumn: {
    flex: 1,
    minHeight: 0,
  },
  togglePlaylistList: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    alignItems: 'center',
  },
  togglePressed: {
    opacity: 0.9,
  },
  togglePlaylistListText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playlistListSection: {
    flex: 1,
    minHeight: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 14,
  },
  emptyHint: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  playlistScroll: {
    flex: 1,
  },
  playlistRowWrap: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  playlistRowLeft: {
    flex: 1,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playlistMeta: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginTop: 4,
  },
  playlistRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playlistActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  playlistActionBtnPressed: {
    opacity: 0.88,
  },
  playlistPlayBtn: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  playlistPlayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  playlistDeleteBtn: {
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  playlistDeleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  playlistWordsBtn: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  playlistWordsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  playlistWordsExpand: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 0,
  },
  playlistWordsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  playlistWordChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: PastelColors.primaryLight,
  },
  playlistWordChipText: {
    fontSize: 12,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playlistWordsEmpty: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  wordListContent: {
    flex: 1,
    minHeight: 0,
  },
  listSection: {
    flex: 1,
    minHeight: 0,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  selectAllCheckbox: {
    marginRight: 10,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  selectAllHint: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginLeft: 6,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    paddingBottom: 12,
    gap: 8,
  },
  emptyCards: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCardsText: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  cardThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: PastelColors.border,
  },
  cardThumbImg: {
    width: 44,
    height: 44,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  cardStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardStatusBadgeKnows: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cardStatusBadgeSays: {
    backgroundColor: 'rgba(177, 156, 217, 0.18)',
  },
  cardStatusBadgeText: {
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  cardWord: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  cardCheckbox: {
    marginLeft: 10,
  },
  floatingForm: {
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: PastelColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PastelColors.border,
  },
  floatingFormTop: {
    marginBottom: 8,
  },
  selectedCountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  floatingFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playlistNameInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: PastelColors.cardBg,
    borderWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    ...flashcardShadow,
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
  },
  saveButtonDisabled: {
    backgroundColor: PastelColors.primaryLight,
    opacity: 0.85,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
