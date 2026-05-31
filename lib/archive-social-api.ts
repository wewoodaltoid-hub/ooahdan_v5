/**
 * 아카이브 녹음 — 가족 공유 좋아요 · 댓글 API
 */

import { supabase } from '@/lib/supabase';

export type ArchiveComment = {
  id: string;
  recordingId: string;
  userId: string;
  body: string;
  authorDisplayName: string;
  authorRelation: string;
  createdAt: number;
  isMine: boolean;
};

export type ArchiveRecordingSocial = {
  likeCount: number;
  likedByMe: boolean;
  comments: ArchiveComment[];
};

export type ArchiveSocialMap = Record<string, ArchiveRecordingSocial>;

type LikeRow = { recording_id: string; user_id: string };
type CommentRow = {
  id: string;
  recording_id: string;
  user_id: string;
  body: string;
  author_display_name: string | null;
  author_relation: string | null;
  created_at: string;
};

function emptySocial(): ArchiveRecordingSocial {
  return { likeCount: 0, likedByMe: false, comments: [] };
}

/** 아이(baby) 단위로 모든 녹음의 좋아요·댓글 일괄 로드 */
export async function fetchArchiveSocialForBaby(
  babyId: string,
): Promise<ArchiveSocialMap> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? null;

  const [likesRes, commentsRes] = await Promise.all([
    supabase
      .from('archive_recording_likes')
      .select('recording_id, user_id')
      .eq('baby_id', babyId),
    supabase
      .from('archive_recording_comments')
      .select(
        'id, recording_id, user_id, body, author_display_name, author_relation, created_at',
      )
      .eq('baby_id', babyId)
      .order('created_at', { ascending: true }),
  ]);

  const map: ArchiveSocialMap = {};

  if (likesRes.error) {
    console.warn('archive likes 조회 실패:', likesRes.error.message);
  } else {
    const byRecording = new Map<string, { count: number; likedByMe: boolean }>();
    for (const row of (likesRes.data ?? []) as LikeRow[]) {
      const cur = byRecording.get(row.recording_id) ?? { count: 0, likedByMe: false };
      cur.count += 1;
      if (myUserId && row.user_id === myUserId) cur.likedByMe = true;
      byRecording.set(row.recording_id, cur);
    }
    byRecording.forEach((v, recordingId) => {
      map[recordingId] = {
        likeCount: v.count,
        likedByMe: v.likedByMe,
        comments: [],
      };
    });
  }

  if (commentsRes.error) {
    console.warn('archive comments 조회 실패:', commentsRes.error.message);
  } else {
    for (const row of (commentsRes.data ?? []) as CommentRow[]) {
      const existing = map[row.recording_id] ?? emptySocial();
      const createdAt = new Date(row.created_at).getTime();
      existing.comments.push({
        id: row.id,
        recordingId: row.recording_id,
        userId: row.user_id,
        body: row.body,
        authorDisplayName: row.author_display_name?.trim() || '가족',
        authorRelation: row.author_relation?.trim() || '가족',
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        isMine: myUserId != null && row.user_id === myUserId,
      });
      map[row.recording_id] = existing;
    }
  }

  return map;
}

export async function toggleArchiveRecordingLike(
  recordingId: string,
  babyId: string,
  currentlyLiked: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('archive_recording_likes')
      .delete()
      .eq('recording_id', recordingId)
      .eq('baby_id', babyId);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const { error } = await supabase.from('archive_recording_likes').insert({
    recording_id: recordingId,
    baby_id: babyId,
    user_id: user.id,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function addArchiveRecordingComment(params: {
  recordingId: string;
  babyId: string;
  body: string;
  authorDisplayName: string;
  authorRelation: string;
}): Promise<{ ok: boolean; message?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const trimmed = params.body.trim();
  if (!trimmed) return { ok: false, message: '댓글을 입력해 주세요.' };

  const { error } = await supabase.from('archive_recording_comments').insert({
    recording_id: params.recordingId,
    baby_id: params.babyId,
    user_id: user.id,
    body: trimmed,
    author_display_name: params.authorDisplayName.trim() || '가족',
    author_relation: params.authorRelation.trim() || '가족',
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteArchiveRecordingComment(
  commentId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('archive_recording_comments')
    .delete()
    .eq('id', commentId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** 단어별 총 좋아요 수 (목록 정렬용) */
export function sumLikesForWord(
  word: string,
  archive: { id: string; word: string }[],
  social: ArchiveSocialMap,
): number {
  return archive
    .filter((r) => r.word === word)
    .reduce((sum, r) => sum + (social[r.id]?.likeCount ?? 0), 0);
}
