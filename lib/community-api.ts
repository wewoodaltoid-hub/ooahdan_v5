/**
 * 커뮤니티 피드 — Supabase
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { formatCommunityAuthorLabel } from '@/lib/community-nickname';
import { supabase } from '@/lib/supabase';

export type CommunityCategory = 'parenting_tip' | 'free_talk';

export type CommunityPost = {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  imageUrl: string | null;
  imageUrls: string[];
  authorUserId: string | null;
  authorDisplayName: string;
  babyMonths: number | null;
  /** UI용: "닉네임 - N개월 양육" */
  authorLabel: string;
  likesCount: number;
  commentsCount: number;
  hotScore: number;
  createdAt: number;
  likedByMe: boolean;
};

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  authorDisplayName: string;
  babyMonths: number | null;
  authorLabel: string;
  createdAt: number;
  isMine: boolean;
  /** 댓글 작성자가 해당 게시글 원글 작성자인지 */
  isPostAuthor: boolean;
};

export const COMMUNITY_IMAGES_BUCKET = 'community-images';
export const MAX_COMMUNITY_POST_IMAGES = 3;

type PostRow = {
  id: string;
  category: string | null;
  title: string | null;
  body: string | null;
  /** 예전 DB — 본문. body와 동일 값으로 유지 */
  content: string | null;
  image_url: string | null;
  image_urls: unknown;
  author_user_id: string | null;
  /** 예전 DB 스키마 — category와 동일 값으로 유지 */
  tag: string | null;
  author_display_name: string | null;
  author_relation: string | null;
  baby_months: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  author_display_name: string | null;
  author_relation: string | null;
  baby_months: number | null;
  created_at: string;
};

const VALID_CATEGORIES: CommunityCategory[] = ['parenting_tip', 'free_talk'];

const POST_SELECT_WITH_IMAGE =
  'id, category, tag, title, body, content, image_url, image_urls, author_user_id, author_display_name, author_relation, baby_months, likes_count, comments_count, created_at';

const POST_SELECT_LEGACY =
  'id, category, tag, title, body, content, author_user_id, author_display_name, author_relation, baby_months, likes_count, comments_count, created_at';

function isMissingColumn(message: string | undefined, column: string): boolean {
  return !!message?.includes(column) && !!message?.includes('does not exist');
}

function isMissingImageUrlColumn(message: string | undefined): boolean {
  return isMissingColumn(message, 'image_url');
}

function isMissingImageUrlsColumn(message: string | undefined): boolean {
  return isMissingColumn(message, 'image_urls');
}

function parsePostImageUrls(row: PostRow): string[] {
  const urls: string[] = [];
  const raw = row.image_urls;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && item.trim()) urls.push(item.trim());
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) urls.push(item.trim());
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (urls.length === 0) {
    const single = row.image_url?.trim();
    if (single) urls.push(single);
  }
  return urls.slice(0, MAX_COMMUNITY_POST_IMAGES);
}

function isMissingTagColumn(message: string | undefined): boolean {
  return isMissingColumn(message, 'tag');
}

function isMissingContentColumn(message: string | undefined): boolean {
  return isMissingColumn(message, 'content');
}

function isMissingBodyColumn(message: string | undefined): boolean {
  return isMissingColumn(message, 'body');
}

function stripPostSelectColumns(select: string, columns: readonly string[]): string {
  let result = select;
  for (const col of columns) {
    result = result.replace(`, ${col}`, '');
  }
  return result;
}

function postSelectVariants(): string[] {
  const bases = [POST_SELECT_WITH_IMAGE, POST_SELECT_LEGACY];
  const stripSets: (readonly string[])[] = [
    [],
    ['tag'],
    ['content'],
    ['image_url'],
    ['image_urls'],
    ['image_url', 'image_urls'],
    ['tag', 'content'],
    ['tag', 'image_url'],
    ['tag', 'image_urls'],
    ['content', 'image_url'],
    ['content', 'image_urls'],
    ['tag', 'content', 'image_url'],
    ['tag', 'content', 'image_urls'],
    ['tag', 'content', 'image_url', 'image_urls'],
    ['body'],
    ['body', 'tag'],
    ['body', 'content'],
    ['body', 'tag', 'content'],
  ];
  const seen = new Set<string>();
  const variants: string[] = [];
  for (const base of bases) {
    for (const strip of stripSets) {
      const sel = stripPostSelectColumns(base, strip);
      if (!seen.has(sel)) {
        seen.add(sel);
        variants.push(sel);
      }
    }
  }
  return variants;
}

function shouldRetryPostSelect(message: string | undefined): boolean {
  return (
    isMissingImageUrlColumn(message) ||
    isMissingImageUrlsColumn(message) ||
    isMissingTagColumn(message) ||
    isMissingContentColumn(message) ||
    isMissingBodyColumn(message)
  );
}

function postBodyFromRow(row: PostRow): string {
  return row.body?.trim() || row.content?.trim() || '';
}

/** INSERT 시 예전 NOT NULL `tag` 컬럼용 — category와 같은 값 */
export function legacyTagFromCategory(category: CommunityCategory): string {
  return category;
}

