import type { WordStatus } from '@/stores/cards-store';

export type WordSortKind = 'recent' | 'alpha';
export type WordStatusFilter = '' | WordStatus;

export type WordListFilterState = {
  searchQuery: string;
  categoryFilter: string;
  statusFilter: WordStatusFilter;
  sortBy: WordSortKind;
};

type FilterableWord = {
  id: string;
  word: string;
  category: string;
  status?: WordStatus;
};

export function collectCategoriesFromCards(cards: { category: string }[]): string[] {
  const set = new Set(cards.map((c) => c.category).filter(Boolean));
  return ['전체', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))];
}

export function filterWordCards<T extends FilterableWord>(
  cards: T[],
  filters: WordListFilterState,
): T[] {
  let list = [...cards];
  const q = filters.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (c) =>
        c.word.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q)),
    );
  }
  if (filters.categoryFilter && filters.categoryFilter !== '전체') {
    list = list.filter((c) => c.category === filters.categoryFilter);
  }
  if (filters.statusFilter) {
    list = list.filter((c) => (c.status ?? 'knows') === filters.statusFilter);
  }
  if (filters.sortBy === 'recent') {
    list.sort((a, b) => Number(b.id) - Number(a.id));
  } else {
    list.sort((a, b) => a.word.localeCompare(b.word, 'ko'));
  }
  return list;
}

export function countActiveWordFilters(
  filters: Pick<WordListFilterState, 'categoryFilter' | 'statusFilter' | 'sortBy'>,
): number {
  let count = 0;
  if (filters.categoryFilter) count += 1;
  if (filters.statusFilter) count += 1;
  if (filters.sortBy === 'alpha') count += 1;
  return count;
}

const STATUS_LABELS: Record<Exclude<WordStatusFilter, ''>, string> = {
  knows: '👀 아는 단어',
  says: '🗣️ 말하는 단어',
};

export function getWordFilterSummary(
  filters: Pick<WordListFilterState, 'categoryFilter' | 'statusFilter' | 'sortBy'>,
): string | null {
  const parts: string[] = [];
  if (filters.categoryFilter) parts.push(filters.categoryFilter);
  if (filters.statusFilter) parts.push(STATUS_LABELS[filters.statusFilter]);
  if (filters.sortBy === 'alpha') parts.push('가나다순');
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function resetWordListFilters(): Pick<
  WordListFilterState,
  'categoryFilter' | 'statusFilter' | 'sortBy'
> {
  return { categoryFilter: '', statusFilter: '', sortBy: 'recent' };
}
