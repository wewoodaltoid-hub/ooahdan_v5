/**
 * 전역 상태: 현재 선택된 아이(activeBaby)와 내 아이 목록(babies).
 * family_connections + babies 조인으로 로그인 유저와 연결된 아이만 로드.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** family_connections·invite_codes와 동일. '뷰어' UI는 observer에 해당 */
export type BabyRole = 'admin' | 'observer';

export type Baby = {
  id: string;
  name: string;
  profile_image_url: string | null;
  birth_date: string | null;
  created_at: string;
  /** 현재 로그인 유저가 이 아이에 대해 가진 역할 */
  role: BabyRole;
  /** family_connections.relation_name — 없으면 UI에서 '가족' */
  relation_name: string | null;
};

export function isBabyAdmin(baby: Baby | null | undefined): boolean {
  return baby?.role === 'admin';
}

type BabyContextValue = {
  babies: Baby[];
  activeBaby: Baby | null;
  setActiveBaby: (baby: Baby | null) => void;
  /** 현재 activeBaby 필드만 갱신 (DB 저장 후 즉시 UI 반영용) */
  updateActiveBaby: (partial: Partial<Pick<Baby, 'name' | 'profile_image_url' | 'birth_date'>>) => void;
  /** 현재 유저·activeBaby에 대한 family_connections.relation_name 업데이트 */
  updateRelationName: (relationName: string) => Promise<{ ok: boolean; error?: string }>;
  refreshBabies: () => Promise<Baby[]>;
  loading: boolean;
  loaded: boolean;
};

const BabyContext = createContext<BabyContextValue | null>(null);

export function useBaby() {
  const ctx = useContext(BabyContext);
  if (!ctx) throw new Error('useBaby must be used within BabyProvider');
  return ctx;
}

type BabyProviderProps = { children: React.ReactNode };

export function BabyProvider({ children }: BabyProviderProps) {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [activeBaby, setActiveBabyState] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const refreshBabies = useCallback(async (): Promise<Baby[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBabies([]);
      setActiveBabyState(null);
      setLoading(false);
      setLoaded(true);
      return [];
    }
    setLoading(true);
    const { data: connData, error: connError } = await supabase
      .from('family_connections')
      .select('baby_id, role, relation_name, babies(id, name, profile_image_url, birth_date, created_at)')
      .eq('user_id', user.id);
    setLoading(false);
    setLoaded(true);
    if (connError || !connData || connData.length === 0) {
      setBabies([]);
      setActiveBabyState(null);
      return [];
    }
    type ConnRow = {
      baby_id: string;
      role: string;
      relation_name: string | null;
      babies:
        | {
            id: string;
            name: string | null;
            profile_image_url: string | null;
            birth_date: string | null;
            created_at: string;
          }
        | {
            id: string;
            name: string | null;
            profile_image_url: string | null;
            birth_date: string | null;
            created_at: string;
          }[]
        | null;
    };
    const list: Baby[] = (connData as ConnRow[])
      .map((row) => {
        const raw = row.babies;
        const b = raw == null ? null : Array.isArray(raw) ? raw[0] : raw;
        if (!b || !b.id) return null;
        const role: BabyRole = row.role === 'admin' ? 'admin' : 'observer';
        const rel = row.relation_name?.trim() ?? '';
        return {
          id: b.id,
          name: b.name ?? '',
          profile_image_url: b.profile_image_url ?? null,
          birth_date: b.birth_date ?? null,
          created_at: b.created_at ?? '',
          role,
          relation_name: rel.length > 0 ? rel : null,
        };
      })
      .filter((b): b is Baby => b != null);
    const unique = Array.from(new Map(list.map((b) => [b.id, b])).values());
    setBabies(unique);
    setActiveBabyState((prev) => {
      if (unique.length === 0) return null;
      if (prev) {
        const match = unique.find((b) => b.id === prev.id);
        if (match) return match;
      }
      return unique[0] ?? null;
    });
    return unique;
  }, []);

  useEffect(() => {
    refreshBabies();
  }, [refreshBabies]);

  const setActiveBaby = useCallback((baby: Baby | null) => {
    setActiveBabyState(baby);
  }, []);

  const updateActiveBaby = useCallback((partial: Partial<Pick<Baby, 'name' | 'profile_image_url' | 'birth_date'>>) => {
    setActiveBabyState((prev) => (prev ? { ...prev, ...partial } : null));
    setBabies((prev) =>
      prev.map((b) => (activeBaby && b.id === activeBaby.id ? { ...b, ...partial } : b))
    );
  }, [activeBaby?.id]);

  const updateRelationName = useCallback(
    async (relationName: string): Promise<{ ok: boolean; error?: string }> => {
      const { data: { user } } = await supabase.auth.getUser();
      const babyId = activeBaby?.id;
      if (!user || !babyId) {
        return { ok: false, error: '로그인 또는 선택된 아이 정보가 없어요.' };
      }
      const trimmed = relationName.trim();
      const valueToStore = trimmed.length > 0 ? trimmed : null;
      const { error } = await supabase
        .from('family_connections')
        .update({ relation_name: valueToStore })
        .eq('user_id', user.id)
        .eq('baby_id', babyId);
      if (error) {
        return { ok: false, error: error.message };
      }
      setActiveBabyState((prev) =>
        prev && prev.id === babyId ? { ...prev, relation_name: valueToStore } : prev
      );
      setBabies((prev) =>
        prev.map((b) => (b.id === babyId ? { ...b, relation_name: valueToStore } : b))
      );
      return { ok: true };
    },
    [activeBaby?.id]
  );

  const value = useMemo<BabyContextValue>(
    () => ({
      babies,
      activeBaby,
      setActiveBaby,
      updateActiveBaby,
      updateRelationName,
      refreshBabies,
      loading,
      loaded,
    }),
    [babies, activeBaby, setActiveBaby, updateActiveBaby, updateRelationName, refreshBabies, loading, loaded]
  );

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}
