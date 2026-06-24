import { Fonts, PastelColors, flashcardShadow } from '@/constants/theme';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label?: string;
  children: ReactNode;
};

/** 튜토리얼용 미니 폰 프레임 — 스크린샷처럼 보이도록 */
export function PhoneFrame({ label, children }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.phone}>
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={styles.statusIcons}>
            <View style={styles.statusDot} />
            <View style={styles.statusDot} />
            <View style={[styles.statusDot, styles.statusDotWide]} />
          </View>
        </View>
        <View style={styles.screen}>{children}</View>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  phone: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.surface,
    overflow: 'hidden',
    ...flashcardShadow,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: PastelColors.background,
  },
  statusTime: {
    fontSize: 10,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PastelColors.textSecondary,
  },
  statusDotWide: {
    width: 10,
  },
  screen: {
    minHeight: 180,
    backgroundColor: PastelColors.background,
  },
  homeIndicator: {
    alignSelf: 'center',
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.border,
    marginVertical: 6,
  },
});
