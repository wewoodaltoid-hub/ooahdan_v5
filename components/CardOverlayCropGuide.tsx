import { Image, StyleSheet, View } from 'react-native';

import { cardOverlayRectInCrop } from '@/lib/card-overlay-layout';
import type { WordCardImageSource } from '@/lib/word-card-image-api';

type Props = {
  image: WordCardImageSource | null | undefined;
  cropX: number;
  cropY: number;
  cropSize: number;
  /** 0~1, 기본 0.7 — 카드 미리보기 불투명도 */
  opacity?: number;
};

/** 크롭 편집 시 카드가 아카이브에 표시될 위치·비율 가이드 */
export function CardOverlayCropGuide({
  image,
  cropX,
  cropY,
  cropSize,
  opacity = 0.7,
}: Props) {
  if (!image || cropSize <= 0) return null;

  const rect = cardOverlayRectInCrop(cropX, cropY, cropSize);
  if (rect.width <= 0 || rect.height <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.guide,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          opacity,
        },
      ]}
    >
      <Image
        source={typeof image === 'string' ? { uri: image } : image}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.border} />
    </View>
  );
}

const styles = StyleSheet.create({
  guide: {
    position: 'absolute',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderStyle: 'dashed',
  },
});
