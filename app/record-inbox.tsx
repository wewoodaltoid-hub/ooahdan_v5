import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdBannerPlaceholder,
  useAdBannerScrollContentStyle,
} from '@/components/AdBannerPlaceholder';
import { isBabyAdmin, useBaby } from '@/contexts/BabyContext';
import { Redirect, Stack, useRouter, type Href } from 'expo-router';
import { Audio, Video, ResizeMode } from 'expo-av';
import { CardOverlayCropGuide } from '@/components/CardOverlayCropGuide';
import { SegmentTrimBar } from '@/components/SegmentTrimBar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  computeContainContentRect,
  uiSquareCropToNormalized,
} from '@/lib/video-crop';
import {
  fetchWordCardImageSource,
  type WordCardImageSource,
} from '@/lib/word-card-image-api';
import Slider from '@react-native-community/slider';
import {
  getInbox,
  subscribe,
  removeInboxItem,
  clearAllInbox,
  type InboxRecordingItem,
} from '@/stores/inbox-store';
import {
  babyHasArchiveWord,
  persistInboxRecordingToArchive,
  type VideoCropNormalized,
} from '@/lib/archive-recordings-api';
import { ensureArchiveQuotaForCard } from '@/lib/archive-quota';
import { emitArchiveRefresh } from '@/lib/archive-refresh-events';
import { PastelColors, Fonts, flashcardShadow, primaryCtaPadding } from '@/constants/theme';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 7200초
const ONE_HOUR_MS = 60 * 60 * 1000;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** 더미 파형 막대 개수 (인박스 목록 미리보기) */
const WAVEFORM_BAR_COUNT = 24;
function getDummyWaveformBars(seed: number, barCount = WAVEFORM_BAR_COUNT): number[] {
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const t = (seed + i * 7) % 10;
    bars.push(t < 4 ? 0.2 + (t / 4) * 0.2 : 0.5 + (Math.sin((seed + i) * 0.5) * 0.3 + 0.3));
  }
  return bars;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 소수점 둘째 자리까지 표시 (예: 02.35초, 1:04.10) */
function formatTimePrecise(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const secStr = s.toFixed(2);
  return m > 0 ? `${m}:${secStr}` : `${secStr}초`;
}

const STEP_SEC = 0.05;
const MICRO_STEP = 0.1;

function getRemainingMs(item: InboxRecordingItem, now: number): number {
  const expiresAt = item.createdAt + TWO_HOURS_MS;
  return Math.max(0, expiresAt - now);
}

async function getUriDurationMillis(uri: string): Promise<number> {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    try {
      const st = await sound.getStatusAsync();
      if (st.isLoaded && typeof st.durationMillis === 'number') {
        return Math.max(0, Math.round(st.durationMillis));
      }
    } finally {
      await sound.unloadAsync();
    }
  } catch {
    return 0;
  }
  return 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EditModalProps = {
  item: InboxRecordingItem | null;
  babyId: string | null;
  onClose: () => void;
  onSavedNext: (nextItem: InboxRecordingItem | null) => void;
  beforeArchive: (item: InboxRecordingItem) => Promise<boolean>;
};

