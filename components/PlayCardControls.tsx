import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts } from '@/constants/theme';

type PlayCardControlsProps = {
  currentIndex: number;
  total: number;
  isBusy: boolean;
  accentColor: string;
  textColor: string;
  surfaceColor: string;
  borderColor: string;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
};

export function PlayCardControls({
  currentIndex,
  total,
  isBusy,
  accentColor,
  textColor,
  surfaceColor,
  borderColor,
  onPrev,
  onNext,
  onExit,
}: PlayCardControlsProps) {
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= total - 1;

  return (
    <View style={styles.root} collapsable={false}>
      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: surfaceColor, borderColor }, atStart && styles.btnDisabled]}
          onPress={onPrev}
          disabled={atStart || isBusy}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel="이전 카드"
        >
          <Ionicons name="chevron-back" size={20} color={textColor} />
          <Text style={[styles.btnText, { color: textColor }]}>이전</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnExit, { backgroundColor: accentColor }]}
          onPress={onExit}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel="놀이 종료"
        >
          <Ionicons name="stop-circle-outline" size={20} color="#fff" />
          <Text style={styles.btnExitText}>종료</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: surfaceColor, borderColor }, atEnd && styles.btnDisabled]}
          onPress={onNext}
          disabled={atEnd || isBusy}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel="다음 카드"
        >
          <Text style={[styles.btnText, { color: textColor }]}>다음</Text>
          <Ionicons name="chevron-forward" size={20} color={textColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  btnExit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnExitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Fonts.rounded,
  },
});