function normalizeCategory(
  category: string | null | undefined,
  tag?: string | null | undefined,
): CommunityCategory {
  const raw = category?.trim() || tag?.trim() || null;
  if (raw === 'parenting_worry') return 'parenting_tip';
  if (raw === 'child_brag') return 'free_talk';
  if (raw && VALID_CATEGORIES.includes(raw as CommunityCategory)) {
    return raw as CommunityCategory;
  }
  return 'free_talk';
}

function categoryFilterValues(tab: CommunityCategory): string[] {
  if (tab === 'parenting_tip') return ['parenting_tip', 'parenting_worry'];
  return ['free_talk', 'child_brag'];
}

export { formatCommunityAuthorLabel };

function mapPost(row: PostRow, likedByMe: boolean): CommunityPost {
  const likes = row.likes_count ?? 0;
  const comments = row.comments_count ?? 0;
  const createdAt = new Date(row.created_at).getTime();
  const nickname = row.author_display_name?.trim() || '익명';
  const babyMonths = row.baby_months;
  const imageUrls = parsePostImageUrls(row);
  return {
    id: row.id,
    category: normalizeCategory(row.category, row.tag),
    title: row.title?.trim() ?? '',
    body: postBodyFromRow(row),
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    authorUserId: row.author_user_id ?? null,
    authorDisplayName: nickname,
    babyMonths,
    authorLabel: formatCommunityAuthorLabel(nickname, babyMonths),
    likesCount: likes,
    commentsCount: comments,
    hotScore: likes + comments,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    likedByMe,
  };
}

/** birth_date → 만 개월 */
export function computeBabyMonthAge(birthDateIso: string | null | undefined): number | null {
  if (!birthDateIso) return null;
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export async function fetchCommunityPosts(params: {
  tab: 'all' | 'hot' | CommunityCategory;
}): Promise<CommunityPost[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? null;

  const buildQuery = (selectFields: string) => {
    let q = supabase.from('community_posts').select(selectFields);
    if (params.tab !== 'all' && params.tab !== 'hot') {
      const vals = categoryFilterValues(params.tab);
      q = q.or(`category.in.(${vals.join(',')}),tag.in.(${vals.join(',')})`);
    }
    if (params.tab === 'hot') {
      q = q.order('likes_count', { ascending: false }).order('comments_count', {
        ascending: false,
      });
    } else {
      q = q.order('created_at', { ascending: false });
    }
    return q.limit(80);
  };

  let data: PostRow[] | null = null;
  let error: { message: string } | null = null;
  for (const selectFields of postSelectVariants()) {
    ({ data, error } = await buildQuery(selectFields));
    if (!error) break;
    if (!shouldRetryPostSelect(error.message)) break;
  }
  if (error) {
    console.warn('community_posts 조회 실패:', error.message);
    return [];
  }

  const rows = (data ?? []) as PostRow[];
  let posts = rows.map((r) => mapPost(r, false));

  if (params.tab === 'hot') {
    posts = [...posts].sort((a, b) => b.hotScore - a.hotScore || b.createdAt - a.createdAt);
  }

  if (!myUserId || posts.length === 0) return posts;

  const { data: likes } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .eq('user_id', myUserId)
    .in(
      'post_id',
      posts.map((p) => p.id),
    );

  const likedSet = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));
  return posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.id) }));
}

export async function fetchCommunityPostById(postId: string): Promise<CommunityPost | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let data: PostRow | null = null;
  let error: { message: string } | null = null;
  for (const selectFields of postSelectVariants()) {
    ({ data, error } = await supabase
      .from('community_posts')
      .select(selectFields)
      .eq('id', postId)
      .maybeSingle());
    if (!error) break;
    if (!shouldRetryPostSelect(error.message)) break;
  }

  if (error || !data) return null;

  let likedByMe = false;
  if (user) {
    const { data: likeRow } = await supabase
      .from('community_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    likedByMe = !!likeRow;
  }

  return mapPost(data as PostRow, likedByMe);
}

export async function uploadCommunityPostImages(
  localUris: string[],
  userId: string,
): Promise<{ ok: true; urls: string[] } | { ok: false; message: string }> {
  const urls: string[] = [];
  for (const uri of localUris) {
    if (!uri.startsWith('file://')) continue;
    const uploaded = await uploadCommunityPostImage(uri, userId);
    if (!uploaded.ok) return uploaded;
    urls.push(uploaded.url);
  }
  return { ok: true, urls };
}

export async function uploadCommunityPostImage(
  localUri: string,
  userId: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const { error } = await supabase.storage
      .from(COMMUNITY_IMAGES_BUCKET)
      .upload(path, decode(base64), { contentType, upsert: false });
    if (error) return { ok: false, message: error.message };
    const { data: urlData } = supabase.storage
      .from(COMMUNITY_IMAGES_BUCKET)
      .getPublicUrl(path);
    return { ok: true, url: urlData.publicUrl };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '사진을 업로드하지 못했어요.',
    };
  }
}