function EditModal({ item, babyId, onClose, onSavedNext, beforeArchive }: EditModalProps) {
  const insets = useSafeAreaInsets();
  const archiveFooterBottomPad = Math.max(insets.bottom, 12);

  const [durationSec, setDurationSec] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [segmentPlaying, setSegmentPlaying] = useState(false);
  const [cropPanelOpen, setCropPanelOpen] = useState(true);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<Video | null>(null);
  /** 콜백에서 항상 최신 구간을 참조하기 위한 ref (클로저 스테일 방지) */
  const startRef = useRef(0);
  const endRef = useRef(0);
  const durationRef = useRef(0);
  /** setPositionAsync 중복 실행 방지 */
  const isSeekingRef = useRef(false);
  /** 슬라이더 드래그 중에는 실시간 seek 하지 않고, 손 뗐을 때만 seek */
  const sliderDraggingRef = useRef(false);

  /** 영상 미리보기 레이아웃(px) — 정규화 크롭 계산용 */
  const [videoLayout, setVideoLayout] = useState({ width: 0, height: 0 });
  const [videoNaturalSize, setVideoNaturalSize] = useState({ width: 0, height: 0 });
  /** 1:1 크롭 박스 좌상단·한 변 길이 (modalVideoWrap 로컬 좌표) */
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropSize, setCropSize] = useState(0);
  const cropXRef = useRef(0);
  const cropYRef = useRef(0);
  const cropSizeRef = useRef(0);
  const videoLayoutRef = useRef({ width: 0, height: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cropInitKeyRef = useRef('');
  const [cardImage, setCardImage] = useState<WordCardImageSource | null>(null);

  useEffect(() => {
    cropXRef.current = cropX;
    cropYRef.current = cropY;
    cropSizeRef.current = cropSize;
  }, [cropX, cropY, cropSize]);

  useEffect(() => {
    videoLayoutRef.current = videoLayout;
  }, [videoLayout]);

  useEffect(() => {
    cropInitKeyRef.current = '';
    setVideoNaturalSize({ width: 0, height: 0 });
  }, [item?.id]);

  useEffect(() => {
    if (!item?.cardId) {
      setCardImage(null);
      return;
    }
    let cancelled = false;
    void fetchWordCardImageSource(item.cardId).then((src) => {
      if (!cancelled) setCardImage(src);
    });
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.cardId]);

  const videoContentRect = useMemo(() => {
    if (
      videoLayout.width <= 0 ||
      videoLayout.height <= 0 ||
      videoNaturalSize.width <= 0 ||
      videoNaturalSize.height <= 0
    ) {
      return null;
    }
    return computeContainContentRect(
      videoLayout.width,
      videoLayout.height,
      videoNaturalSize.width,
      videoNaturalSize.height,
    );
  }, [videoLayout.width, videoLayout.height, videoNaturalSize.width, videoNaturalSize.height]);

  const videoContentRectRef = useRef(videoContentRect);
  videoContentRectRef.current = videoContentRect;

  /** 크롭 드래그·슬라이더 조작 중 ScrollView 스크롤 잠금 */
  const [cropDragging, setCropDragging] = useState(false);

  useEffect(() => {
    if (item?.mediaType !== 'video') return;
    const content = videoContentRect;
    if (!content || content.width <= 0 || content.height <= 0) return;
    const key = `${item.id}-${Math.round(content.width)}-${Math.round(content.height)}`;
    if (cropInitKeyRef.current === key) return;
    cropInitKeyRef.current = key;
    const maxS = Math.min(content.width, content.height);
    setCropSize(maxS);
    setCropX(content.x + (content.width - maxS) / 2);
    setCropY(content.y + (content.height - maxS) / 2);
  }, [item?.id, item?.mediaType, videoContentRect]);

  /** 크롭 가이드 — 실제 영상(contain) 영역 안에서만 이동, 스크롤에 제스처 양보하지 않음 */
  const cropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartRef.current = { x: cropXRef.current, y: cropYRef.current };
        setCropDragging(true);
      },
      onPanResponderRelease: () => setCropDragging(false),
      onPanResponderTerminate: () => setCropDragging(false),
      onPanResponderMove: (_, g) => {
        const content = videoContentRectRef.current;
        const size = cropSizeRef.current;
        if (!content || content.width <= 0 || content.height <= 0 || size <= 0) return;
        let nx = dragStartRef.current.x + g.dx;
        let ny = dragStartRef.current.y + g.dy;
        nx = Math.max(content.x, Math.min(nx, content.x + content.width - size));
        ny = Math.max(content.y, Math.min(ny, content.y + content.height - size));
        setCropX(nx);
        setCropY(ny);
      },
    })
  ).current;

  const applyCropSizeFromSlider = useCallback(
    (value: number) => {
      const content = videoContentRect;
      if (!content || content.width <= 0 || content.height <= 0) return;
      const shortAxis = Math.min(content.width, content.height);
      const minS = shortAxis * 0.3;
      const maxS = shortAxis;
      const clamped = Math.max(minS, Math.min(maxS, value));
      const cx = cropX + cropSize / 2;
      const cy = cropY + cropSize / 2;
      let nx = cx - clamped / 2;
      let ny = cy - clamped / 2;
      nx = Math.max(content.x, Math.min(nx, content.x + content.width - clamped));
      ny = Math.max(content.y, Math.min(ny, content.y + content.height - clamped));
      setCropSize(clamped);
      setCropX(nx);
      setCropY(ny);
    },
    [videoContentRect, cropX, cropY, cropSize]
  );

  useEffect(() => {
    startRef.current = Math.max(0, Math.min(startSec, endSec - MICRO_STEP));
    endRef.current = Math.min(durationSec, Math.max(endSec, startSec + MICRO_STEP));
    durationRef.current = durationSec;
  }, [startSec, endSec, durationSec]);

  const loadAudio = useCallback(async (uri: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      await sound.setVolumeAsync(1.0);
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis != null) {
        const dur = status.durationMillis / 1000;
        setDurationSec(dur);
        setEndSec(dur);
        setStartSec(0);
      } else {
        setDurationSec(10);
        setEndSec(10);
      }
    } catch {
      setDurationSec(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (item) {
      setLoading(true);
      setSegmentPlaying(false);
      setCropPanelOpen(true);
      if (item.mediaType === 'video') {
        soundRef.current?.unloadAsync().catch(() => {});
        soundRef.current = null;
        videoRef.current?.unloadAsync().catch(() => {});
        setDurationSec(0);
        setEndSec(0);
        setStartSec(0);
        setVideoLayout({ width: 0, height: 0 });
      } else {
        loadAudio(item.uri);
      }
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      videoRef.current?.unloadAsync().catch(() => {});
      setSegmentPlaying(false);
    };
  }, [item?.id, item?.mediaType, loadAudio]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      videoRef.current?.unloadAsync().catch(() => {});
      videoRef.current = null;
      onClose();
    });
  }, [slideAnim, onClose]);

  /** seek + play 한 번에, 락으로 중복 방지 — Seeking interrupted 등 seek/재생 오류는 삼킴 */
  const safeSeekAndPlay = useCallback((sound: Audio.Sound, positionMs: number) => {
    if (isSeekingRef.current) return;
    isSeekingRef.current = true;
    sound
      .setPositionAsync(positionMs)
      .then(() => sound.playAsync())
      .catch(() => {})
      .finally(() => {
        isSeekingRef.current = false;
      });
  }, []);

  const playSegment = useCallback(async () => {
    const start = Math.max(0, Math.min(startSec, endSec - MICRO_STEP));
    const end = Math.min(durationSec, Math.max(endSec, startSec + MICRO_STEP));
    if (durationSec <= 0) return;

    if (item?.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;
      startRef.current = start;
      endRef.current = end;
      setSegmentPlaying(true);
      video.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        const posMs = status.positionMillis ?? 0;
        const endMs = endRef.current * 1000;
        const startMs = startRef.current * 1000;
        if (posMs >= endMs - 50) {
          void video
            .setPositionAsync(startMs)
            .then(() => video.playAsync())
            .catch(() => {});
        }
      });
      await video.setProgressUpdateIntervalAsync(100);
      await video.setPositionAsync(start * 1000).catch(() => {});
      await video.playAsync().catch(() => {});
      return;
    }

    const sound = soundRef.current;
    if (!sound) return;
    startRef.current = start;
    endRef.current = end;
    setSegmentPlaying(true);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      const posMs = status.positionMillis ?? 0;
      const endMs = endRef.current * 1000;
      const startMs = startRef.current * 1000;
      if (posMs >= endMs - 50) safeSeekAndPlay(sound, startMs);
    });
    await sound.setVolumeAsync(1.0);
    await sound.setProgressUpdateIntervalAsync(100);
    safeSeekAndPlay(sound, start * 1000);
  }, [item?.mediaType, startSec, endSec, durationSec, safeSeekAndPlay]);

  const stopSegment = useCallback(async () => {
    if (item?.mediaType === 'video') {
      const video = videoRef.current;
      if (video) await video.pauseAsync();
      setSegmentPlaying(false);
      return;
    }
    const sound = soundRef.current;
    if (sound) await sound.stopAsync();
    setSegmentPlaying(false);
  }, [item?.mediaType]);

  /** 재생 중 구간 변경 시 위치를 새 경계에 맞춤. 슬라이더 드래그 중에는 스킵(손 뗐을 때 onSlidingComplete에서 호출) */
  const applySeekToCurrentBounds = useCallback(() => {
    if (!segmentPlaying || isSeekingRef.current) return;

    if (item?.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;
      const startMs = startRef.current * 1000;
      const endMs = endRef.current * 1000;
      video
        .getStatusAsync()
        .then((status) => {
          if (!status.isLoaded) return;
          const posMs = status.positionMillis ?? 0;
          if (posMs < startMs - 20) {
            void video
              .setPositionAsync(startMs)
              .then(() => video.playAsync())
              .catch(() => {});
          } else if (posMs > endMs + 20) {
            void video
              .setPositionAsync(startMs)
              .then(() => video.playAsync())
              .catch(() => {});
          }
        })
        .catch(() => {});
      return;
    }

    if (!soundRef.current) return;
    const sound = soundRef.current;
    const startMs = startRef.current * 1000;
    const endMs = endRef.current * 1000;
    sound
      .getStatusAsync()
      .then((status) => {
        if (!status.isLoaded) return;
        const posMs = status.positionMillis ?? 0;
        if (posMs < startMs - 20) safeSeekAndPlay(sound, startMs);
        else if (posMs > endMs + 20) safeSeekAndPlay(sound, startMs);
      })
      .catch(() => {});
  }, [item?.mediaType, segmentPlaying, safeSeekAndPlay]);

  useEffect(() => {
    if (sliderDraggingRef.current) return;
    applySeekToCurrentBounds();
  }, [segmentPlaying, startSec, endSec, applySeekToCurrentBounds]);

  /** 종료 시간 미세 조정: start + 최소구간 초과, duration 이하 유지 */
  const handleTrimStartChange = useCallback(
    (sec: number) => {
      const maxStart = Math.max(0, endSec - MICRO_STEP);
      setStartSec(Math.max(0, Math.min(maxStart, sec)));
    },
    [endSec],
  );

  const handleTrimEndChange = useCallback(
    (sec: number) => {
      const minEnd = Math.min(durationSec, startSec + MICRO_STEP);
      setEndSec(Math.max(minEnd, Math.min(durationSec, sec)));
    },
    [startSec, durationSec],
  );

  /** Storage 업로드 + DB INSERT 성공 시에만 인박스에서 제거 */
  const doArchiveAndClose = useCallback(async () => {
    if (!item || !babyId) {
      Alert.alert('알림', '선택된 아이가 없어 저장할 수 없어요.');
      setSaving(false);
      return;
    }
    const allowed = await beforeArchive(item);
    if (!allowed) return;
    setSaving(true);
    const start = Math.max(0, Math.min(startSec, endSec - MICRO_STEP));
    const end = Math.min(durationSec, Math.max(endSec, start + MICRO_STEP));
    const trimStartMs = Math.round(start * 1000);
    const trimEndMs = Math.round(end * 1000);
    const wordId = UUID_RE.test(item.cardId) ? item.cardId : null;
    let videoCrop: VideoCropNormalized | undefined;
    if (
      item.mediaType === 'video' &&
      videoLayout.width > 0 &&
      videoLayout.height > 0 &&
      videoNaturalSize.width > 0 &&
      videoNaturalSize.height > 0
    ) {
      const norm = uiSquareCropToNormalized(
        cropX,
        cropY,
        cropSize,
        videoLayout.width,
        videoLayout.height,
        videoNaturalSize.width,
        videoNaturalSize.height,
      );
      videoCrop = {
        cropX: norm.x,
        cropY: norm.y,
        cropWidth: norm.width,
        cropHeight: norm.height,
      };
    }
    const result = await persistInboxRecordingToArchive({
      localUri: item.uri,
      babyId,
      word: item.word,
      cardId: item.cardId,
      trimStartMs,
      trimEndMs,
      wordId,
      mediaType: item.mediaType === 'video' ? 'video' : 'audio',
      videoCrop,
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert('아카이빙 실패', result.message);
      return;
    }
    removeInboxItem(item.id);
    emitArchiveRefresh();
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    videoRef.current?.unloadAsync().catch(() => {});
    videoRef.current = null;
    setSegmentPlaying(false);
    const next = getInbox()[0] ?? null;
    if (next) {
      onSavedNext(next);
    } else {
      handleClose();
      onSavedNext(null);
    }
  }, [
    item,
    babyId,
    startSec,
    endSec,
    durationSec,
    videoLayout,
    videoNaturalSize.width,
    videoNaturalSize.height,
    cropX,
    cropY,
    cropSize,
    handleClose,
    onSavedNext,
    beforeArchive,
  ]);

  const handleSave = useCallback(() => {
    if (!item || !babyId) {
      Alert.alert('알림', '선택된 아이가 없어요.');
      return;
    }
    void (async () => {
      const allowed = await beforeArchive(item);
      if (!allowed) return;
      const isSpoken = await babyHasArchiveWord(babyId, item.word);
      if (isSpoken) {
        Alert.alert('안내', '새 영상/목소리가 아카이브에 추가되었습니다', [
          { text: '확인', onPress: () => void doArchiveAndClose() },
        ]);
        return;
      }
      Alert.alert(
        '축하합니다! 🎉',
        '아기가 드디어 이 단어를 말하게 되었나요?',
        [
          {
            text: '네! 말하는 단어로 승급 후 아카이빙',
            onPress: () => void doArchiveAndClose(),
          },
          {
            text: '아직 반응만해요 (아카이빙만)',
            onPress: () => void doArchiveAndClose(),
          },
          {
            text: '취소',
            style: 'cancel',
          },
        ]
      );
    })();
  }, [item, babyId, doArchiveAndClose, beforeArchive]);

  if (!item) return null;

  const start = Math.max(0, Math.min(startSec, endSec - MICRO_STEP));
  const end = Math.min(durationSec, Math.max(endSec, start + MICRO_STEP));

  const contentW = videoContentRect?.width ?? 0;
  const contentH = videoContentRect?.height ?? 0;
  const shortAxisPx = contentW > 0 && contentH > 0 ? Math.min(contentW, contentH) : 0;
  const minCropPx = shortAxisPx * 0.3;
  const maxCropPx = shortAxisPx;

  return (
    <Modal visible={!!item} transparent animationType="none">
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} disabled={saving}>
          <View style={styles.modalBackdropInner} />
        </Pressable>
        <Animated.View
          style={[
            styles.modalSheet,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.modalHandle} />
          <View style={[styles.modalSafe, styles.modalSafeFlex]}>
            <View style={styles.modalColumn}>
              <View style={styles.modalHeaderCompact}>
                <View style={styles.modalHeaderTextWrap}>
                  <Text style={styles.modalTitleSmall}>구간 편집</Text>
                  <Text style={styles.modalWordBadge} numberOfLines={1}>
                    {item.word}
                  </Text>
                </View>
                <Pressable
                  onPress={handleClose}
                  style={styles.modalCloseIconBtn}
                  disabled={saving}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={22} color={PastelColors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.modalMetaLine} numberOfLines={1}>
                {item.mediaType === 'video' ? '영상' : '음성'} · 재생 구간{' '}
                {formatTimePrecise(start)} ~ {formatTimePrecise(end)}
              </Text>

              {loading && item.mediaType !== 'video' ? (
                <View style={styles.modalLoadingFlex}>
                  <ActivityIndicator size="large" color={PastelColors.accent} />
                  <Text style={styles.modalLoadingText}>음성 불러오는 중...</Text>
                </View>
              ) : (
                <>
                  {item.mediaType === 'video' ? (
                    <View style={styles.modalVideoFixed}>
                      <View
                        style={styles.modalVideoWrap}
                        onLayout={(e) => {
                          const { width, height } = e.nativeEvent.layout;
                          setVideoLayout({ width, height });
                        }}
                      >
                        <Video
                          ref={videoRef}
                          source={{ uri: item.uri }}
                          style={styles.modalVideo}
                          resizeMode={ResizeMode.CONTAIN}
                          onReadyForDisplay={(event) => {
                            const ns = event.naturalSize;
                            if (ns?.width > 0 && ns?.height > 0) {
                              setVideoNaturalSize({ width: ns.width, height: ns.height });
                            }
                          }}
                          onLoad={(status) => {
                            if (status.isLoaded && typeof status.durationMillis === 'number') {
                              const dur = status.durationMillis / 1000;
                              setDurationSec(dur);
                              setEndSec(dur);
                              setStartSec(0);
                            }
                            setLoading(false);
                          }}
                        />
                        {loading && (
                          <View style={styles.modalVideoLoading}>
                            <ActivityIndicator size="large" color={PastelColors.accent} />
                            <Text style={styles.modalLoadingText}>영상 불러오는 중...</Text>
                          </View>
                        )}
                        {!loading && videoContentRect && cropSize > 0 && (
                          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                            <View
                              pointerEvents="none"
                              style={[styles.cropDimBand, { left: 0, right: 0, top: 0, height: cropY }]}
                            />
                            <View
                              pointerEvents="none"
                              style={[
                                styles.cropDimBand,
                                {
                                  left: 0,
                                  right: 0,
                                  top: cropY + cropSize,
                                  bottom: 0,
                                },
                              ]}
                            />
                            <View
                              pointerEvents="none"
                              style={[
                                styles.cropDimBand,
                                {
                                  left: 0,
                                  width: cropX,
                                  top: cropY,
                                  height: cropSize,
                                },
                              ]}
                            />
                            <View
                              pointerEvents="none"
                              style={[
                                styles.cropDimBand,
                                {
                                  left: cropX + cropSize,
                                  right: 0,
                                  top: cropY,
                                  height: cropSize,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.cropGuideBox,
                                { left: cropX, top: cropY, width: cropSize, height: cropSize },
                              ]}
                              {...cropPanResponder.panHandlers}
                            />
                            <CardOverlayCropGuide
                              image={cardImage}
                              cropX={cropX}
                              cropY={cropY}
                              cropSize={cropSize}
                              opacity={0.7}
                            />
                          </View>
                        )}
                      </View>
                      {shortAxisPx > 0 && minCropPx <= maxCropPx && (
                        <>
                          <Pressable
                            style={({ pressed }) => [
                              styles.cropToggleRow,
                              pressed && styles.btnPressed,
                            ]}
                            onPress={() => setCropPanelOpen((v) => !v)}
                          >
                            <Text style={styles.cropToggleLabel}>크롭 (1:1 · 우아스냅)</Text>
                            <MaterialIcons
                              name={cropPanelOpen ? 'expand-less' : 'expand-more'}
                              size={22}
                              color={PastelColors.textSecondary}
                            />
                          </Pressable>
                          {cropPanelOpen && (
                            <>
                              <Text style={styles.cropHintText}>
                                가이드를 드래그하고 슬라이더로 크기를 조절하세요.
                              </Text>
                              <View style={styles.cropSliderRow}>
                                <Text style={[styles.cropSliderEndLabel, { textAlign: 'left' }]}>
                                  작게
                                </Text>
                                <Slider
                                  style={styles.sliderFlex}
                                  minimumValue={minCropPx}
                                  maximumValue={maxCropPx}
                                  value={Math.max(minCropPx, Math.min(maxCropPx, cropSize))}
                                  onValueChange={applyCropSizeFromSlider}
                                  onSlidingStart={() => setCropDragging(true)}
                                  onSlidingComplete={() => setCropDragging(false)}
                                  minimumTrackTintColor={PastelColors.segmentHighlight}
                                  maximumTrackTintColor={PastelColors.backgroundMint}
                                  thumbTintColor={PastelColors.segmentHighlight}
                                />
                                <Text style={[styles.cropSliderEndLabel, { textAlign: 'right' }]}>
                                  크게
                                </Text>
                              </View>
                            </>
                          )}
                        </>
                      )}
                    </View>
                  ) : null}

                  <ScrollView
                    style={styles.modalEditScroll}
                    contentContainerStyle={[
                      styles.modalEditScrollContent,
                      { paddingBottom: archiveFooterBottomPad + 12 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    scrollEnabled={!cropDragging}
                  >
                  <View style={[styles.cropSliderRow, styles.trimSliderRow]}>
                    <Text style={[styles.cropSliderEndLabel, { textAlign: 'left' }]}>시작</Text>
                    <View style={styles.trimBarFlex}>
                      <SegmentTrimBar
                        durationSec={durationSec}
                        startSec={startSec}
                        endSec={endSec}
                        onChangeStart={handleTrimStartChange}
                        onChangeEnd={handleTrimEndChange}
                        onDragStart={() => {
                          sliderDraggingRef.current = true;
                        }}
                        onDragComplete={() => {
                          sliderDraggingRef.current = false;
                          applySeekToCurrentBounds();
                        }}
                        minGapSec={MICRO_STEP}
                        stepSec={STEP_SEC}
                        insetTrack={false}
                        showTimeMeta={false}
                      />
                    </View>
                    <Text style={[styles.cropSliderEndLabel, { textAlign: 'right' }]}>끝</Text>
                  </View>
                  <View style={styles.trimTimeRow}>
                    <Text style={styles.trimTimeLabel}>
                      재생 구간 {formatTimePrecise(start)} ~ {formatTimePrecise(end)}
                    </Text>
                    <Text style={styles.trimTimeMeta}>
                      {formatTimePrecise(Math.max(0, end - start))} / 전체 {formatTimePrecise(durationSec)}
                    </Text>
                  </View>

                  <View style={styles.editActionRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.footerAction,
                        styles.footerActionSecondary,
                        segmentPlaying && styles.footerActionSecondaryActive,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={segmentPlaying ? stopSegment : playSegment}
                      disabled={durationSec <= 0}
                    >
                      <MaterialIcons
                        name={segmentPlaying ? 'stop' : 'play-arrow'}
                        size={18}
                        color={
                          segmentPlaying ? PastelColors.buttonTextOnPrimary : PastelColors.accent
                        }
                      />
                      <Text
                        style={[
                          styles.footerActionLabelSecondary,
                          segmentPlaying && styles.footerActionLabelSecondaryActive,
                        ]}
                      >
                        {segmentPlaying ? '중지' : '구간 재생'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.footerAction,
                        styles.footerActionPrimary,
                        pressed && styles.btnPressed,
                        saving && styles.saveConfirmBtnDisabled,
                      ]}
                      onPress={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={PastelColors.buttonTextOnPrimary} />
                      ) : (
                        <>
                          <MaterialIcons
                            name="archive"
                            size={18}
                            color={PastelColors.buttonTextOnPrimary}
                          />
                          <Text style={styles.footerActionLabelPrimary}>아카이빙</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        {saving && (
          <View style={styles.archiveSavingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={PastelColors.accent} />
            <Text style={styles.archiveSavingTitle}>
              {item.mediaType === 'video'
                ? '영상을 안전하게 아카이빙 중입니다...'
                : '녹음을 안전하게 아카이빙 중입니다...'}
            </Text>
            <Text style={styles.archiveSavingHint}>
              {item.mediaType === 'video'
                ? '(영상 용량에 따라 수 초~수십 초가 소요될 수 있습니다 ⏳)'
                : '(잠시만 기다려 주세요)'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function RecordInboxScreen() {
  const router = useRouter();
  const { activeBaby, loading: babiesLoading, loaded: babiesLoaded } = useBaby();

  const getArchiveQuotaHandlers = useCallback(
    (item: InboxRecordingItem) => ({
      onManageExisting: () => {
        const q = new URLSearchParams({
          word: item.word,
          cardId: item.cardId,
        });
        router.push(`/archive-manage?${q.toString()}` as Href);
      },
      onSubscribePremium: () => {
        Alert.alert(
          '프리미엄 구독',
          '곧 만나요! 단어별 기록 한도를 늘릴 수 있어요.',
        );
      },
    }),
    [router],
  );

  const checkArchiveQuota = useCallback(
    async (item: InboxRecordingItem): Promise<boolean> => {
      const babyId = activeBaby?.id;
      if (!babyId) {
        Alert.alert('알림', '선택된 아이가 없어요.');
        return false;
      }
      return ensureArchiveQuotaForCard(
        babyId,
        item.cardId,
        item.word,
        getArchiveQuotaHandlers(item),
      );
    },
    [activeBaby?.id, getArchiveQuotaHandlers],
  );
  const [inbox, setInbox] = useState<InboxRecordingItem[]>(getInbox());
  const [now, setNow] = useState(Date.now());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<InboxRecordingItem | null>(null);
  const scrollContentStyle = useAdBannerScrollContentStyle(styles.scrollContent);

  useEffect(() => {
    const unsub = subscribe(() => setInbox(getInbox()));
    return unsub;
  }, []);

  // 재생 화면 진입 시 외부 스피커로 출력되도록 오디오 모드 고정
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleItems = inbox.filter((item) => getRemainingMs(item, now) > 0);

  const handlePlay = useCallback(async (item: InboxRecordingItem) => {
    if (item.mediaType === 'video') {
      if (playingId === item.id) {
        setPlayingId(null);
        return;
      }
      if (playingId) return;
      setPlayingId(item.id);
      return;
    }
    if (playingId) return;
    setPlayingId(item.id);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: item.uri });
      await sound.setVolumeAsync(1.0);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().then(() => setPlayingId(null)).catch(() => setPlayingId(null));
        }
      });
      await sound.playAsync();
    } catch {
      setPlayingId(null);
    }
  }, [playingId]);

  const videoProbeResolveRef = useRef<((n: number) => void) | null>(null);
  const [videoProbeUri, setVideoProbeUri] = useState<string | null>(null);

  const resolveVideoDurationMs = useCallback((uri: string) => {
    return new Promise<number>((resolve) => {
      const timeout = setTimeout(() => {
        videoProbeResolveRef.current = null;
        setVideoProbeUri(null);
        resolve(0);
      }, 15000);
      videoProbeResolveRef.current = (ms) => {
        clearTimeout(timeout);
        resolve(ms);
        videoProbeResolveRef.current = null;
        setVideoProbeUri(null);
      };
      setVideoProbeUri(uri);
    });
  }, []);

  const persistQuickArchive = useCallback(
    async (item: InboxRecordingItem, successBody?: string) => {
      const babyId = activeBaby?.id;
      if (!babyId) {
        Alert.alert('알림', '선택된 아이가 없어요.');
        return;
      }
      const allowed = await ensureArchiveQuotaForCard(
        babyId,
        item.cardId,
        item.word,
        getArchiveQuotaHandlers(item),
      );
      if (!allowed) return;
      const durMs =
        item.mediaType === 'video'
          ? await resolveVideoDurationMs(item.uri)
          : await getUriDurationMillis(item.uri);
      if (durMs <= 0) {
        Alert.alert('오류', item.mediaType === 'video' ? '영상 길이를 확인할 수 없어요.' : '음성 길이를 확인할 수 없어요.');
        return;
      }
      const wordId = UUID_RE.test(item.cardId) ? item.cardId : null;
      const result = await persistInboxRecordingToArchive({
        localUri: item.uri,
        babyId,
        word: item.word,
        cardId: item.cardId,
        trimStartMs: 0,
        trimEndMs: durMs,
        wordId,
        mediaType: item.mediaType === 'video' ? 'video' : 'audio',
      });
      if (!result.ok) {
        Alert.alert('아카이빙 실패', result.message);
        return;
      }
      removeInboxItem(item.id);
      setInbox(getInbox());
      emitArchiveRefresh();
      Alert.alert('안내', successBody ?? '아카이브에 저장했어요.');
    },
    [activeBaby?.id, resolveVideoDurationMs, getArchiveQuotaHandlers],
  );

  const handleOpenEdit = useCallback((item: InboxRecordingItem) => {
    setEditItem(item);
  }, []);

  const handleArchive = useCallback(
    (item: InboxRecordingItem) => {
      const babyId = activeBaby?.id;
      if (!babyId) {
        Alert.alert('알림', '선택된 아이가 없어요.');
        return;
      }
      void (async () => {
        const allowed = await checkArchiveQuota(item);
        if (!allowed) return;
        if (item.mediaType === 'video') {
          Alert.alert(
            '영상 아카이빙',
            '영상은 구간을 잘라 저장해요. 편집 화면에서 시작·끝을 정한 뒤 아카이빙해 주세요.',
            [
              { text: '취소', style: 'cancel' },
              { text: '편집하기', onPress: () => handleOpenEdit(item) },
            ],
          );
          return;
        }
        const spoken = await babyHasArchiveWord(babyId, item.word);
        if (spoken) {
          await persistQuickArchive(item, '새 영상/목소리가 아카이브에 추가되었습니다');
          return;
        }
        Alert.alert(
          '축하합니다! 🎉',
          '아기가 드디어 이 단어를 말하게 되었나요?',
          [
            {
              text: '네! 말하는 단어로 승급 후 아카이빙',
              onPress: () => void persistQuickArchive(item),
            },
            {
              text: '아직 반응만해요 (아카이빙만)',
              onPress: () => void persistQuickArchive(item),
            },
            { text: '취소' },
          ],
        );
      })();
    },
    [activeBaby?.id, persistQuickArchive, checkArchiveQuota, handleOpenEdit],
  );

  const handleClearAll = useCallback(() => {
    if (visibleItems.length === 0) return;
    Alert.alert(
      '전체 삭제',
      '인박스의 녹음을 모두 삭제할까요? 복구할 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '전체 삭제',
          style: 'destructive',
          onPress: () => {
            clearAllInbox();
            setInbox(getInbox());
          },
        },
      ]
    );
  }, [visibleItems]);

  const handleDelete = useCallback((id: string) => {
    removeInboxItem(id);
    setInbox(getInbox());
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditItem(null);
  }, []);

  const handleSavedNext = useCallback((nextItem: InboxRecordingItem | null) => {
    setEditItem(nextItem);
    setInbox(getInbox());
  }, []);

  if (babiesLoaded && !babiesLoading && activeBaby && !isBabyAdmin(activeBaby)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '우아기록 (인박스)',
          headerBackTitle: '메인',
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.headerHint}>
          <Text style={styles.headerHintText}>
            녹음 후 2시간이 지나면 자동으로 사라져요. 편집에서 구간을 정한 뒤 확정 저장하면 아카이브로 남아요.{'\n'}아카이빙된 기록은 우아 아카이브에서 확인 가능해요.
          </Text>
        </View>
        <View style={styles.topActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.topActionBtn,
              styles.topActionBtnClear,
              pressed && styles.btnPressed,
              visibleItems.length === 0 && styles.topActionBtnDisabled,
            ]}
            onPress={handleClearAll}
            disabled={visibleItems.length === 0}
          >
            <Text style={styles.topActionBtnText}>전체 임시 기록 삭제</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.topActionBtn, styles.topActionBtnArchive, pressed && styles.btnPressed]}
            onPress={() => router.push('/archive')}
          >
            <Text style={[styles.topActionBtnText, styles.topActionBtnTextArchive]}>우아 아카이브 이동</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={false}
        >
          {visibleItems.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📥</Text>
              <Text style={styles.emptyText}>인박스가 비어 있어요</Text>
              <Text style={styles.emptySub}>우아놀이에서 녹음한 항목이 여기 쌓여요.</Text>
            </View>
          ) : (
            visibleItems.map((item) => {
              const remainingMs = getRemainingMs(item, now);
              const isUrgent = remainingMs < ONE_HOUR_MS;
              const countdownStr = formatCountdown(remainingMs);
              const waveformBars = getDummyWaveformBars(item.createdAt % 100);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardWord} numberOfLines={1}>{item.word}</Text>
                    <Text style={[styles.countdown, isUrgent && styles.countdownUrgent]} numberOfLines={1}>
                      삭제까지 {countdownStr}
                    </Text>
                  </View>
                  {item.mediaType === 'video' && playingId === item.id ? (
                    <Video
                      source={{ uri: item.uri }}
                      style={styles.listVideoPreview}
                      resizeMode={ResizeMode.CONTAIN}
                      useNativeControls
                      shouldPlay
                    />
                  ) : (
                    <View style={styles.waveformWrap}>
                      {item.mediaType === 'video' ? (
                        <Text style={styles.videoPlaceholderLabel}>🎬 영상 (편집에서 미리보기)</Text>
                      ) : (
                        waveformBars.map((h, i) => (
                          <View
                            key={i}
                            style={[
                              styles.waveformBar,
                              { height: Math.max(4, Math.round(h * 24)) },
                            ]}
                          />
                        ))
                      )}
                    </View>
                  )}
                  <View style={styles.buttonsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, styles.playBtn, pressed && styles.btnPressed]}
                      onPress={() => handlePlay(item)}
                      disabled={
                        item.mediaType === 'video'
                          ? !!playingId && playingId !== item.id
                          : !!playingId
                      }
                    >
                      <Text style={[styles.actionBtnLabel, styles.playBtnLabel]} numberOfLines={1}>▶ 재생</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, styles.archiveBtn, pressed && styles.btnPressed]}
                      onPress={() => handleArchive(item)}
                    >
                      <Text style={[styles.actionBtnLabel, styles.archiveBtnLabel]} numberOfLines={1}>아카이빙</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && styles.btnPressed]}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <Text style={[styles.actionBtnLabel, styles.editBtnLabel]} numberOfLines={1}>편집</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, pressed && styles.btnPressed]}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Text style={[styles.actionBtnLabel, styles.deleteBtnLabel]} numberOfLines={1}>삭제</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
        <AdBannerPlaceholder fixedBottom />
      </SafeAreaView>

      <EditModal
        item={editItem}
        babyId={activeBaby?.id ?? null}
        onClose={handleCloseEdit}
        onSavedNext={handleSavedNext}
        beforeArchive={checkArchiveQuota}
      />

      {videoProbeUri && (
        <Video
          source={{ uri: videoProbeUri }}
          style={styles.durationProbeVideo}
          onLoad={(status) => {
            const ms =
              status.isLoaded && typeof status.durationMillis === 'number'
                ? Math.max(0, Math.round(status.durationMillis))
                : 0;
            videoProbeResolveRef.current?.(ms);
          }}
          onError={() => videoProbeResolveRef.current?.(0)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  headerHint: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: PastelColors.surface,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  headerHintText: {
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 20,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  topActionBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionBtnClear: {
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  topActionBtnArchive: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  topActionBtnDisabled: {
    opacity: 0.5,
  },
  topActionBtnText: {
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    fontWeight: '600',
  },
  topActionBtnTextArchive: {
    color: PastelColors.buttonTextOnPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
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
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  card: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 20,
    ...flashcardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  cardWord: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  countdown: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  countdownUrgent: {
    color: PastelColors.urgentOrange,
    fontWeight: '600',
  },
  waveformWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 28,
    marginBottom: 16,
    gap: 3,
  },
  waveformBar: {
    flex: 1,
    minWidth: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.accent,
    opacity: 0.85,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.88,
  },
  playBtn: {
    backgroundColor: PastelColors.blue,
  },
  playBtnLabel: {
    color: PastelColors.accent,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  archiveBtn: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  archiveBtnLabel: {
    color: PastelColors.buttonTextOnPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  editBtn: {
    backgroundColor: PastelColors.primaryLight,
  },
  editBtnLabel: {
    color: PastelColors.text,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  deleteBtn: {
    backgroundColor: PastelColors.buttonViewerDisabled,
  },
  deleteBtnLabel: {
    color: PastelColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  actionBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  // Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBackdropInner: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
  },
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: PastelColors.surface,
    borderTopWidth: 1,
    borderColor: PastelColors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#B19CD9',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  modalSafe: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 0,
  },
  modalSafeFlex: {
    flex: 1,
    minHeight: 0,
  },
  modalColumn: {
    flex: 1,
    minHeight: 0,
  },
  modalVideoFixed: {
    marginBottom: 4,
  },
  modalEditScroll: {
    flex: 1,
    minHeight: 0,
  },
  modalEditScrollContent: {
    paddingBottom: 8,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  trimBarFlex: {
    flex: 1,
    minWidth: 0,
  },
  trimTimeRow: {
    marginTop: 6,
    gap: 2,
  },
  trimTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  trimTimeMeta: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  footerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  footerActionPrimary: {
    backgroundColor: PastelColors.buttonPrimary,
  },
  footerActionSecondary: {
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  footerActionSecondaryActive: {
    backgroundColor: PastelColors.accent,
    borderColor: PastelColors.accent,
  },
  footerActionLabelPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  footerActionLabelSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  footerActionLabelSecondaryActive: {
    color: PastelColors.buttonTextOnPrimary,
  },
  archiveSavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: 'rgba(255, 248, 252, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  archiveSavingTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    lineHeight: 28,
  },
  archiveSavingHint: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.textSecondary,
    opacity: 0.35,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  modalTitleSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 2,
  },
  modalWordBadge: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  modalCloseIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PastelColors.primaryLight,
  },
  modalMetaLine: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  modalCloseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCloseText: {
    fontSize: 16,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  modalLoading: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    minHeight: 0,
  },
  modalLoadingText: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  modalBody: {
    paddingBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  trimHintText: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 8,
  },
  cropToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cropToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sliderFlex: {
    flex: 1,
    height: 40,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  saveConfirmBtnDisabled: {
    opacity: 0.7,
  },
  modalVideoWrap: {
    position: 'relative',
    width: '100%',
    height: 168,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  modalVideo: {
    width: '100%',
    height: '100%',
  },
  modalVideoLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
    zIndex: 2,
  },
  cropDimBand: {
    position: 'absolute',
    backgroundColor: 'rgba(45, 38, 62, 0.48)',
  },
  cropGuideBox: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 2,
  },
  cropHintText: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  cropSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  trimSliderRow: {
    marginTop: 8,
    marginBottom: 0,
  },
  cropSliderEndLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    width: 36,
  },
  listVideoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#111',
    marginBottom: 16,
  },
  videoPlaceholderLabel: {
    flex: 1,
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    paddingVertical: 6,
  },
  durationProbeVideo: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
