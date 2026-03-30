import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  Animated,
  ActivityIndicator,
  PanResponder,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** 영유아 타겟: 카드 이미지가 화면 폭의 90%를 차지 */
const CARD_SIZE = Math.floor(SCREEN_WIDTH * 0.9);
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { addInboxItem, type InboxRecordingItem } from '@/stores/inbox-store';
import {
  getPlaySessionCards,
  getPlaySessionPlaylistId,
  getPlaylists,
  setPlaySessionCards,
  setPlaySessionPlaylistId,
  type WordCard,
} from '@/stores/cards-store';
import { supabase } from '@/lib/supabase';

const SWIPE_DOWN_THRESHOLD = 80;
const TUTORIAL_DONE_KEY = 'playCardsTutorialDone';

/** 고음질 녹음 (HIGH_QUALITY: Android AAC, iOS MAX 품질 기반) */
const RECORDING_OPTIONS_HIGH = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    bitRate: 256000,
  },
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    bitRate: 256000,
  },
};

type PlayCard = {
  id: string;
  word: string;
  image: number | string;
};

const SAMPLE_IMAGE = require('@/assets/images/icon.png');

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function wordCardsToPlayCards(wcs: WordCard[]): PlayCard[] {
  return wcs.map((c) => ({ id: c.id, word: c.word, image: c.image }));
}

function mapRowToWordCard(row: { id: string; word: string; category: string; image_uri?: string | null }): WordCard {
  return {
    id: String(row.id),
    word: row.word ?? '',
    category: row.category ?? '기타',
    image: row.image_uri ?? SAMPLE_IMAGE,
  };
}

