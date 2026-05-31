import { Alert } from 'react-native';

import { countArchiveRecordingsByCardId } from '@/lib/archive-recordings-api';

/** 단어(card_id)당 아카이브 녹음 최대 개수 */
export const ARCHIVE_RECORDINGS_QUOTA_PER_CARD = 5;

export async function isArchiveQuotaExceeded(
  babyId: string,
  cardId: string,
  word: string,
): Promise<boolean> {
  const count = await countArchiveRecordingsByCardId(babyId, cardId, word);
  return count >= ARCHIVE_RECORDINGS_QUOTA_PER_CARD;
}

export function showArchiveQuotaExceededAlert(params: {
  word: string;
  onManageExisting: () => void;
  onSubscribePremium: () => void;
}): void {
  Alert.alert(
    '기록 한도 초과',
    `「${params.word}」 단어는 아카이브에 최대 ${ARCHIVE_RECORDINGS_QUOTA_PER_CARD}개까지 저장할 수 있어요.\n기존 영상을 정리하거나 프리미엄으로 한도를 늘려 보세요.`,
    [
      { text: '취소', style: 'cancel' },
      { text: '프리미엄 구독하기', onPress: params.onSubscribePremium },
      { text: '기존 영상 관리하기', onPress: params.onManageExisting },
    ],
  );
}

/**
 * 아카이빙 가능하면 true.
 * 한도 초과 시 알럿을 띄우고 false.
 */
export async function ensureArchiveQuotaForCard(
  babyId: string,
  cardId: string,
  word: string,
  handlers: {
    onManageExisting: () => void;
    onSubscribePremium: () => void;
  },
): Promise<boolean> {
  const exceeded = await isArchiveQuotaExceeded(babyId, cardId, word);
  if (!exceeded) return true;
  showArchiveQuotaExceededAlert({ word, ...handlers });
  return false;
}
