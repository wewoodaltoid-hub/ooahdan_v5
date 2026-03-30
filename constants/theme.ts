/**
 * 우아단 — 파스텔 보라(Pastel Purple) · 가족 앨범 느낌의 몽글몽글한 톤
 * primary #B19CD9, 배경 #FBF9FF, 서피스 화이트 + 연한 파스텔 그림자
 */

import { Platform, StyleSheet } from 'react-native';

/** 디자인 시스템 팔레트 (명시적 사용) */
export const ThemePalette = {
  primary: '#B19CD9',
  primaryLight: '#E6E6FA',
  background: '#FBF9FF',
  surface: '#FFFFFF',
  textMain: '#4A4453',
  textMuted: '#8E8A95',
  border: '#EDE8F4',
  /** 우아팬클럽 비활성 CTA */
  buttonViewerDisabled: '#E8E6ED',
  /** 칩·보조 면 — 뽀얀 연보라 */
  chipSoft: '#F0EDF8',
} as const;

/** 메인 CTA 권장 여백 */
export const primaryCtaPadding = {
  paddingVertical: 18,
  paddingHorizontal: 28,
} as const;

/** 플래시카드·카드 — 파스텔 보라 베이스의 부드러운 그림자 */
export const flashcardShadow = {
  shadowColor: '#B19CD9',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 3,
  ...Platform.select({
    ios: { shadowOffset: { width: 0, height: 4 } },
    default: {},
  }),
};

/** 일반 카드·버튼용 (기존 import 호환) */
export const cardShadow = flashcardShadow;

/** 탭·작은 칩용 살짝 가벼운 그림자 */
export const softShadow = {
  shadowColor: '#B19CD9',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
  ...Platform.select({
    ios: { shadowOffset: { width: 0, height: 2 } },
    default: {},
  }),
};

/** 단어 카드 등 — 화이트 서피스 + 라운드 + 테두리 + 그림자 (StyleSheet 배열용) */
export const premiumFlashcardSurface = StyleSheet.flatten([
  {
    backgroundColor: ThemePalette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ThemePalette.border,
  },
  flashcardShadow,
]);

/** 레거시: 칩·행 배경 번갈아 쓰기 (파스텔 보라 계열) */
export const PASTEL_CARD_COLORS = [
  ThemePalette.surface,
  ThemePalette.chipSoft,
  ThemePalette.surface,
  ThemePalette.primaryLight,
] as const;

export function getPastelCardColor(index: number): string {
  return PASTEL_CARD_COLORS[index % PASTEL_CARD_COLORS.length];
}

const tintColorLight = ThemePalette.primary;

/** 앱 전역 색 (기존 PastelColors 이름 유지) */
export const PastelColors = {
  background: ThemePalette.background,
  accent: ThemePalette.primary,
  text: ThemePalette.textMain,
  textSecondary: ThemePalette.textMuted,
  buttonPrimary: ThemePalette.primary,
  buttonTextOnPrimary: '#FFFFFF',
  cardBg: ThemePalette.surface,
  surface: ThemePalette.surface,
  primary: ThemePalette.primary,
  primaryLight: ThemePalette.primaryLight,
  border: ThemePalette.border,
  backgroundMint: ThemePalette.primaryLight,
  segmentHighlight: ThemePalette.primary,
  /** 긴급·강조(카운트다운 등) — 파스텔에 맞는 뮤트 톤 */
  urgentOrange: '#A89BC8',
  recordDot: '#B8A8D4',
  buttonViewerDisabled: ThemePalette.buttonViewerDisabled,
  buttonViewerDisabledText: ThemePalette.textMuted,
  pink: ThemePalette.primaryLight,
  blue: ThemePalette.chipSoft,
  yellow: ThemePalette.primaryLight,
  buttonText: ThemePalette.textMain,
  cardShadow: 'rgba(177,156,217,0.06)',
};

export const Colors = {
  light: {
    text: PastelColors.text,
    background: PastelColors.background,
    tint: tintColorLight,
    icon: PastelColors.textSecondary,
    tabIconDefault: PastelColors.textSecondary,
    tabIconSelected: tintColorLight,
    link: PastelColors.accent,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
    link: '#fff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
