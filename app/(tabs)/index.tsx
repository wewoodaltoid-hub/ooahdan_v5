import { ViewerModeBanner } from '@/components/viewer-mode-banner';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Modal,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { alertMasterOnlyFeature } from '@/lib/master-only-alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { getPlaylists, setPlaySessionCards, setPlaySessionPlaylistId, type Playlist } from '@/stores/cards-store';

const DEFAULT_AVATAR = require('@/assets/images/icon.png');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const TODAY_WORD_COUNT = 0;

type PlayMode = 'all' | 'playlist';

export default function HomeScreen() {
  const router = useRouter();
  const { babies, activeBaby, setActiveBaby, updateRelationName, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [playSetupVisible, setPlaySetupVisible] = useState(false);
  /** 놀이 시작 시 라우트: 음성 play-cards / 영상 play-cards-video */
  const [playTargetRoute, setPlayTargetRoute] = useState<'/play-cards' | '/play-cards-video'>('/play-cards');
  const [relationModalVisible, setRelationModalVisible] = useState(false);
  const [relationDraft, setRelationDraft] = useState('');
  const [relationSaving, setRelationSaving] = useState(false);
  const [babyMenuVisible, setBabyMenuVisible] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(getPlaylists());
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const menuSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    setPlaylists(getPlaylists());
  }, [playSetupVisible]);

  useEffect(() => {
    if (playSetupVisible) {
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      setPlayMode('all');
      setSelectedPlaylistId(null);
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [playSetupVisible, slideAnim]);

  const handleClosePlaySetup = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setPlaySetupVisible(false));
  }, [slideAnim]);

  /** Modal은 RN 최상위에 그려져 다른 화면 터치를 막으므로, 이동 전에 반드시 즉시 닫음 */
  const dismissPlaySetupImmediate = useCallback(() => {
    slideAnim.setValue(SCREEN_HEIGHT);
    setPlaySetupVisible(false);
  }, [slideAnim]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        slideAnim.setValue(SCREEN_HEIGHT);
        setPlaySetupVisible(false);
      };
    }, [slideAnim])
  );

  const handleStartPlay = useCallback(() => {
    if (playMode === 'all') {
      setPlaySessionCards(null);
      dismissPlaySetupImmediate();
      router.push(playTargetRoute);
      return;
    }
    if (playMode === 'playlist' && selectedPlaylistId) {
      setPlaySessionCards(null);
      setPlaySessionPlaylistId(selectedPlaylistId);
      dismissPlaySetupImmediate();
      router.push(playTargetRoute);
    }
  }, [playMode, selectedPlaylistId, dismissPlaySetupImmediate, router, playTargetRoute]);

  const canStart = playMode === 'all' || (playMode === 'playlist' && selectedPlaylistId);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    if (!babyMenuVisible) {
      Animated.timing(menuSlideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start();
    } else {
      menuSlideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(menuSlideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [babyMenuVisible, menuSlideAnim]);

  const openRelationEditor = useCallback(() => {
    setRelationDraft(activeBaby?.relation_name?.trim() ?? '');
    setRelationModalVisible(true);
  }, [activeBaby?.id, activeBaby?.relation_name]);

  const submitRelationName = useCallback(async () => {
    setRelationSaving(true);
    try {
      const { ok, error } = await updateRelationName(relationDraft);
      if (!ok) {
        Alert.alert('저장 실패', error ?? '호칭을 저장하지 못했어요.');
        return;
      }
      setRelationModalVisible(false);
    } finally {
      setRelationSaving(false);
    }
  }, [relationDraft, updateRelationName]);

  if (babiesLoaded && babies.length === 0) {
    return <Redirect href="/baby-onboarding" />;
  }

  if (babiesLoading || !activeBaby) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.headerRow, styles.headerLoading]}>
          <View style={styles.headerSpacer} />
          <ActivityIndicator size="small" color={PastelColors.accent} />
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={PastelColors.accent} />
          <Text style={styles.loadingText}>아이 목록 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const childName = activeBaby.name || '우리 아이';
  const relationLabel = activeBaby.relation_name?.trim() || '가족';
  const isAdmin = isBabyAdmin(activeBaby);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [styles.babySelector, pressed && styles.buttonPressed]}
          onPress={() => setBabyMenuVisible(true)}
        >
          <Image
            source={activeBaby.profile_image_url ? { uri: activeBaby.profile_image_url } : DEFAULT_AVATAR}
            style={styles.babyAvatar}
          />
          <Text style={styles.babyNameText} numberOfLines={1}>{childName} ▾</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
          onPress={handleSignOut}
          hitSlop={12}
        >
          <MaterialIcons name="logout" size={22} color={PastelColors.accent} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isAdmin && <ViewerModeBanner />}
        {/* 대시보드 카드 */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.greetingTouchable}
            onPress={openRelationEditor}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel="아이와의 호칭 바꾸기"
          >
            <Text style={styles.greeting}>
              안녕하세요, {childName} {relationLabel}님! ✏️
            </Text>
          </TouchableOpacity>
          <Text style={styles.wordCount}>오늘 기록한 단어: {TODAY_WORD_COUNT}개</Text>
        </View>

        {/* 메인 메뉴 그리드 */}
        <View style={styles.menuGrid}>
          <Pressable
            style={({ pressed }) => [
              styles.menuCard,
              styles.menuGridCell,
              !isAdmin && styles.menuCardLocked,
              pressed && styles.menuCardPressed,
            ]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              router.push('/manage-cards');
            }}
          >
            <MaterialIcons name="layers" size={40} color={!isAdmin ? PastelColors.textSecondary : PastelColors.primary} />
            <Text style={[styles.menuCardLabel, !isAdmin && styles.menuCardLabelLocked]}>우아카드 관리</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuCard,
              styles.menuGridCell,
              !isAdmin && styles.menuCardLocked,
              pressed && styles.menuCardPressed,
            ]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              router.push('/record-inbox');
            }}
          >
            <MaterialIcons name="description" size={40} color={!isAdmin ? PastelColors.textSecondary : PastelColors.primary} />
            <Text style={[styles.menuCardLabel, !isAdmin && styles.menuCardLabelLocked]}>우아기록</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuCard,
              styles.menuGridCell,
              !isAdmin && styles.menuCardLocked,
              pressed && isAdmin && styles.menuCardPressed,
            ]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              setPlayTargetRoute('/play-cards');
              setPlaySetupVisible(true);
            }}
          >
            <MaterialIcons name="mic" size={40} color={!isAdmin ? PastelColors.textSecondary : PastelColors.primary} />
            <Text style={[styles.menuCardLabel, !isAdmin && styles.menuCardLabelLocked]}>우아놀이{'\n'}(음성)</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuCard,
              styles.menuGridCell,
              !isAdmin && styles.menuCardLocked,
              pressed && isAdmin && styles.menuCardPressed,
            ]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              setPlayTargetRoute('/play-cards-video');
              setPlaySetupVisible(true);
            }}
          >
            <MaterialIcons name="videocam" size={40} color={!isAdmin ? PastelColors.textSecondary : PastelColors.primary} />
            <Text style={[styles.menuCardLabel, !isAdmin && styles.menuCardLabelLocked]}>우아놀이{'\n'}(영상)</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuCard, styles.menuCardFull, pressed && styles.menuCardPressed]}
            onPress={() => router.push('/archive')}
          >
            <MaterialIcons name="library-books" size={40} color={PastelColors.primary} />
            <Text style={styles.menuCardLabel}>우아 아카이브</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 놀이 설정 모달 (Bottom Sheet) */}
      <Modal visible={playSetupVisible} transparent animationType="none">
        <View style={styles.playModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClosePlaySetup} />
          <Animated.View
            style={[styles.playModalSheet, { transform: [{ translateY: slideAnim }] }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.playModalHandle} />
            <Text style={styles.playModalTitle}>놀이 설정</Text>

            {/* 옵션 A: 전체 단어 랜덤 */}
            <Pressable
              style={[
                styles.playOptionCard,
                playMode === 'all' && styles.playOptionCardActive,
              ]}
              onPress={() => { setPlayMode('all'); setSelectedPlaylistId(null); }}
            >
              <Text style={styles.playOptionIcon}>🎲</Text>
              <View style={styles.playOptionTextWrap}>
                <Text style={styles.playOptionLabel}>전체 단어 랜덤 학습</Text>
                <Text style={styles.playOptionSub}>모든 카드를 섞어서 진행해요</Text>
              </View>
            </Pressable>

            {/* 옵션 B: 내 단어장 선택 */}
            <Pressable
              style={[
                styles.playOptionCard,
                playMode === 'playlist' && styles.playOptionCardActive,
              ]}
              onPress={() => setPlayMode('playlist')}
            >
              <Text style={styles.playOptionIcon}>🗂️</Text>
              <View style={styles.playOptionTextWrap}>
                <Text style={styles.playOptionLabel}>내 단어장 선택 학습</Text>
                <Text style={styles.playOptionSub}>저장한 단어장 중 하나를 골라요</Text>
              </View>
            </Pressable>

            {/* 단어장 목록 (옵션 B일 때만) */}
            {playMode === 'playlist' && (
              <View style={styles.playlistListWrap}>
                <Text style={styles.playlistListTitle}>단어장 선택</Text>
                {playlists.length === 0 ? (
                  <Text style={styles.playlistEmpty}>저장된 단어장이 없어요. 단어장 만들기에서 먼저 만드세요!</Text>
                ) : (
                  <ScrollView style={styles.playlistScroll} showsVerticalScrollIndicator={false}>
                    {playlists.map((pl) => (
                      <Pressable
                        key={pl.id}
                        style={[
                          styles.playlistChip,
                          selectedPlaylistId === pl.id && styles.playlistChipActive,
                        ]}
                        onPress={() => setSelectedPlaylistId(pl.id)}
                      >
                        <Text style={[
                          styles.playlistChipText,
                          selectedPlaylistId === pl.id && styles.playlistChipTextActive,
                        ]}>
                          {pl.name} ({pl.wordIds.length}개)
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <Pressable
              style={[
                styles.playStartButton,
                !canStart && styles.playStartButtonDisabled,
              ]}
              onPress={handleStartPlay}
              disabled={!canStart}
            >
              <Text style={styles.playStartButtonText}>▶️ 놀이 시작하기</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* 아이 선택/메뉴 바텀시트 */}
      <Modal visible={babyMenuVisible} transparent animationType="none">
        <Pressable style={styles.menuBackdrop} onPress={() => setBabyMenuVisible(false)} />
        <Animated.View style={[styles.babyMenuSheet, { transform: [{ translateY: menuSlideAnim }] }]}>
          <View style={styles.playModalHandle} />
          <Text style={styles.playModalTitle}>아이 선택 및 관리</Text>
          {babies.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.babyMenuItem, activeBaby.id === b.id && styles.babyMenuItemActive]}
              onPress={() => {
                setActiveBaby(b);
                setBabyMenuVisible(false);
              }}
            >
              <Image source={b.profile_image_url ? { uri: b.profile_image_url } : DEFAULT_AVATAR} style={styles.babyMenuAvatar} />
              <Text style={styles.babyMenuItemText}>{b.name}</Text>
              {activeBaby.id === b.id && <MaterialIcons name="check" size={22} color={PastelColors.accent} />}
            </Pressable>
          ))}
          <View style={styles.menuDivider} />
          <Pressable
            style={[styles.babyMenuAction, !isAdmin && styles.babyMenuActionLocked]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              setBabyMenuVisible(false);
              router.push('/baby-edit');
            }}
          >
            <Text style={styles.babyMenuActionText}>⚙️ 아이 프로필 수정</Text>
          </Pressable>
          <Pressable
            style={[styles.babyMenuAction, !isAdmin && styles.babyMenuActionLocked]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              setBabyMenuVisible(false);
              router.push('/family-invite');
            }}
          >
            <Text style={styles.babyMenuActionText}>👨‍👩‍👧 가족 초대 및 관리</Text>
          </Pressable>
          <Pressable style={styles.babyMenuAction} onPress={() => { setBabyMenuVisible(false); router.push('/join-baby'); }}>
            <Text style={styles.babyMenuActionText}>🔗 초대 코드로 연결하기</Text>
          </Pressable>
          <Pressable
            style={[styles.babyMenuAction, !isAdmin && styles.babyMenuActionLocked]}
            onPress={() => {
              if (!isAdmin) {
                alertMasterOnlyFeature();
                return;
              }
              setBabyMenuVisible(false);
              router.push('/add-baby');
            }}
          >
            <Text style={styles.babyMenuActionText}>➕ 새 아이 등록하기</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      <Modal visible={relationModalVisible} transparent animationType="fade">
        <View style={styles.relationModalRoot}>
          <Pressable
            style={styles.relationModalBackdrop}
            onPress={() => {
              if (!relationSaving) setRelationModalVisible(false);
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.relationModalCenter}
          >
            <View style={styles.relationModalSheet}>
              <Text style={styles.relationModalTitle}>호칭 설정</Text>
              <Text style={styles.relationModalHint}>
                아이와의 호칭을 입력해주세요 (예: 엄마, 아빠, 할머니, 삼촌)
              </Text>
              <TextInput
                style={styles.relationModalInput}
                value={relationDraft}
                onChangeText={setRelationDraft}
                placeholder="비우면 「가족」으로 표시돼요"
                placeholderTextColor={PastelColors.textSecondary}
                maxLength={16}
                autoFocus
                editable={!relationSaving}
                returnKeyType="done"
                onSubmitEditing={submitRelationName}
              />
              <View style={styles.relationModalActions}>
                <Pressable
                  style={({ pressed }) => [styles.relationModalBtn, styles.relationModalBtnCancel, pressed && styles.buttonPressed]}
                  onPress={() => {
                    if (!relationSaving) setRelationModalVisible(false);
                  }}
                  disabled={relationSaving}
                >
                  <Text style={styles.relationModalBtnCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.relationModalBtn,
                    styles.relationModalBtnOk,
                    relationSaving && styles.relationModalBtnOkDisabled,
                    pressed && !relationSaving && styles.buttonPressed,
                  ]}
                  onPress={submitRelationName}
                  disabled={relationSaving}
                >
                  {relationSaving ? (
                    <ActivityIndicator size="small" color={PastelColors.buttonTextOnPrimary} />
                  ) : (
                    <Text style={styles.relationModalBtnOkText}>확인</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLoading: {
    justifyContent: 'center',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  babySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 180,
  },
  babyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PastelColors.cardBg,
  },
  babyNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  headerSpacer: {
    width: 36,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PastelColors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...flashcardShadow,
  },
  logoutButtonPressed: {
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
  },
  card: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 24,
    marginBottom: 12,
    ...flashcardShadow,
  },
  greetingTouchable: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 20,
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
  },
  relationModalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  relationModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  relationModalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  relationModalSheet: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 22,
    ...flashcardShadow,
  },
  relationModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
    textAlign: 'center',
  },
  relationModalHint: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    lineHeight: 20,
    marginBottom: 14,
  },
  relationModalInput: {
    borderWidth: 1,
    borderColor: PastelColors.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    backgroundColor: PastelColors.background,
    marginBottom: 18,
  },
  relationModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  relationModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  relationModalBtnCancel: {
    backgroundColor: PastelColors.backgroundMint,
  },
  relationModalBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  relationModalBtnOk: {
    backgroundColor: PastelColors.buttonPrimary,
    borderRadius: 14,
    ...primaryCtaPadding,
  },
  relationModalBtnOkDisabled: {
    opacity: 0.75,
  },
  relationModalBtnOkText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  wordCount: {
    fontSize: 16,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  menuGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuGridCell: {
    width: '48%',
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: PastelColors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 12,
    minHeight: 148,
    ...Platform.select({
      ios: {
        shadowColor: '#B19CD9',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  menuCardFull: {
    width: '100%',
    minHeight: 120,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  menuCardLocked: {
    backgroundColor: PastelColors.primaryLight,
    opacity: 0.95,
  },
  menuCardPressed: {
    opacity: 0.88,
  },
  menuCardLabel: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    lineHeight: 21,
  },
  menuCardLabelLocked: {
    color: PastelColors.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  // 놀이 설정 모달
  playModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  playModalSheet: {
    backgroundColor: PastelColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...Platform.select({
      ios: { shadowColor: '#B19CD9', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  playModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.textSecondary,
    opacity: 0.4,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  playModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    marginBottom: 20,
    textAlign: 'center',
  },
  playOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: PastelColors.primaryLight,
    marginBottom: 12,
    borderWidth: 0,
  },
  playOptionCardActive: {
    backgroundColor: PastelColors.primaryLight,
    borderWidth: 2,
    borderColor: PastelColors.accent,
  },
  playOptionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  playOptionTextWrap: {
    flex: 1,
  },
  playOptionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playOptionSub: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginTop: 4,
  },
  playlistListWrap: {
    marginTop: 8,
    marginBottom: 20,
    maxHeight: 200,
  },
  playlistListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
  },
  playlistEmpty: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  playlistScroll: {
    maxHeight: 160,
  },
  playlistChip: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: PastelColors.primaryLight,
    marginBottom: 10,
  },
  playlistChipActive: {
    backgroundColor: PastelColors.accent,
  },
  playlistChipText: {
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  playlistChipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
    fontWeight: '600',
  },
  playStartButton: {
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
  },
  playStartButtonDisabled: {
    backgroundColor: PastelColors.primaryLight,
    opacity: 0.85,
  },
  playStartButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  babyMenuSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PastelColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: PastelColors.border,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: SCREEN_HEIGHT * 0.7,
    ...Platform.select({
      ios: { shadowColor: '#B19CD9', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  babyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
    gap: 12,
  },
  babyMenuItemActive: {
    backgroundColor: PastelColors.backgroundMint,
  },
  babyMenuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PastelColors.cardBg,
  },
  babyMenuItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  menuDivider: {
    height: 1,
    backgroundColor: PastelColors.border,
    marginVertical: 16,
  },
  babyMenuAction: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  babyMenuActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  babyMenuActionLocked: {
    backgroundColor: PastelColors.primaryLight,
    opacity: 1,
  },
});
