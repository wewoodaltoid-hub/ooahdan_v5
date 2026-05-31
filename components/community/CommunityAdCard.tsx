import { StyleSheet, Text, View } from 'react-native';

import { PastelColors, Fonts, softShadow } from '@/constants/theme';

type Props = {
  copy: string;
};

/** 인피드 가짜 광고 카드 — 일반 카드와 동일 외곽, 파스텔 회색 톤 */
export function CommunityAdCard({ copy }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
      <Text style={styles.copy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 108,
    borderRadius: 14,
    backgroundColor: '#E8E6F0',
    borderWidth: 1,
    borderColor: PastelColors.border,
    justifyContent: 'center',
    ...softShadow,
  },
  adBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  adBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  copy: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    paddingRight: 36,
  },
});
