import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PastelColors, Fonts, primaryCtaPadding } from '@/constants/theme';

type CropNorm = { x: number; y: number; w: number; h: number };

type Props = {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onCropped: (uri: string) => void;
};

const MIN_NORM = 0.12;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeContainedRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
) {
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  const x = (containerW - width) / 2;
  const y = (containerH - height) / 2;
  return { x, y, width, height };
}

export function CommunityImageFreeCropModal({
  visible,
  imageUri,
  onClose,
  onCropped,
}: Props) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const canvasH = Math.min(windowH * 0.52, 420);
  const canvasW = windowW - 32;

  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropNorm>({ x: 0, y: 0, w: 1, h: 1 });
  const [applying, setApplying] = useState(false);

  const cropRef = useRef(crop);
  cropRef.current = crop;

  const imageRect = useMemo(() => {
    if (!imageSize) return null;
    return computeContainedRect(canvasW, canvasH, imageSize.w, imageSize.h);
  }, [canvasW, canvasH, imageSize]);

  useEffect(() => {
    if (!visible || !imageUri) return;
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setImageSize(null);
    Image.getSize(
      imageUri,
      (w, h) => setImageSize({ w, h }),
      () => setImageSize({ w: 1000, h: 1000 }),
    );
  }, [visible, imageUri]);

  const normToScreen = useCallback(
    (norm: CropNorm) => {
      if (!imageRect) return { left: 0, top: 0, width: 0, height: 0 };
      return {
        left: imageRect.x + norm.x * imageRect.width,
        top: imageRect.y + norm.y * imageRect.height,
        width: norm.w * imageRect.width,
        height: norm.h * imageRect.height,
      };
    },
    [imageRect],
  );

  const moveResponder = useMemo(() => {
    let startCrop: CropNorm = cropRef.current;
    let startX = 0;
    let startY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, g) => {
        startCrop = { ...cropRef.current };
        startX = g.x0;
        startY = g.y0;
      },
      onPanResponderMove: (_, g) => {
        if (!imageRect) return;
        const dx = (g.moveX - startX) / imageRect.width;
        const dy = (g.moveY - startY) / imageRect.height;
        const x = clamp(startCrop.x + dx, 0, 1 - startCrop.w);
        const y = clamp(startCrop.y + dy, 0, 1 - startCrop.h);
        setCrop({ ...startCrop, x, y });
      },
    });
  }, [imageRect]);

  const resizeResponder = useMemo(() => {
    let startCrop: CropNorm = cropRef.current;
    let startX = 0;
    let startY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, g) => {
        startCrop = { ...cropRef.current };
        startX = g.x0;
        startY = g.y0;
      },
      onPanResponderMove: (_, g) => {
        if (!imageRect) return;
        const dx = (g.moveX - startX) / imageRect.width;
        const dy = (g.moveY - startY) / imageRect.height;
        const w = clamp(startCrop.w + dx, MIN_NORM, 1 - startCrop.x);
        const h = clamp(startCrop.h + dy, MIN_NORM, 1 - startCrop.y);
        setCrop({ ...startCrop, w, h });
      },
    });
  }, [imageRect]);

  const handleApply = async () => {
    if (!imageUri || !imageSize) return;
    setApplying(true);
    try {
      const originX = Math.round(crop.x * imageSize.w);
      const originY = Math.round(crop.y * imageSize.h);
      const width = Math.max(1, Math.round(crop.w * imageSize.w));
      const height = Math.max(1, Math.round(crop.h * imageSize.h));

      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      onCropped(result.uri);
      onClose();
    } catch {
      Alert.alert('자르기 실패', '사진을 자르지 못했어요. 다시 시도해 주세요.');
    } finally {
      setApplying(false);
    }
  };

  const handleUseOriginal = () => {
    if (!imageUri) return;
    onCropped(imageUri);
    onClose();
  };

  const box = normToScreen(crop);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>사진 자르기</Text>
        <Text style={styles.hint}>영역을 드래그·모서리를 당겨 원하는 만큼 자유롭게 잘라 주세요.</Text>

        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
          {!imageUri || !imageSize || !imageRect ? (
            <ActivityIndicator size="large" color={PastelColors.accent} />
          ) : (
            <>
              <Image
                source={{ uri: imageUri }}
                style={{
                  position: 'absolute',
                  left: imageRect.x,
                  top: imageRect.y,
                  width: imageRect.width,
                  height: imageRect.height,
                }}
                resizeMode="contain"
              />
              <View style={styles.overlay} pointerEvents="box-none">
                <View
                  style={[
                    styles.dim,
                    { left: 0, top: 0, width: canvasW, height: Math.max(0, box.top) },
                  ]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      left: 0,
                      top: box.top,
                      width: Math.max(0, box.left),
                      height: box.height,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      left: box.left + box.width,
                      top: box.top,
                      width: Math.max(0, canvasW - box.left - box.width),
                      height: box.height,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      left: 0,
                      top: box.top + box.height,
                      width: canvasW,
                      height: Math.max(0, canvasH - box.top - box.height),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.cropBox,
                    {
                      left: box.left,
                      top: box.top,
                      width: box.width,
                      height: box.height,
                    },
                  ]}
                  {...moveResponder.panHandlers}
                >
                  <View
                    style={styles.resizeHandle}
                    {...resizeResponder.panHandlers}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={onClose} disabled={applying}>
            <Text style={styles.secondaryBtnText}>취소</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleUseOriginal} disabled={applying}>
            <Text style={styles.secondaryBtnText}>원본 사용</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, applying && styles.primaryBtnDisabled]}
            onPress={() => void handleApply()}
            disabled={applying || !imageSize}
          >
            {applying ? (
              <ActivityIndicator size="small" color={PastelColors.buttonTextOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>적용</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PastelColors.background,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 19,
  },
  canvas: {
    alignSelf: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  resizeHandle: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PastelColors.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PastelColors.surface,
    borderWidth: 1,
    borderColor: PastelColors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryCtaPadding,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
});
