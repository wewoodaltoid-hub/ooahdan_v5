import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { Fonts, PastelColors } from '@/constants/theme';

type Props = {
  visible: boolean;
  progress?: number;
};

/** 아카이브 다운로드 — FFmpeg 실시간 인코딩 로딩 */
export function ArchiveExportModal({ visible, progress }: Props) {
  const pct =
    progress != null && Number.isFinite(progress)
      ? Math.round(Math.min(100, Math.max(0, progress * 100)))
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎬</Text>
          <Text style={styles.title}>예쁜 아카이브 영상을{'\n'}저장용으로 변환 중입니다...</Text>
          <ActivityIndicator size="large" color={PastelColors.primary} style={styles.spinner} />
          {pct != null ? <Text style={styles.progress}>{pct}%</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    color: PastelColors.text,
    marginBottom: 16,
  },
  spinner: {
    marginVertical: 8,
  },
  progress: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    color: PastelColors.textSecondary,
    marginTop: 4,
  },
});
