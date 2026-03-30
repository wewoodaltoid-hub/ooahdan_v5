/**
 * 발달 통계 — word_status_logs(성장 곡선), words(카테고리 비율)
 */

import { PastelColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export type GrowthLineChartData = {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity?: number) => string;
    strokeWidth?: number;
  }[];
};

export type GrowthStatsResult = {
  knows: GrowthLineChartData;
  says: GrowthLineChartData;
};

export type CategoryPieItem = {
  name: string;
  count: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
};

const LINE_PURPLE = (opacity = 1) => {
  const [r, g, b] = [177, 156, 217];
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const DEFAULT_LINE_DATASET = {
  color: LINE_PURPLE,
  strokeWidth: 2.5,
};

function formatMonthLabel(year: number, month1to12: number): string {
  const yy = year % 100;
  return `${yy}년 ${month1to12}월`;
}

/** month1to12 기준 해당 달 마지막 시각(ms) */
function endOfMonthTimestamp(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0, 23, 59, 59, 999).getTime();
}

type LogRow = {
  word_id: string;
  new_status: string;
  changed_at: string;
};

/** changed_at 기준 각 word_id의 최종 상태(해당 시각 이하 로그만) */
function cumulativeCountsAtEndTime(logs: LogRow[], endTime: number): { knowsCumulative: number; saysCumulative: number } {
  const latestByWord = new Map<string, { status: string; t: number }>();
  for (const row of logs) {
    const t = new Date(row.changed_at).getTime();
    if (t > endTime) continue;
    const prev = latestByWord.get(row.word_id);
    if (!prev || t >= prev.t) {
      latestByWord.set(row.word_id, { status: row.new_status, t });
    }
  }
  let knowsCumulative = 0;
  let saysCumulative = 0;
  for (const { status } of latestByWord.values()) {
    if (status === 'says') {
      saysCumulative += 1;
      knowsCumulative += 1;
    } else if (status === 'knows') {
      knowsCumulative += 1;
    }
  }
  return { knowsCumulative, saysCumulative };
}

function emptyGrowthChart(): GrowthLineChartData {
  return {
    labels: [],
    datasets: [{ data: [], ...DEFAULT_LINE_DATASET }],
  };
}

/**
 * word_status_logs → 월별 누적 단어 수 (LineChart용 knows / says 각각)
 * knows: new_status가 knows 또는 says인 단어 수(말하기 단어는 아는 단어에 포함)
 * says: new_status가 says인 단어만
 */
export async function fetchGrowthStats(babyId: string): Promise<GrowthStatsResult> {
  const empty: GrowthStatsResult = {
    knows: emptyGrowthChart(),
    says: emptyGrowthChart(),
  };

  const { data, error } = await supabase
    .from('word_status_logs')
    .select('word_id, new_status, changed_at')
    .eq('baby_id', babyId)
    .order('changed_at', { ascending: true });

  if (error) {
    console.warn('fetchGrowthStats:', error.message);
    return empty;
  }

  const logs = (data ?? []) as LogRow[];
  if (logs.length === 0) {
    return empty;
  }

  const first = new Date(logs[0].changed_at);
  const last = new Date(logs[logs.length - 1].changed_at);
  let y = first.getFullYear();
  let m = first.getMonth() + 1;
  const endY = last.getFullYear();
  const endM = last.getMonth() + 1;

  const monthBuckets: { year: number; month: number; label: string }[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    monthBuckets.push({ year: y, month: m, label: formatMonthLabel(y, m) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const knowsData: number[] = [];
  const saysData: number[] = [];
  const labels: string[] = [];

  for (const { year, month, label } of monthBuckets) {
    const endTime = endOfMonthTimestamp(year, month);
    const { knowsCumulative, saysCumulative } = cumulativeCountsAtEndTime(logs, endTime);
    labels.push(label);
    knowsData.push(knowsCumulative);
    saysData.push(saysCumulative);
  }

  return {
    knows: {
      labels,
      datasets: [{ data: knowsData, ...DEFAULT_LINE_DATASET }],
    },
    says: {
      labels,
      datasets: [{ data: saysData, ...DEFAULT_LINE_DATASET }],
    },
  };
}

const PIE_SLICE_COLORS = [
  '#F0EDF8',
  '#E8E4F5',
  '#E6E6FA',
  PastelColors.primaryLight,
  PastelColors.blue,
  PastelColors.accent,
  PastelColors.backgroundMint,
] as const;

/**
 * words.category별 개수 → PieChart 데이터
 */
export async function fetchCategoryStats(babyId: string): Promise<CategoryPieItem[]> {
  const { data, error } = await supabase.from('words').select('category').eq('baby_id', babyId);

  if (error) {
    console.warn('fetchCategoryStats:', error.message);
    return [];
  }

  const rows = data ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const cat = (row as { category?: string | null }).category?.trim() || '기타';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.map(([name, count], i) => ({
    name,
    count,
    color: PIE_SLICE_COLORS[i % PIE_SLICE_COLORS.length],
    legendFontColor: PastelColors.text,
    legendFontSize: 13,
  }));
}
