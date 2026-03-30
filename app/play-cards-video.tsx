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
  Platform,
  Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = Math.floor(SCREEN_WIDTH * 0.9);
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';
import { addInboxItem } from '@/stores/inbox-store';
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
const TUTORIAL_DONE_KEY = 'playCardsVideoTutorialDone_v4';
/** 녹화 종료 프로미스 무한 대기 방지 (ms) */
const RECORDING_STOP_TIMEOUT_MS = 3000;

/** 파스텔 보라 테마 */
const VIDEO_PURPLE = '#B19CD9';
const VIDEO_BG = '#F3EEF8';

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

/** 캐시 등 임시 URI → 앱 문서 디렉터리에만 복사 (Supabase 업로드 없음) */
async function copyRecordingToAppDocuments(cacheUri: string): Promise<string | null> {
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  const dest = `${base}ooah_video_${Date.now()}.mp4`;
  try {
    await FileSystem.copyAsync({ from: cacheUri, to: dest });
    return dest;
  } catch (e) {
    console.warn('영상 로컬 저장 실패', e);
    return null;
  }
}

export default function PlayCardsVideoScreen() {
  const router = useRouter();
  const { activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [cards, setCards] = useState<PlayCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutorialReady, setTutorialReady] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** recordAsync가 살아 있는 동안만 true (가드·UI용, ref와 동기화) */
  const [isRecording, setIsRecording] = useState(false);
  /** 튜토리얼을 닫은 뒤(또는 이미 스킵으로 진입 시) 카메라/마이크 권한 요청 1회 */
  const [shouldRequestPermissionsAfterTutorial, setShouldRequestPermissionsAfterTutorial] =
    useState(false);

  const cameraRef = useRef<CameraView>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const recordingCardRef = useRef<PlayCard | null>(null);
  /** 클로저 없이 저장 가드에 사용 */
  const isRecordingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const permissionGranted =
    Platform.OS !== 'web' && (camPerm?.granted ?? false) && (micPerm?.granted ?? false);

  const canUseNativeCamera = Platform.OS !== 'web' && permissionGranted;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(TUTORIAL_DONE_KEY);
        if (cancelled) return;
        if (done === '1') {
          setShowTutorial(false);
          setShouldRequestPermissionsAfterTutorial(true);
        }
      } catch (_) {}
      if (!cancelled) setTutorialReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 튜토리얼 종료 후 또는 스킵 상태로 진입 시 — 이미 허용된 권한은 다시 요청하지 않음 */
  const requestCameraAndMicAfterTutorial = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      if (!camPerm?.granted) await requestCam();
      if (!micPerm?.granted) await requestMic();
    } catch (e) {
      console.warn('카메라/마이크 권한 요청 실패', e);
    }
  }, [requestCam, requestMic, camPerm?.granted, micPerm?.granted]);

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
        return () => {
          cancelled = true;
        };
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
      return () => {
        cancelled = true;
      };
    }

    if (session && session.length > 0) {
      setPlaySessionCards(null);
      applyCards(session);
      return () => {
        cancelled = true;
      };
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
      const list = (
        data as { id: string; word: string; category: string; image_uri?: string | null }[]
      ).map(mapRowToWordCard);
      applyCards(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBaby?.id]);

  useEffect(() => {
    if (cards.length === 0) return;
    setCurrentIndex((i) => {
      if (i >= cards.length) return Math.max(0, cards.length - 1);
      if (i < 0) return 0;
      return i;
    });
  }, [cards.length]);

  /** 튜토리얼이 닫힌 뒤(또는 스킵으로 첫 진입 시)에만 권한 요청 — 튜토리얼 중에는 호출하지 않음 */
  useEffect(() => {
    if (showTutorial) return;
    if (!tutorialReady) return;
    if (!shouldRequestPermissionsAfterTutorial) return;
    if (Platform.OS === 'web') {
      setShouldRequestPermissionsAfterTutorial(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await requestCameraAndMicAfterTutorial();
      } finally {
        if (!cancelled) setShouldRequestPermissionsAfterTutorial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    showTutorial,
    tutorialReady,
    shouldRequestPermissionsAfterTutorial,
    requestCameraAndMicAfterTutorial,
  ]);

  const currentCard = cards[currentIndex];

  const resetRecordingPulse = useCallback(() => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;
    Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }, [pulseAnim]);

  const startRecording = useCallback(async () => {
    if (
      !canUseNativeCamera ||
      !cameraReady ||
      !currentCard ||
      isSaving ||
      !cameraRef.current ||
      isRecordingRef.current
    )
      return;
    try {
      recordingCardRef.current = currentCard;
      recordingPromiseRef.current = cameraRef.current.recordAsync({
        maxDuration: 600,
      });
      isRecordingRef.current = true;
      setIsRecording(true);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.9, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } catch (e) {
      console.warn('영상 녹화 시작 실패', e);
      recordingPromiseRef.current = null;
      recordingCardRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [canUseNativeCamera, cameraReady, currentCard, isSaving, pulseAnim]);

  const stopRecordingAndSave = useCallback(
    async (card: PlayCard): Promise<string | null> => {
      const cam = cameraRef.current;
      if (!cam || !isRecordingRef.current || !recordingPromiseRef.current) {
        resetRecordingPulse();
        return null;
      }
      try {
        resetRecordingPulse();
        try {
          cam.stopRecording();
        } catch (stopErr) {
          console.warn('stopRecording 실패', stopErr);
          setCameraRetryKey((k) => k + 1);
        }
        const p = recordingPromiseRef.current;
        recordingPromiseRef.current = null;
        recordingCardRef.current = null;

        let result: { uri: string } | undefined;
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('timeout')),
              RECORDING_STOP_TIMEOUT_MS
            )
          );
          result = p ? await Promise.race([p, timeoutPromise]) : undefined;
        } catch (e) {
          console.warn('영상 녹화 종료/저장 실패', e);
          setCameraRetryKey((k) => k + 1);
          return null;
        }

        const cacheUri = result?.uri;
        if (cacheUri) {
          let localUri: string;
          try {
            localUri = (await copyRecordingToAppDocuments(cacheUri)) ?? cacheUri;
          } catch (copyErr) {
            console.warn('영상 파일 복사 실패', copyErr);
            localUri = cacheUri;
          }
          try {
            addInboxItem({
              id: `inbox-${Date.now()}`,
              uri: localUri,
              cardId: card.id,
              word: card.word,
              createdAt: Date.now(),
              mediaType: 'video',
            });
          } catch (inboxErr) {
            console.warn('인박스 추가 실패', inboxErr);
          }
        }
        return cacheUri ?? null;
      } finally {
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsSaving(false);
      }
    },
    [resetRecordingPulse]
  );

  const goNext = useCallback(async () => {
    if (!currentCard || cards.length === 0 || isSaving) return;
    if (currentIndex >= cards.length - 1) return;
    setIsSaving(true);
    try {
      await stopRecordingAndSave(currentCard);
      setCurrentIndex((i) => i + 1);
    } catch (e) {
      console.warn('다음 카드 저장 중 오류', e);
    } finally {
      setIsSaving(false);
    }
  }, [currentCard, currentIndex, cards.length, isSaving, stopRecordingAndSave]);

  const goPrev = useCallback(async () => {
    if (!currentCard || cards.length === 0 || isSaving) return;
    if (currentIndex <= 0) return;
    setIsSaving(true);
    try {
      await stopRecordingAndSave(currentCard);
      setCurrentIndex((i) => i - 1);
    } catch (e) {
      console.warn('이전 카드 저장 중 오류', e);
    } finally {
      setIsSaving(false);
    }
  }, [currentCard, currentIndex, isSaving, stopRecordingAndSave]);

  const exitPlay = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (currentCard) await stopRecordingAndSave(currentCard);
    } catch (e) {
      console.warn('종료 시 녹화 저장 중 오류', e);
    } finally {
      setIsSaving(false);
    }
    router.replace('/record-inbox');
  }, [currentCard, isSaving, stopRecordingAndSave, router]);

  const exitPlayRef = useRef(exitPlay);
  exitPlayRef.current = exitPlay;

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

  /**
   * '확인했어요': dontShowAgain === true 일 때만 AsyncStorage(TUTORIAL_DONE_KEY)에 저장.
   * 체크 해제(false)면 스토리지를 쓰지 않고 모달만 닫음.
   */
  const dismissTutorialAndStart = useCallback(async () => {
    if (dontShowAgain === true) {
      try {
        await AsyncStorage.setItem(TUTORIAL_DONE_KEY, '1');
      } catch (_) {
        /* 스토리지 실패 시에도 모달은 닫음 */
      }
    }
    setShowTutorial(false);
    setShouldRequestPermissionsAfterTutorial(true);
  }, [dontShowAgain]);

  /** 권한 허용 + CameraView onCameraReady 이후에만 recordAsync (단어 카드만으로는 시작하지 않음) */
  useEffect(() => {
    if (showTutorial || !canUseNativeCamera || !cameraReady || !currentCard || isSaving || isRecording)
      return;
    const t = setTimeout(() => void startRecording(), 100);
    return () => clearTimeout(t);
  }, [
    showTutorial,
    canUseNativeCamera,
    cameraReady,
    currentIndex,
    currentCard?.id,
    isSaving,
    isRecording,
    startRecording,
  ]);

  useEffect(() => {
    if (!canUseNativeCamera) {
      setCameraReady(false);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [canUseNativeCamera]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      setIsRecording(false);
      const p = recordingPromiseRef.current;
      const card = recordingCardRef.current;
      if (!p || !card || !cameraRef.current) return;
      pulseLoopRef.current?.stop();
      try {
        cameraRef.current.stopRecording();
      } catch (_) {}
      void p
        .then(async (result) => {
          const cacheUri = result?.uri;
          if (!cacheUri) return;
          try {
            const localUri = (await copyRecordingToAppDocuments(cacheUri)) ?? cacheUri;
            addInboxItem({
              id: `inbox-${Date.now()}`,
              uri: localUri,
              cardId: card.id,
              word: card.word,
              createdAt: Date.now(),
              mediaType: 'video',
            });
          } catch (e) {
            console.warn('언마운트 시 영상 복사 실패', e);
          }
        })
        .catch(() => {});
    };
  }, []);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  const permDenied = camPerm && !camPerm.granted && camPerm.canAskAgain === false;
  const micDenied = micPerm && !micPerm.granted && micPerm.canAskAgain === false;

  return (
    <>
      <Stack.Screen
        options={{
          title: '우아놀이 (영상)',
          headerBackTitle: '메인',
          headerStyle: { backgroundColor: VIDEO_BG },
          headerTitleStyle: {
            fontFamily: Fonts.rounded,
            fontSize: 18,
            color: '#4A3F5C',
          },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {!showTutorial && canUseNativeCamera && (
          <View pointerEvents="none" style={styles.hiddenCameraWrap} collapsable={false}>
            <CameraView
              key={cameraRetryKey}
              ref={cameraRef}
              pointerEvents="none"
              style={styles.hiddenCamera}
              facing="front"
              mode="video"
              videoQuality="720p"
              mute={false}
              onCameraReady={() => {
                setCameraReady(true);
                setCameraErrorMessage(null);
              }}
              onMountError={(e) => {
                const msg = e?.message ?? '카메라를 시작하지 못했어요.';
                console.warn('Camera mount error', msg);
                setCameraReady(false);
                isRecordingRef.current = false;
                setIsRecording(false);
                setCameraErrorMessage(msg);
              }}
            />
          </View>
        )}

        {cardsLoading && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={VIDEO_PURPLE} />
            <Text style={[styles.emptyText, { marginTop: 16 }]}>카드 불러오는 중...</Text>
          </View>
        )}

        {!cardsLoading && cards.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>재생할 카드가 없어요.</Text>
            <Text style={styles.emptySub}>우아카드 관리에서 단어 카드를 추가해 보세요!</Text>
          </View>
        )}

        {!cardsLoading && currentCard && (
          <View
            style={styles.mainWrap}
            pointerEvents={showTutorial && tutorialReady ? 'none' : 'auto'}
            {...(showTutorial && tutorialReady ? {} : panResponder.panHandlers)}
          >
            <View style={styles.recordBadge}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.recordLabel}>
                {canUseNativeCamera && cameraReady && isRecording ? '녹화 중' : '단어 카드'}
              </Text>
            </View>

            <View style={styles.cardWrap}>
              <View style={styles.cardInner}>
                <Image
                  source={typeof currentCard.image === 'string' ? { uri: currentCard.image } : currentCard.image}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {Platform.OS === 'web' && (
              <Text style={styles.webHint}>
                영상 녹화는 모바일 앱(iOS/Android)에서만 가능해요.
              </Text>
            )}

            {!canUseNativeCamera && Platform.OS !== 'web' && !permDenied && !micDenied && (
              <View style={styles.permissionInline}>
                <Text style={styles.permissionInlineText}>
                  카메라·마이크 권한을 허용하면 녹화가 시작돼요.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.permissionBtn, pressed && styles.tutorialButtonPressed]}
                  onPress={() => {
                    void requestCam();
                    void requestMic();
                  }}
                >
                  <Text style={styles.permissionBtnText}>권한 요청하기</Text>
                </Pressable>
              </View>
            )}

            {cameraErrorMessage && (
              <View style={styles.cameraErrorBox}>
                <Text style={styles.cameraErrorText}>{cameraErrorMessage}</Text>
                <Pressable
                  style={({ pressed }) => [styles.permissionBtn, pressed && styles.tutorialButtonPressed]}
                  onPress={() => {
                    setCameraErrorMessage(null);
                    setCameraReady(false);
                    isRecordingRef.current = false;
                    setIsRecording(false);
                    setCameraRetryKey((k) => k + 1);
                  }}
                >
                  <Text style={styles.permissionBtnText}>카메라 다시 시도</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.gestureRow}>
              <Pressable
                style={styles.gestureHalf}
                onPress={goPrev}
                disabled={currentIndex === 0 || isSaving}
              />
              <Pressable
                style={styles.gestureHalf}
                onPress={goNext}
                disabled={currentIndex >= cards.length - 1 || isSaving}
              />
            </View>

            <Text style={styles.pageHint}>
              {currentIndex + 1} / {cards.length}
            </Text>
          </View>
        )}

        {(permDenied || micDenied) && (
          <View style={styles.permissionBlock}>
            <Text style={styles.permissionText}>
              카메라·마이크 권한이 필요해요. 설정에서 권한을 허용해 주세요.
            </Text>
          </View>
        )}

        {isSaving && (
          <View style={styles.savingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={VIDEO_PURPLE} />
            <Text style={styles.savingText}>저장중...</Text>
          </View>
        )}
      </SafeAreaView>

      <Modal
        visible={Boolean(showTutorial && tutorialReady && currentCard)}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
        statusBarTranslucent
      >
        <View style={styles.tutorialModalRoot}>
          <SafeAreaView style={styles.tutorialModalSafe} edges={['top', 'bottom']}>
            <Text style={styles.tutorialAutoRecord}>
              튜토리얼을 닫으면 카메라·마이크 권한을 요청해요. 권한이 허용되고 카메라가 준비되면 자동으로 녹화가 시작되며, 다음 카드로 넘어가면 해당 카드 녹화가 저장·종료돼요.
            </Text>
            <View style={styles.tutorialHintLeft}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>좌측 탭</Text>
              <Text style={styles.tutorialDesc}>이전 카드로</Text>
            </View>
            <View style={styles.tutorialHintRight}>
              <Ionicons name="chevron-forward" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>우측 탭</Text>
              <Text style={styles.tutorialDesc}>다음 카드 · 녹화 저장</Text>
            </View>
            <View style={styles.tutorialHintBottom}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
              <Text style={styles.tutorialTitle}>아래로 스와이프</Text>
              <Text style={styles.tutorialDesc}>놀이 종료 후 우아기록 보기</Text>
            </View>
            <View style={styles.tutorialModalFooter}>
              <Pressable
                style={styles.tutorialCheckRow}
                onPress={() => setDontShowAgain((v) => !v)}
                hitSlop={8}
              >
                <View style={[styles.tutorialCheckbox, dontShowAgain && styles.tutorialCheckboxChecked]}>
                  {dontShowAgain && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.tutorialCheckLabel}>다시 보지 않기</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.tutorialButton, pressed && styles.tutorialButtonPressed]}
                onPress={() => void dismissTutorialAndStart()}
                hitSlop={8}
              >
                <Text style={styles.tutorialButtonText}>확인했어요</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const CARD_RADIUS = 32;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: VIDEO_BG,
  },
  hiddenCameraWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
  },
  permissionBlock: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(243,238,248,0.97)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#6B5B7A',
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
    color: '#4A3F5C',
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: '#6B5B7A',
    fontFamily: Fonts.rounded,
  },
  mainWrap: {
    flex: 1,
    zIndex: 1,
  },
  webHint: {
    fontSize: 14,
    color: '#6B5B7A',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  permissionInline: {
    zIndex: 100,
    elevation: 100,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  permissionInlineText: {
    fontSize: 14,
    color: '#6B5B7A',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  permissionBtn: {
    ...primaryCtaPadding,
    borderRadius: 14,
    backgroundColor: VIDEO_PURPLE,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  cameraErrorBox: {
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
    gap: 8,
  },
  cameraErrorText: {
    fontSize: 13,
    color: '#B85450',
    fontFamily: Fonts.rounded,
    textAlign: 'center',
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
    backgroundColor: VIDEO_PURPLE,
  },
  recordLabel: {
    fontSize: 14,
    color: '#6B5B7A',
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
    borderWidth: 2,
    borderColor: VIDEO_PURPLE,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E8E0F2',
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
    color: '#6B5B7A',
    fontFamily: Fonts.rounded,
    paddingBottom: 16,
  },
  tutorialModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  tutorialModalSafe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  tutorialModalFooter: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
    backgroundColor: VIDEO_PURPLE,
    borderColor: VIDEO_PURPLE,
  },
  tutorialCheckLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontFamily: Fonts.rounded,
  },
  tutorialButton: {
    ...primaryCtaPadding,
    borderRadius: 16,
    backgroundColor: VIDEO_PURPLE,
    alignItems: 'center',
  },
  tutorialButtonPressed: {
    opacity: 0.9,
  },
  tutorialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10050,
    elevation: 10050,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  savingText: {
    fontSize: 17,
    fontWeight: '600',
    color: VIDEO_PURPLE,
    fontFamily: Fonts.rounded,
  },
});
