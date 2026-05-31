import { forwardRef, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Video, ResizeMode, type VideoProps } from 'expo-av';

import {
  getCroppedVideoLayoutStyle,
  hasValidNormalizedCrop,
  type NormalizedVideoCrop,
} from '@/lib/video-crop';

type Props = Omit<VideoProps, 'style'> & {
  crop: NormalizedVideoCrop | null | undefined;
  containerStyle?: StyleProp<ViewStyle>;
};

/** 1:1 컨테이너 안에 저장된 크롭(0~1)만 보이도록 영상 배치 */
export const CroppedSquareVideo = forwardRef<Video, Props>(function CroppedSquareVideo(
  { crop, containerStyle, resizeMode, ...videoProps },
  ref,
) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const applied = useMemo(() => {
    if (!hasValidNormalizedCrop(crop) || layout.width <= 0 || layout.height <= 0) {
      return null;
    }
    return getCroppedVideoLayoutStyle(layout.width, layout.height, crop);
  }, [crop, layout.width, layout.height]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      <Video
        ref={ref}
        {...videoProps}
        style={
          applied
            ? [
                styles.video,
                {
                  width: applied.width,
                  height: applied.height,
                  marginLeft: applied.marginLeft,
                  marginTop: applied.marginTop,
                },
              ]
            : styles.videoFill
        }
        resizeMode={applied ? ResizeMode.STRETCH : (resizeMode ?? ResizeMode.COVER)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  videoFill: {
    width: '100%',
    height: '100%',
  },
});
