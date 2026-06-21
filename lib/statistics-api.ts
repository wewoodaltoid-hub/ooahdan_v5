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

/** birth_date(YYYY-MM-DD 등) 기준 만 개월 수 */
export function computeMonthAge(birthDateIso: string | null | undefined): number | null {
  if (!birthDateIso) return null;
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

/** count와 최대 count 비율로 슬라이스 색상 진하기 결정 */
export function categoryColorByShare(count: number, maxCount: number, hueIndex: number): string {
  const hues = [258, 272, 286, 230, 210, 330, 190, 245];
  const hue = hues[hueIndex % hues.length];
  const ratio = maxCount > 0 ? Math.min(1, count / maxCount) : 0;
  const saturation = 42 + ratio * 38;
  const lightness = 78 - ratio * 28;
  const opacity = 0.45 + ratio * 0.55;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
}

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
  let knowsOnly = 0;
  let saysOnly = 0;
  for (const { status } of latestByWord.values()) {
    if (status === 'says') {
      saysOnly += 1;
    } else if (status === 'knows') {
      knowsOnly += 1;
    }
  }
  return {
    knowsCumulative: knowsOnly,
    /** 말하는 단어 = 발화(says) + 아는(knows) 단어 전체 합산 */
    saysCumulative: knowsOnly + saysOnly,
  };
}

function emptyGrowthChart(): GrowthLineChartData {
  return {
    labels: [],
    datasets: [{ data: [], ...DEFAULT_LINE_DATASET }],
  };
}

/**
 * word_status_logs → 월별 누적 단어 수 (LineChart용 knows / says 각각)
 * knows: new_status가 knows인 단어만
 * says: knows + says 전체(아는 단어 포함 합산)
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
 * words.category별 개수 → PieChart 데이터 (비중 높을수록 진한 색)
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
  const maxCount = sorted[0]?.[1] ?? 0;

  return sorted.map(([name, count], i) => ({
    name,
    count,
    color:
      maxCount > 0
        ? categoryColorByShare(count, maxCount, i)
        : PIE_SLICE_COLORS[i % PIE_SLICE_COLORS.length],
    legendFontColor: PastelColors.text,
    legendFontSize: 13,
  }));
}
