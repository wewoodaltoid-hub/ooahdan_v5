import { supabase } from '@/lib/supabase';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_CARD_IMAGE = require('@/assets/images/icon.png');

export type WordCardImageSource = number | string;

/** words.id → image_uri (없으면 기본 아이콘) */
export async function fetchWordCardImageSource(
  cardId: string | null | undefined,
): Promise<WordCardImageSource> {
  const id = cardId?.trim();
  if (!id || !UUID_RE.test(id)) {
    return DEFAULT_CARD_IMAGE;
  }

  const { data, error } = await supabase
    .from('words')
    .select('image_uri')
    .eq('id', id)
    .maybeSingle();

  if (error || !data?.image_uri?.trim()) {
    return DEFAULT_CARD_IMAGE;
  }
  return data.image_uri.trim();
}

/** 여러 card_id를 한 번에 조회 */
export async function fetchWordCardImageMap(
  cardIds: string[],
): Promise<Record<string, WordCardImageSource>> {
  const ids = [...new Set(cardIds.filter((id) => UUID_RE.test(id?.trim() ?? '')))];
  const map: Record<string, WordCardImageSource> = {};
  if (ids.length === 0) return map;

  const { data, error } = await supabase.from('words').select('id, image_uri').in('id', ids);
  if (error || !data) return map;

  for (const row of data) {
    const id = String(row.id);
    map[id] = row.image_uri?.trim() || DEFAULT_CARD_IMAGE;
  }
  return map;
}

export { DEFAULT_CARD_IMAGE };
