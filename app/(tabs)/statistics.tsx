import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { PastelColors, Fonts, flashcardShadow, softShadow } from '@/constants/theme';
import { useBaby } from '@/contexts/BabyContext';
import {
  fetchGrowthStats,
  fetchCategoryStats,
  computeMonthAge,
  type GrowthStatsResult,
  type GrowthLineChartData,
} from '@/lib/statistics-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

const EMPTY_GROWTH: GrowthStatsResult = {
  knows: { labels: [], datasets: [{ data: [] }] },
  says: { labels: [], datasets: [{ data: [] }] },
};

/** 동년배 대비 카드 수치 (목업 — 탭별 분리) */
const BENCHMARK_MOCK = {
  knows: {
    babyPercentile: 68,
    averageWords: 120,
    babyWords: 95,
  },
  says: {
    babyPercentile: 72,
    averageWords: 85,
    babyWords: 112,
  },
} as const;

const chartConfig = {
  backgroundGradientFrom: 'transparent',
  backgroundGradientFromOpacity: 0,
  backgroundGradientTo: 'transparent',
  backgroundGradientToOpacity: 0,
  color: (opacity = 1) => `rgba(74, 68, 83, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(142, 138, 149, ${opacity})`,
  strokeWidth: 2,
  propsForBackgroundLines: { stroke: 'transparent' },
};

const pieChartConfig = {
  color: (opacity = 1) => `rgba(74, 68, 83, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(142, 138, 149, ${opacity})`,
};

function isGrowthChartEmpty(data: GrowthLineChartData): boolean {
  const d = data.datasets[0]?.data ?? [];
  return data.labels.length === 0 || d.length === 0;
}