export default function PlayCardsScreen() {
  const router = useRouter();
  const { activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cards, setCards] = useState<PlayCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialReady, setTutorialReady] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  /** 저장된 '다시 보지 않기' 여부에 따라 튜토리얼 표시 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(TUTORIAL_DONE_KEY);
        if (cancelled) return;
        if (done === '1') setShowTutorial(false);
      } catch (_) {}
      if (!cancelled) setTutorialReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /** 단어장 / 세션 카드 / 전체 단어 로드 — activeBaby.id(baby_id) 기준으로만 조회 */
  useEffect(() => {
    const babyId = activeBaby?.id;
    if (!babyId) {
      setCards([]);
      setCardsLoading(false);
      return;
    }
    let cancelled = false;
    const playlistId = getPlaySessionPlaylistId();
    const session = getPlaySessionCards();

    const applyCards = (wordCardList: WordCard[]) => {
      if (cancelled) return;
      const playCards = wordCardsToPlayCards(shuffle(wordCardList));
      setCards(playCards);
      setCardsLoading(false);
    };

    if (playlistId) {
      const playlists = getPlaylists();
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist || playlist.wordIds.length === 0) {
        setCards([]);
        setCardsLoading(false);
        setPlaySessionPlaylistId(null);
        return () => { cancelled = true; };
      }
      const wordIdSet = new Set(playlist.wordIds.map((id) => String(id)));
      (async () => {
        const { data, error } = await supabase.from('words').select('*').eq('baby_id', babyId);
        if (cancelled) return;
        setPlaySessionPlaylistId(null);
        if (error) {
          setCards([]);
          setCardsLoading(false);
          return;
        }
        const allRows = data ?? [];
        const list = allRows
          .filter((row) => wordIdSet.has(String(row.id)))
          .map(mapRowToWordCard);
        applyCards(list);
      })();
      return () => { cancelled = true; };
    }

    if (session && session.length > 0) {
      setPlaySessionCards(null);
      applyCards(session);
      return () => { cancelled = true; };
    }

    setPlaySessionCards(null);
    (async () => {
      const { data, error } = await supabase.from('words').select('*').eq('baby_id', babyId);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setCards([]);
        setCardsLoading(false);
        return;
      }
      const list = (data as { id: string; word: string; category: string; image_uri?: string | null }[]).map(mapRowToWordCard);
      applyCards(list);
    })();
    return () => { cancelled = true; };
  }, [activeBaby?.id]);
  /** 카드 배열이 바뀌었을 때 currentIndex가 범위를 벗어나면 보정 — 마지막 카드까지 전부 플레이 가능하도록 */
  useEffect(() => {
    if (cards.length === 0) return;
    setCurrentIndex((i) => {
      if (i >= cards.length) return Math.max(0, cards.length - 1);
      if (i < 0) return 0;
      return i;
    });
  }, [cards.length]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingCardRef = useRef<PlayCard | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const currentCard = cards[currentIndex];

  /** 마이크 권한 요청 및 오디오 모드 설정 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await Audio.requestPermissionsAsync();
        if (cancelled) return;
        const granted = res.granted ?? res.status === 'granted';
        setPermissionGranted(granted);
        if (!granted) return;
        // 외부 스피커 강제 출력 + 고성능 녹음 모드 (수화기 미사용)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        if (!cancelled) setPermissionGranted(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** 카드가 바뀌면 녹음 시작 (고음질 프리셋) */
  const startRecording = useCallback(async () => {
    if (!permissionGranted || !currentCard) return;
    try {
      const { recording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS_HIGH,
        null,
        250
      );
      recordingRef.current = recording;
      recordingCardRef.current = currentCard;
      setIsRecording(true);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.9, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } catch (e) {
      console.warn('녹음 시작 실패', e);
      setIsRecording(false);
    }
  }, [permissionGranted, currentCard, pulseAnim]);

  /** 녹음 중지 후 음성 파일 저장 및 인박스에 추가. 오디오 모드 재적용으로 스피커 출력 유지 */
  const stopRecordingAndSave = useCallback(async (card: PlayCard): Promise<string | null> => {
    const rec = recordingRef.current;
    if (!rec) return null;
    try {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      await rec.stopAndUnloadAsync();
      recordingRef.current = null;
      recordingCardRef.current = null;
      setIsRecording(false);
      const uri = rec.getURI();
      if (uri) {
        const item: InboxRecordingItem = {
          id: `inbox-${Date.now()}`,
          uri,
          cardId: card.id,
          word: card.word,
          createdAt: Date.now(),
        };
        addInboxItem(item);
      }
      // 녹음 중지 후 오디오 세션 정리, 외부 스피커 모드 유지 (재생 시 풀리지 않도록)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      return uri ?? null;
    } catch (e) {
      console.warn('녹음 중지/저장 실패', e);
      recordingRef.current = null;
      recordingCardRef.current = null;
      setIsRecording(false);
    }
    return null;
  }, [pulseAnim]);

  /** 현재 카드 녹음 중지 후 인덱스 변경, 다음 카드 녹음 시작 */
  const goNext = useCallback(async () => {
    if (!currentCard || cards.length === 0) return;
    await stopRecordingAndSave(currentCard);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      // 다음 카드 표시 후 녹음 시작은 useEffect에서
    }
  }, [currentCard, currentIndex, cards.length, stopRecordingAndSave]);

  const goPrev = useCallback(async () => {
    if (!currentCard || cards.length === 0) return;
    await stopRecordingAndSave(currentCard);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentCard, currentIndex, stopRecordingAndSave]);

  /** 놀이 종료: 녹음 저장 후 우아기록(record-inbox)으로 이동 */
  const exitPlay = useCallback(async () => {
    if (currentCard) await stopRecordingAndSave(currentCard);
    router.replace('/record-inbox');
  }, [currentCard, stopRecordingAndSave, router]);

  const exitPlayRef = useRef(exitPlay);
  exitPlayRef.current = exitPlay;

  /** 스와이프 다운 제스처: 세로 이동만 감지해 종료 */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dy } = gestureState;
        return dy > 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_DOWN_THRESHOLD) exitPlayRef.current?.();
      },
    })
  ).current;

  /** 튜토리얼 닫고 첫 카드 녹음 시작. '다시 보지 않기' 체크 시 저장 */
  const dismissTutorialAndStart = useCallback(async () => {
    if (dontShowAgain) {
      try {
        await AsyncStorage.setItem(TUTORIAL_DONE_KEY, '1');
      } catch (_) {}
    }
    setShowTutorial(false);
    if (permissionGranted && currentCard) {
      setTimeout(() => startRecording(), 150);
    }
  }, [dontShowAgain, permissionGranted, currentCard, startRecording]);

  /** 카드 인덱스가 정해졌을 때(또는 권한 허용 시) 해당 카드 녹음 시작 — 튜토리얼이 닫혀 있을 때만 */
  useEffect(() => {
    if (showTutorial || !permissionGranted || !currentCard) return;
    const t = setTimeout(() => startRecording(), 100);
    return () => clearTimeout(t);
  }, [showTutorial, permissionGranted, currentIndex, currentCard?.id, startRecording]);

  /** 화면 이탈 시 녹음 중지 후 인박스에 저장 */
  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      const card = recordingCardRef.current;
      if (!rec || !card) return;
      pulseLoopRef.current?.stop();
      rec.stopAndUnloadAsync().then(() => {
        const uri = rec.getURI();
        if (uri) {
          addInboxItem({
            id: `inbox-${Date.now()}`,
            uri,
            cardId: card.id,
            word: card.word,
            createdAt: Date.now(),
          });
        }
      }).catch(() => {});
    };
  }, []);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '우아놀이',
          headerBackTitle: '메인',
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: {
            fontFamily: Fonts.rounded,
            fontSize: 18,
            color: PastelColors.text,
          },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {permissionGranted === false && (
          <View style={styles.permissionBlock}>
            <Text style={styles.permissionText}>
              마이크 권한이 필요해요. 설정에서 녹음 권한을 허용해 주세요.
            </Text>
          </View>
        )}

        {permissionGranted === true && cardsLoading && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={PastelColors.accent} />
            <Text style={[styles.emptyText, { marginTop: 16 }]}>카드 불러오는 중...</Text>
          </View>
        )}

        {permissionGranted === true && !cardsLoading && cards.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>재생할 카드가 없어요.</Text>
            <Text style={styles.emptySub}>우아카드 관리에서 단어 카드를 추가해 보세요!</Text>
          </View>
        )}

        {permissionGranted === true && !cardsLoading && currentCard && (
          <View style={styles.mainWrap} {...panResponder.panHandlers}>
            {/* 녹음 중 표시 */}
            <View style={styles.recordBadge}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.recordLabel}>녹음 중</Text>
            </View>

            {/* 중앙 커다란 단어 카드 — 파스텔 톤, 이미지 극대화(영유아 타겟) */}
            <View style={styles.cardWrap}>
              <View style={styles.cardInner}>
                <Image
                  source={typeof currentCard.image === 'string' ? { uri: currentCard.image } : currentCard.image}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
                {/* 단어 텍스트 제거 — 시선이 그림/사진에만 집중되도록 */}
              </View>
            </View>

            {/* 투명 제스처 영역: 좌 50% 이전, 우 50% 다음/저장 */}
            <View style={styles.gestureRow}>
              <Pressable
                style={styles.gestureHalf}
                onPress={goPrev}
                disabled={currentIndex === 0}
              />
              <Pressable
                style={styles.gestureHalf}
                onPress={goNext}
                disabled={currentIndex >= cards.length - 1}
              />
            </View>

            <Text style={styles.pageHint}>
              {currentIndex + 1} / {cards.length}
            </Text>
          </View>
        )}

        {/* 튜토리얼 코치마크 오버레이 — 저장된 '다시 보지 않기'면 표시 안 함 */}
        {permissionGranted === true && !cardsLoading && currentCard && showTutorial && tutorialReady && (
          <View style={styles.tutorialOverlay}>
            <Pressable style={styles.tutorialBackdrop} onPress={() => {}} />
            <Text style={styles.tutorialAutoRecord}>
              카드가 뜨면 자동으로 녹음이 시작되고, 다음 카드로 넘어가면 해당 카드 녹음이 자동으로 종료돼요.
            </Text>
            <View style={styles.tutorialHintLeft}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>좌측 탭</Text>
              <Text style={styles.tutorialDesc}>이전 카드로</Text>
            </View>
            <View style={styles.tutorialHintRight}>
              <Ionicons name="chevron-forward" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>우측 탭</Text>
              <Text style={styles.tutorialDesc}>다음 카드 · 녹음 저장</Text>
            </View>
            <View style={styles.tutorialHintBottom}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>아래로 스와이프</Text>
              <Text style={styles.tutorialDesc}>놀이 종료 후 우아기록 보기</Text>
            </View>
            <View style={styles.tutorialFooter}>
              <Pressable
                style={styles.tutorialCheckRow}
                onPress={() => setDontShowAgain((v) => !v)}
              >
                <View style={[styles.tutorialCheckbox, dontShowAgain && styles.tutorialCheckboxChecked]}>
                  {dontShowAgain && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.tutorialCheckLabel}>다시 보지 않기</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.tutorialButton, pressed && styles.tutorialButtonPressed]}
                onPress={dismissTutorialAndStart}
              >
                <Text style={styles.tutorialButtonText}>확인했어요</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const CARD_RADIUS = 32;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  permissionBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    color: PastelColors.textSecondary,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  mainWrap: {
    flex: 1,
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PastelColors.recordDot,
  },
  recordLabel: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Math.floor(SCREEN_WIDTH * 0.05),
  },
  cardInner: {
    width: CARD_SIZE,
    aspectRatio: 1,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...flashcardShadow,
    elevation: 4,
    shadowRadius: 14,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: CARD_RADIUS - 4,
    backgroundColor: PastelColors.border,
  },
  gestureRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  gestureHalf: {
    flex: 1,
  },
  pageHint: {
    textAlign: 'center',
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    paddingBottom: 16,
  },
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  tutorialAutoRecord: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  tutorialHintLeft: {
    position: 'absolute',
    left: 20,
    top: '28%',
    alignItems: 'center',
    gap: 6,
  },
  tutorialHintRight: {
    position: 'absolute',
    right: 20,
    top: '28%',
    alignItems: 'center',
    gap: 6,
  },
  tutorialHintBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
    gap: 6,
  },
  tutorialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  tutorialDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: Fonts.rounded,
  },
  tutorialFooter: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  tutorialCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tutorialCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialCheckboxChecked: {
    backgroundColor: PastelColors.accent,
    borderColor: PastelColors.accent,
  },
  tutorialCheckLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontFamily: Fonts.rounded,
  },
  tutorialButton: {
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
  },
  tutorialButtonPressed: {
    opacity: 0.9,
  },
  tutorialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
