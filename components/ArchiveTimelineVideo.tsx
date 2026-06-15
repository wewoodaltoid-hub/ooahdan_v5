import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Video, ResizeMode, type VideoProps } from 'expo-av';

import { CardOverlayBadge } from '@/components/CardOverlayBadge';
import type { WordCardImageSource } from '@/lib/word-card-image-api';

type Props = Omit<VideoProps, 'style' | 'ref'> & {
  cardImage: WordCardImageSource | null | undefined;
  containerStyle?: VideoProps['style'];
  videoRef?: (instance: Video | null) => void;
};

/** 아카이브 타임라인 — 정사각형 영상 + 좌하단 카드 썸네일 */
export function ArchiveTimelineVideo({
  cardImage,
  containerStyle,
  videoRef,
  ...videoProps
}: Props) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const handleLayout = useCallback((width: number, height: number) => {
    setFrame({ width, height });
  }, []);

  return (
    <View
      style={[styles.wrap, containerStyle]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        handleLayout(width, height);
      }}
    >
      <Video
        ref={videoRef}
        {...videoProps}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
      />
      <CardOverlayBadge image={cardImage} width={frame.width} height={frame.height} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
