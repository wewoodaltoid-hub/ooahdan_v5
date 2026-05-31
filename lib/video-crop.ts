/**
 * 영상 CONTAIN 미리보기 ↔ 정규화 크롭(0~1) 변환 · 아카이브 재생용 스타일
 */

export type NormalizedVideoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutRect = { x: number; y: number; width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** resizeMode CONTAIN 시 실제 영상이 그려지는 영역 */
export function computeContainContentRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): LayoutRect {
  if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
    return { x: 0, y: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / videoW, containerH / videoH);
  const width = videoW * scale;
  const height = videoH * scale;
  return {
    x: (containerW - width) / 2,
    y: (containerH - height) / 2,
    width,
    height,
  };
}

/** 편집 UI의 정사각형 크롭(컨테이너 px) → 원본 영상 대비 0~1 */
export function uiSquareCropToNormalized(
  cropX: number,
  cropY: number,
  cropSize: number,
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): NormalizedVideoCrop {
  const content = computeContainContentRect(containerW, containerH, videoW, videoH);
  if (content.width <= 0 || content.height <= 0 || cropSize <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const nx = clamp((cropX - content.x) / content.width, 0, 1);
  const ny = clamp((cropY - content.y) / content.height, 0, 1);
  const nw = clamp(cropSize / content.width, 0.01, 1);
  const nh = clamp(cropSize / content.height, 0.01, 1);

  return {
    x: nx,
    y: ny,
    width: clamp(nw, 0.01, 1 - nx),
    height: clamp(nh, 0.01, 1 - ny),
  };
}

export function hasValidNormalizedCrop(
  crop: NormalizedVideoCrop | null | undefined,
): crop is NormalizedVideoCrop {
  if (!crop) return false;
  return crop.width > 0.001 && crop.height > 0.001;
}

/** 정사각형 뷰포트 안에 크롭 영역만 채우도록 Video 스타일 계산 */
export function getCroppedVideoLayoutStyle(
  containerW: number,
  containerH: number,
  crop: NormalizedVideoCrop,
): { width: number; height: number; marginLeft: number; marginTop: number } {
  const w = containerW / crop.width;
  const h = containerH / crop.height;
  return {
    width: w,
    height: h,
    marginLeft: -crop.x * w,
    marginTop: -crop.y * h,
  };
}

export function dtoToNormalizedCrop(row: {
  crop_x?: number | null;
  crop_y?: number | null;
  crop_width?: number | null;
  crop_height?: number | null;
}): NormalizedVideoCrop | null {
  const x = row.crop_x;
  const y = row.crop_y;
  const width = row.crop_width;
  const height = row.crop_height;
  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }
  const crop = {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(width, 0.01, 1),
    height: clamp(height, 0.01, 1),
  };
  return hasValidNormalizedCrop(crop) ? crop : null;
}
