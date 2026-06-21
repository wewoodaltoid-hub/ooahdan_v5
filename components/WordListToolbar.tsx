import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PastelColors, Fonts, flashcardShadow } from '@/constants/theme';
import {
  countActiveWordFilters,
  getWordFilterSummary,
  resetWordListFilters,
  type WordSortKind,
  type WordStatusFilter,
} from '@/lib/word-list-filters';

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  categories: string[];
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  statusFilter: WordStatusFilter;
  onStatusFilterChange: (value: WordStatusFilter) => void;
  sortBy: WordSortKind;
  onSortByChange: (value: WordSortKind) => void;
  metaText?: string;
  searchPlaceholder?: string;
};

type FilterModalProps = Pick<
  Props,
  | 'categories'
  | 'categoryFilter'
  | 'onCategoryFilterChange'
  | 'statusFilter'
  | 'onStatusFilterChange'
  | 'sortBy'
  | 'onSortByChange'
> & {
  visible: boolean;
  onClose: () => void;
};

function WordFilterModal({
  visible,
  onClose,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
}: FilterModalProps) {
  const handleReset = useCallback(() => {
    const reset = resetWordListFilters();
    onCategoryFilterChange(reset.categoryFilter);
    onStatusFilterChange(reset.statusFilter);
    onSortByChange(reset.sortBy);
  }, [onCategoryFilterChange, onStatusFilterChange, onSortByChange]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.modalSheetWrap}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>필터 · 정렬</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={PastelColors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionLabel}>카테고리</Text>
              <View style={styles.chipWrap}>
                {categories.map((cat) => {
                  const value = cat === '전체' ? '' : cat;
                  const active = categoryFilter === value;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onCategoryFilterChange(value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>단어 유형</Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    ['', '전체'],
                    ['knows', '👀 아는 단어'],
                    ['says', '🗣️ 말하는 단어'],
                  ] as const
                ).map(([value, label]) => {
                  const active = statusFilter === value;
                  return (
                    <Pressable
                      key={value || 'all'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onStatusFilterChange(value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>정렬</Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    ['recent', '추가 일시순'],
                    ['alpha', '가나다순'],
                  ] as const
                ).map(([value, label]) => {
                  const active = sortBy === value;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onSortByChange(value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.resetBtn, pressed && styles.btnPressed]}
                onPress={handleReset}
              >
                <Text style={styles.resetBtnText}>초기화</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.applyBtn, pressed && styles.btnPressed]}
                onPress={onClose}
              >
                <Text style={styles.applyBtnText}>적용</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** 검색창 + 필터 버튼 (필터는 팝업) */
export function WordListToolbar({
  searchQuery,
  onSearchQueryChange,
  categories,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  metaText,
  searchPlaceholder = '단어 검색',
}: Props) {
  const [filterVisible, setFilterVisible] = useState(false);

  const activeFilterCount = useMemo(
    () => countActiveWordFilters({ categoryFilter, statusFilter, sortBy }),
    [categoryFilter, statusFilter, sortBy],
  );

  const filterSummary = useMemo(
    () => getWordFilterSummary({ categoryFilter, statusFilter, sortBy }),
    [categoryFilter, statusFilter, sortBy],
  );

  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <MaterialIcons
              name="search"
              size={20}
              color={PastelColors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={PastelColors.textSecondary}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.filterBtn,
              activeFilterCount > 0 && styles.filterBtnActive,
              pressed && styles.btnPressed,
            ]}
            onPress={() => setFilterVisible(true)}
          >
            <MaterialIcons
              name="tune"
              size={20}
              color={activeFilterCount > 0 ? PastelColors.buttonTextOnPrimary : PastelColors.text}
            />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {(metaText || filterSummary) && (
          <View style={styles.metaRow}>
            {metaText ? <Text style={styles.metaText} numberOfLines={1}>{metaText}</Text> : null}
            {filterSummary ? (
              <Text style={styles.filterSummaryText} numberOfLines={1}>
                {filterSummary}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <WordFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={onCategoryFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
      />
    </>
  );
}

/** @deprecated WordListToolbar 사용 */
export const WordListFilters = WordListToolbar;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    paddingHorizontal: 12,
    ...flashcardShadow,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    backgroundColor: PastelColors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...flashcardShadow,
  },
  filterBtnActive: {
    backgroundColor: PastelColors.accent,
    borderColor: PastelColors.accent,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PastelColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    minHeight: 18,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  filterSummaryText: {
    flexShrink: 1,
    fontSize: 11,
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheetWrap: {
    width: '100%',
  },
  modalSheet: {
    backgroundColor: PastelColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PastelColors.textSecondary,
    opacity: 0.35,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 10,
    marginTop: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: PastelColors.backgroundMint,
  },
  chipActive: {
    backgroundColor: PastelColors.accent,
  },
  chipText: {
    fontSize: 14,
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  chipTextActive: {
    color: PastelColors.buttonTextOnPrimary,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PastelColors.border,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: PastelColors.primaryLight,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: PastelColors.buttonPrimary,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: PastelColors.buttonTextOnPrimary,
    fontFamily: Fonts.rounded,
  },
  btnPressed: {
    opacity: 0.88,
  },
});
