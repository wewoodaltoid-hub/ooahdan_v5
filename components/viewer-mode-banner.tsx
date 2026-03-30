import { StyleSheet, Text, View } from 'react-native';

import { Fonts, PastelColors, flashcardShadow } from '@/constants/theme';

/** 우아팬클럽(observer)일 때 단어장·아카이브 등 상단 안내 */
export function ViewerModeBanner() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>👀 우아팬클럽 모드로 보고 있어요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: PastelColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    ...flashcardShadow,
  },
  text: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
});
