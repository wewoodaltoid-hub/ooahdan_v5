import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, PastelColors } from '@/constants/theme';

/** Google AdMob 표준 배너 (320×50 dp) */
export const ADMOB_STANDARD_BANNER_HEIGHT = 50;

/** Google AdMob 대형 배너 (320×100 dp) */
export const ADMOB_LARGE_BANNER_HEIGHT = 100;

/**
 * Anchored Adaptive Banner 권장 슬롯 높이.
 * react-native-google-mobile-ads의 BannerAdSize.ANCHORED_ADAPTIVE_BANNER 삽입용.
 */
export const ADMOB_ANCHORED_ADAPTIVE_MAX_HEIGHT = 90;

/** 플레이스홀더·실광고 공통 슬롯 높이 */
export const AD_BANNER_SLOT_HEIGHT = ADMOB_ANCHORED_ADAPTIVE_MAX_HEIGHT;

/** 리스트 끝과 배너 사이 최소 간격 */
const AD_BANNER_CONTENT_GAP = 12;

/** PastelColors.backgroundMint(#E6E6FA)보다 살짝 어두운 회색 톤 */
const BANNER_BACKGROUND = '#D4D4E4';

type AdBannerLayoutOptions = {
  /** 탭 화면에서 하단 탭바 위에 슬롯 배치 */
  avoidTabBar?: boolean;
};

/** Bottom Tab Navigator 밖에서는 0 (useBottomTabBarHeight는 예외를 던짐) */
function useOptionalBottomTabBarHeight(): number {
  const height = useContext(BottomTabBarHeightContext);
  return height ?? 0;
}

type AdBannerPlaceholderProps = AdBannerLayoutOptions & {
  /** true면 화면 하단(탭바·세이프에어리어 반영)에 고정 */
  fixedBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 추후 <BannerAd /> 등 실광고 컴포넌트를 넣을 때 사용 */
  children?: ReactNode;
};

/** 하단에 차지하는 총 높이(슬롯 + 세이프에어리어 + 탭바 + 간격) */
export function useAdBannerReservedHeight(options?: AdBannerLayoutOptions): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const tabOffset = options?.avoidTabBar ? tabBarHeight : 0;
  return AD_BANNER_SLOT_HEIGHT + insets.bottom + tabOffset + AD_BANNER_CONTENT_GAP;
}

export function useAdBannerScrollContentStyle(
  contentStyle?: StyleProp<ViewStyle>,
  options?: AdBannerLayoutOptions,
): StyleProp<ViewStyle> {
  const reserved = useAdBannerReservedHeight(options);
  return useMemo(() => {
    const flat = StyleSheet.flatten(contentStyle);
    const baseBottom =
      typeof flat?.paddingBottom === 'number' ? flat.paddingBottom : 0;
    return [contentStyle, { paddingBottom: baseBottom + reserved }];
  }, [contentStyle, reserved]);
}

/** @deprecated 훅 대신 useAdBannerScrollContentStyle 사용 권장 */
export function adBannerScrollContentStyle(
  contentStyle?: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(contentStyle);
  const baseBottom =
    typeof flat?.paddingBottom === 'number' ? flat.paddingBottom : 0;
  const fallbackReserved =
    AD_BANNER_SLOT_HEIGHT + AD_BANNER_CONTENT_GAP + 34;
  return [
    contentStyle,
    { paddingBottom: baseBottom + fallbackReserved },
  ];
}

export function AdBannerPlaceholder({
  fixedBottom = false,
  avoidTabBar = false,
  style,
  children,
}: AdBannerPlaceholderProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const bottomOffset = avoidTabBar ? tabBarHeight : 0;

  return (
    <View
      style={[
        styles.wrapper,
        fixedBottom && styles.fixedWrapper,
        fixedBottom && { bottom: bottomOffset, paddingBottom: insets.bottom },
        style,
      ]}
      accessibilityRole="none"
      accessibilityLabel="광고 배너 영역"
    >
      <View style={styles.adSlot}>
        {children ?? (
          <>
            <Text style={styles.label}>광고 노출 영역</Text>
            <Text style={styles.hint}>
              AdMob 배너 · 320×50 · Adaptive 최대 {ADMOB_ANCHORED_ADAPTIVE_MAX_HEIGHT}dp
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: BANNER_BACKGROUND,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PastelColors.border,
  },
  fixedWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  adSlot: {
    width: '100%',
    height: AD_BANNER_SLOT_HEIGHT,
    minHeight: ADMOB_STANDARD_BANNER_HEIGHT,
    maxHeight: ADMOB_LARGE_BANNER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    opacity: 0.75,
    textAlign: 'center',
  },
});
