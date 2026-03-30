import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PastelColors, flashcardShadow } from '@/constants/theme';

type PremiumFlashcardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 우아카드·아카이브 등 — 화이트 서피스 + 파스텔 보라 틴트 그림자 플래시카드 */
export function PremiumFlashcard({ children, style }: PremiumFlashcardProps) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    overflow: 'hidden',
    ...flashcardShadow,
  },
});
