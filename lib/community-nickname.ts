/**
 * 커뮤니티 익명 닉네임 — 계정(user)당 1개 고정
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const nicknameCacheKey = (userId: string) => `community_nickname_v1:${userId}`;

function isMissingNicknamesTable(message: string | undefined, code: string | undefined): boolean {
  return (
    code === 'PGRST205' ||
    !!message?.includes('community_nicknames') ||
    !!message?.includes('schema cache')
  );
}

async function getOrCreateLocalCommunityNickname(userId: string): Promise<string> {
  const key = nicknameCacheKey(userId);
  const cached = await AsyncStorage.getItem(key);
  if (cached?.trim()) return cached.trim();
  const nickname = generateRandomCommunityNickname();
  await AsyncStorage.setItem(key, nickname);
  return nickname;
}

const NICK_PART_A = [
  '하늘',
  '말랑',
  '달빛',
  '복숭',
  '콩콩',
  '보리',
  '우주',
  '민트',
  '포근',
  '말랑이',
  '초코',
  '딸기',
];
const NICK_PART_B = [
  '보리',
  '콩이',
  '토끼',
  '곰돌',
  '별이',
  '구름',
  '아기',
  '콩콩',
  '맘보',
  '파워',
];
const NICK_PART_C = [
  '맛잇엉',
  '짱',
  '쨩',
  '걸',
  '맘',
  '대장',
  '요정',
  '마스터',
  '천사',
  '요정',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomCommunityNickname(): string {
  return `${pick(NICK_PART_A)}${pick(NICK_PART_B)}${pick(NICK_PART_C)}`;
}

/** "하늘보리맛잇엉 - 21개월 양육" */
export function formatCommunityAuthorLabel(
  nickname: string,
  babyMonths: number | null | undefined,
): string {
  const name = nickname.trim() || '익명';
  if (babyMonths != null && babyMonths >= 0) {
    return `${name} - ${babyMonths}개월 양육`;
  }
  return name;
}

export const COMMUNITY_NICKNAME_MIN_LEN = 2;
export const COMMUNITY_NICKNAME_MAX_LEN = 12;

export function validateCommunityNickname(
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, message: '닉네임을 입력해 주세요.' };
  }
  if (value.length < COMMUNITY_NICKNAME_MIN_LEN) {
    return { ok: false, message: `닉네임은 ${COMMUNITY_NICKNAME_MIN_LEN}자 이상이어야 해요.` };
  }
  if (value.length > COMMUNITY_NICKNAME_MAX_LEN) {
    return { ok: false, message: `닉네임은 ${COMMUNITY_NICKNAME_MAX_LEN}자 이하로 해 주세요.` };
  }
  return { ok: true, value };
}

/** 익명 닉네임 수정 (자동 생성 로직은 그대로, 사용자가 직접 변경할 때 사용) */
export async function updateCommunityNickname(
  nextNickname: string,
): Promise<{ ok: true; nickname: string } | { ok: false; message: string }> {
  const validated = validateCommunityNickname(nextNickname);
  if (!validated.ok) return validated;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요.' };

  const nickname = validated.value;

  const { error } = await supabase.from('community_nicknames').upsert(
    { user_id: user.id, nickname },
    { onConflict: 'user_id' },
  );

  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: '이미 사용 중인 닉네임이에요. 다른 이름을 골라 주세요.' };
    }
    if (isMissingNicknamesTable(error.message, error.code)) {
      await AsyncStorage.setItem(nicknameCacheKey(user.id), nickname);
      return { ok: true, nickname };
    }
    return { ok: false, message: error.message };
  }

  await AsyncStorage.setItem(nicknameCacheKey(user.id), nickname);
  return { ok: true, nickname };
}

/** 로그인 유저의 익명 닉네임 조회·없으면 생성 후 저장 */
export async function getOrCreateCommunityNickname(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return '익명';

  const { data: existing, error: selectError } = await supabase
    .from('community_nicknames')
    .select('nickname')
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError && isMissingNicknamesTable(selectError.message, selectError.code)) {
    return getOrCreateLocalCommunityNickname(user.id);
  }

  if (existing?.nickname?.trim()) {
    return existing.nickname.trim();
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const nickname = generateRandomCommunityNickname();
    const { error } = await supabase.from('community_nicknames').insert({
      user_id: user.id,
      nickname,
    });
    if (!error) return nickname;
    if (isMissingNicknamesTable(error.message, error.code)) {
      return getOrCreateLocalCommunityNickname(user.id);
    }
    if (error.code !== '23505') {
      console.warn('community_nicknames 저장 실패:', error.message);
      break;
    }
  }

  const fallback = `우아${user.id.slice(0, 6)}`;
  const { error: upsertError } = await supabase.from('community_nicknames').upsert({
    user_id: user.id,
    nickname: fallback,
  });
  if (upsertError && isMissingNicknamesTable(upsertError.message, upsertError.code)) {
    return getOrCreateLocalCommunityNickname(user.id);
  }
  return fallback;
}
