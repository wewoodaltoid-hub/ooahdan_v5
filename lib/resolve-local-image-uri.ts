import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

import type { WordCardImageSource } from '@/lib/word-card-image-api';

function extFromRemoteUri(uri: string): string {
  const m = uri.match(/\.(png|jpe?g|webp)(\?|$)/i);
  const e = m?.[1]?.toLowerCase();
  if (e === 'png' || e === 'webp') return e;
  return 'jpg';
}

/** FFmpeg overlay 입력용 — 번들/원격 카드 이미지를 캐시 디렉터리 로컬 경로로 변환 */
export async function resolveLocalImagePath(
  source: WordCardImageSource,
  cacheKey: string,
): Promise<string> {
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('이미지 캐시 경로를 사용할 수 없어요.');
  }

  if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    const srcUri = asset.localUri ?? asset.uri;
    if (!srcUri) {
      throw new Error('카드 이미지를 불러오지 못했어요.');
    }
    const dest = `${baseDir}ooah_card_${cacheKey}.png`;
    await FileSystem.copyAsync({ from: srcUri, to: dest });
    return dest;
  }

  const ext = extFromRemoteUri(source);
  const dest = `${baseDir}ooah_card_${cacheKey}.${ext}`;
  const downloaded = await FileSystem.downloadAsync(source, dest);
  if (downloaded.status < 200 || downloaded.status >= 300) {
    throw new Error(`카드 이미지 다운로드 실패 (HTTP ${downloaded.status})`);
  }
  return downloaded.uri;
}
