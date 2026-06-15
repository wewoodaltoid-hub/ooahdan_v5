import { Image, StyleSheet, View } from 'react-native';

import { cardOverlayRectInSquare } from '@/lib/card-overlay-layout';
import type { WordCardImageSource } from '@/lib/word-card-image-api';
import { flashcardShadow } from '@/constants/theme';

type Props = {
  image: WordCardImageSource | null | undefined;
  width: number;
  height: number;
};

/** 정사각형 영상 프레임 좌하단 카드 썸네일 */
export function CardOverlayBadge({ image, width, height }: Props) {
  if (!image || width <= 0 || height <= 0) return null;

  const rect = cardOverlayRectInSquare(width, height);
  if (rect.width <= 0 || rect.height <= 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.badge,
          {
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          },
        ]}
      >
        <Image
          source={typeof image === 'string' ? { uri: image } : image}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#fff',
    ...flashcardShadow,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
