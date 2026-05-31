import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ARCHIVE_AD_WATCH_SECONDS } from '@/lib/archive-ad-constants';
import {
  ARCHIVE_FREE_VIDEO_PLAYS,
} from '@/lib/archive-video-play-quota';
import { Fonts, PastelColors, flashcardShadow } from '@/constants/theme';

const DEFAULT_PLAY_MESSAGE = `무료 감상 ${ARCHIVE_FREE_VIDEO_PLAYS}회를 모두 사용했어요!\n광고를 보고 ${ARCHIVE_FREE_VIDEO_PLAYS}회를 더 충전할까요?`;

type ArchiveAdWatchModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
  onComplete: () => void;
  onCancel: () => void;
};

export function ArchiveAdWatchModal({
  visible,
  title = '광고 시청',
  message = DEFAULT_PLAY_MESSAGE,
  onComplete,
  onCancel,
}: ArchiveAdWatchModalProps) {
  const [progress, setProgress] = useState(0);
  const [watching, setWatching] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      setWatching(false);
      completedRef.current = false;
      return;
    }
    completedRef.current = false;
    setProgress(0);
    setWatching(true);
  }, [visible]);

  useEffect(() => {
    if (!visible || !watching) return;

    const durationMs = ARCHIVE_AD_WATCH_SECONDS * 1000;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / durationMs);
      setProgress(ratio);
      if (ratio >= 1 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(tick);
        onComplete();
      }
    }, 50);

    return () => clearInterval(tick);
  }, [visible, watching, onComplete]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={watching && progress < 1 ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
              />
            </View>
            <Text style={styles.progressLabel}>
              광고 시청 중…{' '}
              {Math.min(
                ARCHIVE_AD_WATCH_SECONDS,
                Math.max(0, Math.ceil(progress * ARCHIVE_AD_WATCH_SECONDS)),
              )}
              /{ARCHIVE_AD_WATCH_SECONDS}초
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(74, 68, 83, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: PastelColors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBlock: {
    gap: 10,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: PastelColors.primaryLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: PastelColors.accent,
  },
  progressLabel: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
});