export default function StatisticsTabScreen() {
  const { activeBaby } = useBaby();
  const babyName = activeBaby?.name?.trim() || '우리 아이';

  const monthAge = useMemo(() => computeMonthAge(activeBaby?.birth_date), [activeBaby?.birth_date]);

  const [activeTab, setActiveTab] = useState<'knows' | 'says'>('knows');
  const [benchmarkTab, setBenchmarkTab] = useState<'knows' | 'says'>('knows');
  const [growthData, setGrowthData] = useState<GrowthStatsResult>(EMPTY_GROWTH);
  const [categoryData, setCategoryData] = useState<Awaited<ReturnType<typeof fetchCategoryStats>>>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const babyId = activeBaby?.id;
    if (!babyId) {
      setGrowthData(EMPTY_GROWTH);
      setCategoryData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [growth, categories] = await Promise.all([
        fetchGrowthStats(babyId),
        fetchCategoryStats(babyId),
      ]);
      setGrowthData(growth);
      setCategoryData(categories);
    } finally {
      setLoading(false);
    }
  }, [activeBaby?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const lineChartData = activeTab === 'knows' ? growthData.knows : growthData.says;
  const growthEmpty = isGrowthChartEmpty(lineChartData);
  const categoryEmpty = categoryData.length === 0;
  const benchmarkData = BENCHMARK_MOCK[benchmarkTab];

  return (
    <>
      <Stack.Screen
        options={{
          title: '발달 통계',
          headerStyle: { backgroundColor: PastelColors.background },
          headerTitleStyle: {
            fontFamily: Fonts.rounded,
            fontSize: 18,
            color: PastelColors.text,
          },
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.babyHeader}>
            <Text style={styles.babyHeaderTitle}>{babyName}의 발달 통계</Text>
            {monthAge != null ? (
              <Text style={styles.babyHeaderSub}>현재 {monthAge}개월</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>우리 아이 어휘력 성장</Text>
            <Text style={styles.sectionSub}>월별 누적</Text>

            <View style={styles.segmentWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentBtn,
                  styles.segmentBtnLeft,
                  activeTab === 'knows' ? styles.segmentBtnActive : styles.segmentBtnIdle,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => setActiveTab('knows')}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'knows' ? styles.segmentLabelActive : styles.segmentLabelIdle,
                  ]}
                >
                  아는 단어
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentBtn,
                  styles.segmentBtnRight,
                  activeTab === 'says' ? styles.segmentBtnActive : styles.segmentBtnIdle,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => setActiveTab('says')}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    activeTab === 'says' ? styles.segmentLabelActive : styles.segmentLabelIdle,
                  ]}
                >
                  말하는 단어
                </Text>
              </Pressable>
            </View>

            <View style={styles.chartCard}>
              {loading ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator size="large" color={PastelColors.accent} />
                </View>
              ) : growthEmpty ? (
                <Text style={styles.emptyHint}>아직 충분한 기록이 없어요</Text>
              ) : (
                <LineChart
                  data={lineChartData}
                  width={CHART_WIDTH}
                  height={200}
                  chartConfig={chartConfig}
                  bezier
                  withDots
                  withInnerLines={false}
                  withOuterLines={false}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  fromZero
                  transparent
                  style={styles.lineChart}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>단어 카테고리</Text>
            <Text style={styles.sectionSub}>어떤 종류의 단어를 많이 말하는지</Text>
            <View style={styles.chartCard}>
              {loading ? (
                <View style={styles.chartLoading}>
                  <ActivityIndicator size="large" color={PastelColors.accent} />
                </View>
              ) : categoryEmpty ? (
                <Text style={styles.emptyHint}>아직 충분한 기록이 없어요</Text>
              ) : (
                <PieChart
                  data={categoryData}
                  width={CHART_WIDTH}
                  height={200}
                  chartConfig={pieChartConfig}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  hasLegend
                  absolute={false}
                  style={styles.pieChart}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {monthAge != null ? `${monthAge}개월 동년배 대비` : '동년배 대비'}
            </Text>
            <Text style={styles.sectionSub}>{babyName}의 발달 수준</Text>

            <View style={styles.segmentWrap}>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentBtn,
                  styles.segmentBtnLeft,
                  benchmarkTab === 'knows' ? styles.segmentBtnActive : styles.segmentBtnIdle,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => setBenchmarkTab('knows')}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    benchmarkTab === 'knows' ? styles.segmentLabelActive : styles.segmentLabelIdle,
                  ]}
                >
                  아는 단어
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.segmentBtn,
                  styles.segmentBtnRight,
                  benchmarkTab === 'says' ? styles.segmentBtnActive : styles.segmentBtnIdle,
                  pressed && styles.segmentPressed,
                ]}
                onPress={() => setBenchmarkTab('says')}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    benchmarkTab === 'says' ? styles.segmentLabelActive : styles.segmentLabelIdle,
                  ]}
                >
                  말하는 단어
                </Text>
              </Pressable>
            </View>

            <View style={styles.benchmarkCard}>
              <View style={styles.benchmarkContent}>
                <View style={styles.benchmarkRow}>
                  <Text style={styles.benchmarkLabel}>
                    동년배 평균 {benchmarkTab === 'knows' ? '아는' : '말하는'} 단어
                  </Text>
                  <Text style={styles.benchmarkValue}>{benchmarkData.averageWords}개</Text>
                </View>
                <View style={styles.benchmarkRow}>
                  <Text style={styles.benchmarkLabel}>
                    {babyName} {benchmarkTab === 'knows' ? '아는' : '말하는'} 단어
                  </Text>
                  <Text style={[styles.benchmarkValue, styles.benchmarkHighlight]}>
                    {benchmarkData.babyWords}개
                  </Text>
                </View>
                <View style={styles.percentBarWrap}>
                  <View style={styles.percentBarBg} />
                  <View
                    style={[styles.percentBarFill, { width: `${benchmarkData.babyPercentile}%` }]}
                  />
                </View>
                <Text style={styles.percentText}>
                  상위 약 {100 - benchmarkData.babyPercentile}% 구간 (목업)
                </Text>
              </View>
              <View style={styles.benchmarkBlurOverlay} pointerEvents="none" />
              <View style={styles.ctaWrap}>
                <View style={styles.ctaBanner}>
                  <Text style={styles.ctaBannerIcon}>🕐</Text>
                  <Text style={styles.ctaBannerLabel}>
                    제대로 표기하기 위해 데이터 더 수집 중이에요 🙇‍♀️
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PastelColors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 24,
  },
  babyHeader: {
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: PastelColors.border,
  },
  babyHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: PastelColors.accent,
    fontFamily: Fonts.rounded,
  },
  babyHeaderSub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 14,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginBottom: 12,
  },
  segmentWrap: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    overflow: 'hidden',
    backgroundColor: PastelColors.surface,
    ...softShadow,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: PastelColors.border,
  },
  segmentBtnRight: {},
  segmentBtnActive: {
    backgroundColor: PastelColors.accent,
  },
  segmentBtnIdle: {
    backgroundColor: PastelColors.surface,
  },
  segmentPressed: {
    opacity: 0.92,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
  segmentLabelIdle: {
    color: PastelColors.text,
  },
  chartCard: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    padding: 16,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
    ...flashcardShadow,
  },
  chartLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHint: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    paddingVertical: 24,
  },
  lineChart: {
    borderRadius: 12,
  },
  pieChart: {
    borderRadius: 12,
  },
  benchmarkCard: {
    backgroundColor: PastelColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PastelColors.border,
    overflow: 'hidden',
    minHeight: 200,
    ...flashcardShadow,
  },
  benchmarkContent: {
    padding: 24,
    paddingBottom: 100,
  },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  benchmarkLabel: {
    fontSize: 15,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
  },
  benchmarkValue: {
    fontSize: 16,
    fontWeight: '800',
    color: PastelColors.text,
    fontFamily: Fonts.rounded,
  },
  benchmarkHighlight: {
    color: PastelColors.accent,
  },
  percentBarWrap: {
    height: 10,
    borderRadius: 5,
    backgroundColor: PastelColors.backgroundMint,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  percentBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PastelColors.backgroundMint,
  },
  percentBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: PastelColors.accent,
    borderRadius: 5,
  },
  percentText: {
    fontSize: 13,
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    marginTop: 8,
  },
  benchmarkBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.65)',
    bottom: 0,
    height: '55%',
    top: undefined,
  },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PastelColors.blue,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PastelColors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    maxWidth: 320,
    opacity: 0.95,
  },
  ctaBannerIcon: {
    fontSize: 18,
  },
  ctaBannerLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: PastelColors.textSecondary,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    lineHeight: 20,
  },
});
