import type { LayoutRect } from '@/lib/video-crop';

/** 정사각형 프레임 좌하단 카드 썸네일 — 한 변이 프레임 대비 차지 비율 */
export const CARD_OVERLAY_WIDTH_FRACTION = 0.28;
/** 프레임(또는 크롭 박스) 가장자리 여백 */
export const CARD_OVERLAY_PADDING_FRACTION = 0.035;
/** 우아카드는 1:1 정사각형 */
export const CARD_IMAGE_ASPECT_RATIO = 1;

/** 정사각형 뷰포트 좌하단 카드 배치(px) */
export function cardOverlayRectInSquare(containerW: number, containerH: number): LayoutRect {
  const size = Math.min(containerW, containerH);
  if (size <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const pad = size * CARD_OVERLAY_PADDING_FRACTION;
  const width = size * CARD_OVERLAY_WIDTH_FRACTION;
  const height = width / CARD_IMAGE_ASPECT_RATIO;
  return {
    x: pad,
    y: containerH - pad - height,
    width,
    height,
  };
}

/** 크롭 가이드 박스 안에서 카드가 표시될 영역(px) */
export function cardOverlayRectInCrop(
  cropX: number,
  cropY: number,
  cropSize: number,
): LayoutRect {
  if (cropSize <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const pad = cropSize * CARD_OVERLAY_PADDING_FRACTION;
  const width = cropSize * CARD_OVERLAY_WIDTH_FRACTION;
  const height = width / CARD_IMAGE_ASPECT_RATIO;
  return {
    x: cropX + pad,
    y: cropY + cropSize - pad - height,
    width,
    height,
  };
}
