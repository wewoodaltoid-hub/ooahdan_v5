import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type DummyNotificationItem = {
  id: string;
  type: 'archive' | 'community' | 'manage';
  title: string;
  body: string;
  timeLabel: string;
};

const DUMMY_NOTIFICATIONS: DummyNotificationItem[] = [
  {
    id: 'n-archive-1',
    type: 'archive',
    title: '아카이브',
    body: '우아기록 삭제 알림 30분 후면 사라져요!',
    timeLabel: '방금',
  },
  {
    id: 'n-community-1',
    type: 'community',
    title: '커뮤니티',
    body: '새댓글, 좋아요 알림',
    timeLabel: '5분 전',
  },
  {
    id: 'n-manage-1',
    type: 'manage',
    title: '관리',
    body: '아이별 아카이브 추가 알림',
    timeLabel: '1시간 전',
  },
];

function typeIcon(type: DummyNotificationItem['type']): keyof typeof MaterialIcons.glyphMap {
  switch (type) {
    case 'archive':
      return 'library-books';
    case 'community':
      return 'forum';
    case 'manage':
      return 'child-care';
    default:
      return 'notifications-none';
  }
}

function typeBadgeColor(type: DummyNotificationItem['type']): string {
  switch (type) {
    case 'archive':
      return PastelColors.primaryLight;
    case 'community':
      return '#E8F4FD';
    case 'manage':
      return '#FFF4E6';
    default:
      return PastelColors.backgroundMint;
  }
}

type Props = {
  visible: boolean;
  slideAnim: Animated.Value;
  onClose: () => void;
};

/** 우아홈 푸시 알림 더미 리스트 (추후 실제 푸시 연동) */
export function HomeNotificationPanel({ visible, slideAnim, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>알림</Text>
        <Text style={styles.subtitle}>아카이브 · 커뮤니티 · 관리 알림이 여기에 모여요</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {DUMMY_NOTIFICATIONS.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => {}}
            >
              <View style={[styles.itemIconWrap, { backgroundColor: typeBadgeColor(item.type) }]}>
                <MaterialIcons name={typeIcon(item.type)} size={22} color={PastelColors.accent} />
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemType}>{item.title}</Text>
                  <Text style={styles.itemTime}>{item.timeLabel}</Text>
                </View>
                <Text style={styles.itemText}>{item.body}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.footerHint}>실제 푸시 알림은 추후 연동 예정이에요</Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
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
    maxHeight: SCREEN_HEIGHT * 0.72,
    ...flashcardShadow,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.textSecondary,
    opacity: 0.4,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.48,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: PastelColors.cardBg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: PastelColors.border,
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 13,
    fontWeight: '700',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  itemTime: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  itemText: {
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    lineHeight: 21,
  },
  footerHint: {
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    marginTop: 12,
  },
});
