import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

function sanitizeFilePart(raw: string): string {
  return raw.replace(/[^\w가-힣.-]+/g, '_').slice(0, 24) || 'archive';
}

function extFromUri(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  const e = m?.[1]?.toLowerCase();
  if (e === 'mov' || e === 'webm' || e === 'm4v') return e;
  return 'mp4';
}

/**
 * 아카이브 영상 URL → 기기 갤러리(사진 앱) 저장
 */
export async function downloadArchiveVideoToGallery(params: {
  uri: string;
  word: string;
  recordId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const remoteUri = params.uri?.trim();
  if (!remoteUri) {
    return { ok: false, message: '저장할 영상 주소가 없어요.' };
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    return {
      ok: false,
      message: '갤러리 저장 권한이 필요해요. 설정에서 사진 접근을 허용해 주세요.',
    };
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    return { ok: false, message: '저장 경로를 사용할 수 없어요.' };
  }

  const ext = extFromUri(remoteUri);
  const localPath = `${baseDir}ooahdan_${sanitizeFilePart(params.word)}_${params.recordId.slice(0, 8)}.${ext}`;

  try {
    const downloaded = await FileSystem.downloadAsync(remoteUri, localPath);
    const asset = await MediaLibrary.createAssetAsync(downloaded.uri);
    try {
      const albumName = '우아단';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
    } catch {
      /* 앨범 없어도 갤러리에는 저장됨 */
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '영상을 저장하지 못했어요.',
    };
  }
}
