import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { cardOverlayRectInSquare } from '@/lib/card-overlay-layout';
import { resolveLocalImagePath } from '@/lib/resolve-local-image-uri';
import { fetchWordCardImageSource } from '@/lib/word-card-image-api';
import { hasValidNormalizedCrop, type NormalizedVideoCrop } from '@/lib/video-crop';

const OUTPUT_SIZE = 1080;

function sanitizeFilePart(raw: string): string {
  return raw.replace(/[^\w가-힣.-]+/g, '_').slice(0, 24) || 'archive';
}

function escapeFfmpegPath(uri: string): string {
  return uri.replace(/^file:\/\//, '').replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

function buildVideoCropFilter(crop: NormalizedVideoCrop | null): string {
  if (hasValidNormalizedCrop(crop)) {
    return `crop=iw*${crop.width}:ih*${crop.height}:iw*${crop.x}:ih*${crop.y}`;
  }
  return 'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2';
}

function buildTrimVideoFilter(trimStartMs: number, trimEndMs: number | null): string {
  const startSec = Math.max(0, trimStartMs) / 1000;
  if (trimEndMs != null && trimEndMs > trimStartMs) {
    const endSec = trimEndMs / 1000;
    return `trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS`;
  }
  return `trim=start=${startSec},setpts=PTS-STARTPTS`;
}

function buildTrimAudioFilter(trimStartMs: number, trimEndMs: number | null): string {
  const startSec = Math.max(0, trimStartMs) / 1000;
  if (trimEndMs != null && trimEndMs > trimStartMs) {
    const endSec = trimEndMs / 1000;
    return `atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS`;
  }
  return `atrim=start=${startSec},asetpts=PTS-STARTPTS`;
}

async function probeHasAudio(videoPath: string): Promise<boolean> {
  try {
    const { FFprobeKit } = await import('ffmpeg-kit-react-native');
    const session = await FFprobeKit.getMediaInformation(escapeFfmpegPath(videoPath));
    const info = session.getMediaInformation();
    if (!info) return false;
    const streams = info.getStreams?.() ?? [];
    return streams.some((s) => s.getType?.() === 'audio');
  } catch {
    return true;
  }
}

export type EncodeArchiveVideoParams = {
  localVideoPath: string;
  cardId: string;
  recordId: string;
  trimStartMs: number;
  trimEndMs: number | null;
  videoCrop: NormalizedVideoCrop | null;
  onProgress?: (ratio: number) => void;
};

/**
 * trim + crop + 좌하단 카드 PNG overlay → mp4 인코딩 (기기 내부 FFmpeg)
 */
export async function encodeArchiveVideoWithOverlay(
  params: EncodeArchiveVideoParams,
): Promise<{ ok: true; outputPath: string } | { ok: false; message: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, message: '웹에서는 영상 변환을 지원하지 않아요.' };
  }

  let FFmpegKit: typeof import('ffmpeg-kit-react-native').FFmpegKit;
  let ReturnCode: typeof import('ffmpeg-kit-react-native').ReturnCode;
  try {
    const mod = await import('ffmpeg-kit-react-native');
    FFmpegKit = mod.FFmpegKit;
    ReturnCode = mod.ReturnCode;
  } catch {
    return {
      ok: false,
      message:
        '영상 변환 모듈을 불러오지 못했어요. Expo Go가 아닌 개발 빌드(앱 설치본)에서 npx expo prebuild 후 다시 시도해 주세요.',
    };
  }

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) {
    return { ok: false, message: '저장 경로를 사용할 수 없어요.' };
  }

  const outputPath = `${baseDir}ooahdan_export_${sanitizeFilePart(params.recordId)}.mp4`;

  try {
    const cardSource = await fetchWordCardImageSource(params.cardId);
    const cardLocalPath = await resolveLocalImagePath(cardSource, params.recordId.slice(0, 8));

    const overlay = cardOverlayRectInSquare(OUTPUT_SIZE, OUTPUT_SIZE);
    const overlayW = Math.max(1, Math.round(overlay.width));
    const overlayH = Math.max(1, Math.round(overlay.height));
    const overlayX = Math.max(0, Math.round(overlay.x));
    const overlayY = Math.max(0, Math.round(overlay.y));

    const videoTrim = buildTrimVideoFilter(params.trimStartMs, params.trimEndMs);
    const cropFilter = buildVideoCropFilter(params.videoCrop);
    const videoPath = escapeFfmpegPath(params.localVideoPath);
    const cardPath = escapeFfmpegPath(cardLocalPath);
    const outPath = escapeFfmpegPath(outputPath);

    const hasAudio = await probeHasAudio(params.localVideoPath);
    const audioTrim = buildTrimAudioFilter(params.trimStartMs, params.trimEndMs);

    const filterComplex = hasAudio
      ? `[0:v]${videoTrim},${cropFilter},scale=${OUTPUT_SIZE}:${OUTPUT_SIZE}[main];` +
        `[1:v]scale=${overlayW}:${overlayH}[card];` +
        `[main][card]overlay=${overlayX}:${overlayY}:format=auto[outv];` +
        `[0:a]${audioTrim}[outa]`
      : `[0:v]${videoTrim},${cropFilter},scale=${OUTPUT_SIZE}:${OUTPUT_SIZE}[main];` +
        `[1:v]scale=${overlayW}:${overlayH}[card];` +
        `[main][card]overlay=${overlayX}:${overlayY}:format=auto[outv]`;

    const mapArgs = hasAudio ? '-map "[outv]" -map "[outa]"' : '-map "[outv]"';
    const audioCodec = hasAudio ? '-c:a aac -b:a 128k' : '-an';

    const command =
      `-y -i '${videoPath}' -i '${cardPath}' ` +
      `-filter_complex "${filterComplex}" ` +
      `${mapArgs} -c:v libx264 -preset fast -crf 23 ${audioCodec} -movflags +faststart '${outPath}'`;

    const durationMs =
      params.trimEndMs != null && params.trimEndMs > params.trimStartMs
        ? params.trimEndMs - params.trimStartMs
        : null;

    await new Promise<void>((resolve, reject) => {
      FFmpegKit.executeAsync(
        command,
        async (session) => {
          try {
            const code = await session.getReturnCode();
            if (ReturnCode.isSuccess(code)) {
              resolve();
            } else {
              const logs = await session.getAllLogsAsString();
              reject(new Error(logs?.slice(-400) || 'FFmpeg 인코딩에 실패했어요.'));
            }
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        () => {},
        (statistics) => {
          if (!params.onProgress || durationMs == null || durationMs <= 0) return;
          const time = statistics.getTime?.() ?? 0;
          params.onProgress(Math.min(0.98, Math.max(0, time / durationMs)));
        },
      );
    });

    const fileInfo = await FileSystem.getInfoAsync(outputPath);
    if (!fileInfo.exists || (fileInfo.size != null && fileInfo.size <= 0)) {
      return { ok: false, message: '변환된 영상 파일이 비어 있어요.' };
    }

    params.onProgress?.(1);
    return { ok: true, outputPath };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (detail.includes('Cannot find module') || detail.includes('Native module')) {
      return {
        ok: false,
        message:
          '영상 변환 네이티브 모듈이 없어요. npx expo prebuild 후 개발 빌드로 앱을 설치해 주세요.',
      };
    }
    return { ok: false, message: detail || '영상 변환에 실패했어요.' };
  }
}