export async function createCommunityPost(params: {
  category: CommunityCategory;
  title: string;
  body: string;
  babyId: string | null;
  babyMonths: number | null;
  authorNickname: string;
  imageUrl?: string | null;
  imageUrls?: string[];
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const tag = legacyTagFromCategory(params.category);
  const bodyText = params.body.trim();
  const insertRow: Record<string, unknown> = {
    author_user_id: user.id,
    baby_id: params.babyId,
    category: params.category,
    tag,
    title: params.title.trim(),
    body: bodyText,
    content: bodyText,
    author_display_name: params.authorNickname.trim() || '익명',
    author_relation: null,
    baby_months: params.babyMonths,
  };
  const imageUrls = (params.imageUrls?.length
    ? params.imageUrls
    : params.imageUrl
      ? [params.imageUrl]
      : []
  )
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, MAX_COMMUNITY_POST_IMAGES);

  if (imageUrls.length > 0) {
    insertRow.image_url = imageUrls[0];
    insertRow.image_urls = imageUrls;
  }

  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  let attempt: Record<string, unknown> = { ...insertRow };

  for (let tries = 0; tries < 8; tries++) {
    ({ data, error } = await supabase
      .from('community_posts')
      .insert(attempt)
      .select('id')
      .single());

    if (!error) break;

    const msg = error.message;
    if (isMissingImageUrlsColumn(msg) && 'image_urls' in attempt) {
      const { image_urls: _iu, ...next } = attempt;
      attempt = next;
      continue;
    }
    if (isMissingImageUrlColumn(msg) && 'image_url' in attempt) {
      const { image_url: _i, ...next } = attempt;
      attempt = next;
      continue;
    }
    if (isMissingTagColumn(msg) && 'tag' in attempt) {
      const { tag: _t, ...next } = attempt;
      attempt = next;
      continue;
    }
    if (isMissingContentColumn(msg) && 'content' in attempt) {
      const { content: _c, ...next } = attempt;
      attempt = next;
      continue;
    }
    if (isMissingBodyColumn(msg) && 'body' in attempt) {
      const { body: _b, ...next } = attempt;
      attempt = next;
      continue;
    }
    break;
  }

  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data?.id ?? '') };
}

export async function toggleCommunityPostLike(
  post: CommunityPost,
): Promise<{ ok: boolean; message?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  if (post.likedByMe) {
    const { error } = await supabase
      .from('community_post_likes')
      .delete()
      .eq('post_id', post.id)
      .eq('user_id', user.id);
    if (error) return { ok: false, message: error.message };
    await supabase
      .from('community_posts')
      .update({ likes_count: Math.max(0, post.likesCount - 1) })
      .eq('id', post.id);
    return { ok: true };
  }

  const { error } = await supabase.from('community_post_likes').insert({
    post_id: post.id,
    user_id: user.id,
  });
  if (error) return { ok: false, message: error.message };
  await supabase
    .from('community_posts')
    .update({ likes_count: post.likesCount + 1 })
    .eq('id', post.id);
  return { ok: true };
}

export async function fetchCommunityComments(
  postId: string,
  postAuthorUserId: string | null = null,
): Promise<CommunityComment[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? null;

  const { data, error } = await supabase
    .from('community_post_comments')
    .select('id, post_id, user_id, body, author_display_name, author_relation, baby_months, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('community comments 조회 실패:', error.message);
    return [];
  }

  return ((data ?? []) as CommentRow[]).map((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const nickname = row.author_display_name?.trim() || '익명';
    const babyMonths = row.baby_months;
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      body: row.body,
      authorDisplayName: nickname,
      babyMonths,
      authorLabel: formatCommunityAuthorLabel(nickname, babyMonths),
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      isMine: myUserId != null && row.user_id === myUserId,
      isPostAuthor:
        postAuthorUserId != null && postAuthorUserId.length > 0 && row.user_id === postAuthorUserId,
    };
  });
}

export async function addCommunityComment(params: {
  postId: string;
  body: string;
  authorNickname: string;
  babyMonths: number | null;
  currentCommentsCount: number;
}): Promise<{ ok: boolean; message?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const trimmed = params.body.trim();
  if (!trimmed) return { ok: false, message: '댓글을 입력해 주세요.' };

  const { error } = await supabase.from('community_post_comments').insert({
    post_id: params.postId,
    user_id: user.id,
    body: trimmed,
    author_display_name: params.authorNickname.trim() || '익명',
    author_relation: null,
    baby_months: params.babyMonths,
  });
  if (error) return { ok: false, message: error.message };

  await supabase
    .from('community_posts')
    .update({ comments_count: params.currentCommentsCount + 1 })
    .eq('id', params.postId);

  return { ok: true };
}

/** 피드 본문 2~3줄 요약 */
export function summarizePostBody(
  body: string | null | undefined,
  maxLines = 3,
): string {
  const text = body?.trim() ?? '';
  if (!text) return '';
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= maxLines) return lines.join('\n');
  return lines.slice(0, maxLines).join('\n') + '…';
}
