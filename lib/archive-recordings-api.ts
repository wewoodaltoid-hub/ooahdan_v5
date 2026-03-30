/**
 * 우아 아카이브: 아카이빙 시에만 Supabase 업로드.
 * - 오디오 → audios 버킷
 * - 영상 → videos 버킷
 * (우아놀이·인박스 임시 저장은 전부 로컬 파일 URI만 사용)
 */

import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

export const AUDIOS_BUCKET = "audios";
export const VIDEOS_BUCKET = "videos";

export type ArchiveRecordingDTO = {
  id: string;
  baby_id: string;
  word: string;
  card_id: string | null;
  audio_url: string | null;
  recording_uri: string | null;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  media_type: string | null;
  word_id?: string | null;
  user_id?: string | null;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_width?: number | null;
  crop_height?: number | null;
  created_at: string;
  archived_at: string;
};

/** UI·재생용 (로컬 ArchivedItem과 호환 필드명) */
export type ArchiveListItem = {
  id: string;
  uri: string;
  word: string;
  cardId: string;
  createdAt: number;
  archivedAt: number;
  trimStartMs: number;
  trimEndMs: number | null;
  mediaType: "audio" | "video";
};

function rowToListItem(row: ArchiveRecordingDTO): ArchiveListItem | null {
  const url = row.audio_url?.trim() || row.recording_uri?.trim();
  if (!url) return null;
  const createdAt = new Date(row.created_at).getTime();
  const archivedAt = new Date(row.archived_at).getTime();
  const mt = row.media_type === "video" ? "video" : "audio";
  return {
    id: row.id,
    uri: url,
    word: row.word ?? "",
    cardId: row.card_id ?? "",
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    archivedAt: Number.isFinite(archivedAt) ? archivedAt : Date.now(),
    trimStartMs: row.trim_start_ms != null ? Number(row.trim_start_ms) : 0,
    trimEndMs: row.trim_end_ms != null ? Number(row.trim_end_ms) : null,
    mediaType: mt,
  };
}

export async function fetchArchiveRecordingsForBaby(
  babyId: string,
): Promise<ArchiveListItem[]> {
  const { data, error } = await supabase
    .from("archive_recordings")
    .select(
      "id, baby_id, word, card_id, audio_url, recording_uri, trim_start_ms, trim_end_ms, media_type, word_id, user_id, crop_x, crop_y, crop_width, crop_height, created_at, archived_at",
    )
    .eq("baby_id", babyId)
    .order("archived_at", { ascending: false });

  if (error) {
    console.warn("archive_recordings 조회 실패:", error.message);
    return [];
  }
  return (data as ArchiveRecordingDTO[])
    .map(rowToListItem)
    .filter((x): x is ArchiveListItem => x != null);
}

function extFromUri(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  if (!m) return "m4a";
  const e = m[1].toLowerCase();
  if (e === "caf" || e === "wav" || e === "mp3" || e === "m4a" || e === "aac") return e;
  if (e === "mp4" || e === "mov" || e === "webm" || e === "m4v") return e;
  return "m4a";
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "aac":
      return "audio/aac";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "m4v":
      return "video/x-m4v";
    default:
      return "audio/mp4";
  }
}

/** 1:1 크롭(우아스냅 등) — 비디오 레이아웃 대비 정규화 0~1, 선택 */
export type VideoCropNormalized = {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

export type PersistInboxRecordingParams = {
  localUri: string;
  babyId: string;
  word: string;
  cardId: string;
  trimStartMs: number;
  trimEndMs: number;
  wordId?: string | null;
  mediaType?: "audio" | "video";
  /** 비디오 아카이빙 시에만 사용 (0~1 정규화 좌표) */
  videoCrop?: VideoCropNormalized;
};

/**
 * 로컬 파일을 audios 또는 videos 버킷에 업로드 후 archive_recordings INSERT
 * (우아놀이 종료 시 업로드하지 않음 — 아카이빙 시에만 호출)
 */
export async function persistInboxRecordingToArchive(
  params: PersistInboxRecordingParams,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user?.id) {
    return {
      ok: false,
      message: sessionError?.message ?? "로그인이 필요해요.",
    };
  }

  const { localUri, babyId, word, cardId, trimStartMs, trimEndMs } = params;
  const mediaType = params.mediaType ?? "audio";
  const bucket = mediaType === "video" ? VIDEOS_BUCKET : AUDIOS_BUCKET;
  let ext = extFromUri(localUri);
  if (
    mediaType === "video" &&
    ext !== "mp4" &&
    ext !== "mov" &&
    ext !== "webm" &&
    ext !== "m4v"
  ) {
    ext = "mp4";
  }
  const objectPath = `${babyId}_${Date.now()}.${ext}`;

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "파일을 읽지 못했어요.",
    };
  }

  const body = decode(base64);
  const contentType = contentTypeForExt(ext);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, body, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);

  const publicUrl = urlData.publicUrl;

  const insertRow: Record<string, unknown> = {
    baby_id: babyId,
    word,
    card_id: cardId || null,
    audio_url: publicUrl,
    recording_uri: publicUrl,
    trim_start_ms: Math.max(0, Math.round(trimStartMs)),
    trim_end_ms: Math.round(trimEndMs),
    media_type: mediaType,
  };
  /** word_id: words.id FK (UUID). 카드 ID가 UUID일 때만 전달 — 오디오·비디오 동일 */
  if (params.wordId) {
    insertRow.word_id = params.wordId;
  }

  /** videoLayout 대비 0~1 정규화 → archive_recordings.crop_* (DOUBLE PRECISION) */
  const crop = params.videoCrop;
  if (mediaType === "video" && crop) {
    insertRow.crop_x = crop.cropX;
    insertRow.crop_y = crop.cropY;
    insertRow.crop_width = crop.cropWidth;
    insertRow.crop_height = crop.cropHeight;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("archive_recordings")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(bucket).remove([uploadData.path]).catch(() => {});
    return { ok: false, message: insertError.message };
  }

  return { ok: true, id: String(inserted?.id ?? "") };
}

/** 해당 아이 아카이브에 단어가 하나라도 있는지 (승급 UI 분기) */
export async function babyHasArchiveWord(
  babyId: string,
  word: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("archive_recordings")
    .select("id")
    .eq("baby_id", babyId)
    .eq("word", word)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}
