import { Platform } from 'react-native';
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

async function requestGallerySavePermission(): Promise<{ ok: true } | { ok: false; message: string }> {
  const granularPermissions =
    Platform.OS === 'android' ? (['video'] as MediaLibrary.GranularPermission[]) : undefined;

  const perm = await MediaLibrary.requestPermissionsAsync(true, granularPermissions);
  if (perm.granted || perm.status === 'granted') {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      '갤러리 저장 권한이 필요해요. 설정 > 우아단 > 사진(또는 미디어)에서 저장을 허용해 주세요.',
  };
}

async function saveLocalVideoToGallery(localUri: string): Promise<void> {
  try {
    await MediaLibrary.saveToLibraryAsync(localUri);
    return;
  } catch {
    /* saveToLibraryAsync 실패 시 createAssetAsync로 재시도 */
  }

  const asset = await MediaLibrary.createAssetAsync(localUri);
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

  const permission = await requestGallerySavePermission();
  if (!permission.ok) {
    return permission;
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    return { ok: false, message: '저장 경로를 사용할 수 없어요.' };
  }

  const ext = extFromUri(remoteUri);
  const localPath = `${baseDir}ooahdan_${sanitizeFilePart(params.word)}_${params.recordId.slice(0, 8)}.${ext}`;

  try {
    const downloaded = await FileSystem.downloadAsync(remoteUri, localPath);
    if (downloaded.status < 200 || downloaded.status >= 300) {
      return {
        ok: false,
        message: `영상을 받아오지 못했어요. (HTTP ${downloaded.status})`,
      };
    }

    const fileInfo = await FileSystem.getInfoAsync(downloaded.uri);
    if (!fileInfo.exists || (fileInfo.size != null && fileInfo.size <= 0)) {
      return { ok: false, message: '다운로드한 영상 파일이 비어 있어요.' };
    }

    await saveLocalVideoToGallery(downloaded.uri);
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (Platform.OS === 'android' && detail.includes('MEDIA_LIBRARY')) {
      return {
        ok: false,
        message:
          'Expo Go에서는 갤러리 저장이 제한될 수 있어요. 개발 빌드(앱 설치본)에서 다시 시도해 주세요.',
      };
    }
    return {
      ok: false,
      message: detail || '영상을 저장하지 못했어요.',
    };
  }
}
