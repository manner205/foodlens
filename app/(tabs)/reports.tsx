// app/(tabs)/reports.tsx
// 2026-05-13: 리포트 전면 개편 — 스트릭/기록률/파이차트/달성바/식사패턴/인기음식
// 2026-05-14: 기간 선택 UI (오늘/7일/30일/이번달/직접선택) + 파이차트 세로 스택으로 짤림 수정

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { getReportByDateRange } from '@/services/reportService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { WeeklyReport } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';

const SW = Dimensions.get('window').width;
const CHART_W = SW - Spacing.md * 2 - 32;

const baseChartConfig = {
  backgroundColor: Colors.surface,
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
  labelColor: () => Colors.textSecondary,
  barPercentage: 0.6,
  propsForLabels: { fontSize: 10 },
};

const MEAL_TYPE_META = [
  { key: 'breakfast' as const, emoji: '🌅', label: '아침', color: Colors.breakfast },
  { key: 'lunch' as const, emoji: '☀️', label: '점심', color: Colors.lunch },
  { key: 'dinner' as const, emoji: '🌙', label: '저녁', color: Colors.dinner },
  { key: 'snack' as const, emoji: '🍎', label: '간식', color: Colors.snack },
];

type Period = '오늘' | '7일' | '30일' | '이번달' | '직접선택';
const PERIODS: Period[] = ['오늘', '7일', '30일', '이번달', '직접선택'];

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function adjustDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateRange(period: Period, customStart: Date, customEnd: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === '오늘') {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { start: today, end, elapsedDays: 1, totalPeriodDays: 1, label: '오늘' };
  }
  if (period === '7일') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { start, end: now, elapsedDays: 7, totalPeriodDays: 7, label: '최근 7일' };
  }
  if (period === '30일') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { start, end: now, elapsedDays: 30, totalPeriodDays: 30, label: '최근 30일' };
  }
  if (period === '이번달') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const totalPeriodDays = end.getDate();
    return { start, end, elapsedDays: now.getDate(), totalPeriodDays, label: `${now.getMonth() + 1}월` };
  }
  // 직접선택
  const s = new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate());
  const e = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59, 999);
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return { start: s, end: e, elapsedDays: days, totalPeriodDays: days, label: `${fmt(s)}~${fmt(e)}` };
}

export default function ReportsScreen() {
  const { user } = useAuthContext();
  const [period, setPeriod] = useState<Period>('7일');
  const [customStart, setCustomStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [customEnd, setCustomEnd] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id, period]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { start, end, elapsedDays, totalPeriodDays } = getDateRange(period, customStart, customEnd);
      setData(await getReportByDateRange(user.id, start, end, elapsedDays, totalPeriodDays));
    } catch (e) {
      console.error('리포트 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const calorieGoal = user?.daily_calorie_goal || 2000;
  const proteinGoal = user?.weight_kg
    ? Math.round(user.weight_kg * 1.0)
    : Math.round(calorieGoal * 0.20 / 4);
  const carbsGoal = Math.round(calorieGoal * 0.50 / 4);
  const fatGoal = Math.round(calorieGoal * 0.25 / 9);
  const fiberGoal = 25;

  const dailyData = data?.daily_data || [];
  const averages = data?.averages;
  const hasData = dailyData.length > 0;

  const chartSlice = period === '오늘' ? dailyData.slice(-1) : dailyData.slice(-7);
  const barData = {
    labels: chartSlice.map(d => {
      const dt = new Date(d.date);
      if (period === '오늘') return '오늘';
      if (period === '7일') return dt.toLocaleDateString('ko-KR', { weekday: 'short' });
      return `${dt.getDate()}일`;
    }),
    datasets: [{ data: chartSlice.map(d => d.calories || 0) }],
  };

  const totalMacro = (averages?.protein_g || 0) + (averages?.carbohydrates_g || 0) + (averages?.fat_g || 0);
  const pieData = totalMacro > 0 ? [
    { name: '탄수화물', population: Math.round(averages!.carbohydrates_g), color: Colors.carbs, legendFontColor: Colors.text, legendFontSize: 12 },
    { name: '단백질', population: Math.round(averages!.protein_g), color: Colors.protein, legendFontColor: Colors.text, legendFontSize: 12 },
    { name: '지방', population: Math.round(averages!.fat_g), color: Colors.fat, legendFontColor: Colors.text, legendFontSize: 12 },
  ] : null;

  const recordRate = data && data.elapsed_days > 0
    ? Math.round((data.record_days / data.elapsed_days) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* 기간 선택 */}
      <View style={styles.periodSection}>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => { setPeriod(p); setData(null); }}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {period === '직접선택' && (
          <View style={styles.customDateSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>시작일</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, -1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.dateValue}>{formatDate(customStart)}</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, 1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>종료일</Text>
              <TouchableOpacity onPress={() => setCustomEnd(d => adjustDate(d, -1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.dateValue}>{formatDate(customEnd)}</Text>
              <TouchableOpacity onPress={() => setCustomEnd(d => adjustDate(d, 1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={loadData}>
              <FontAwesome name="search" size={14} color="#fff" />
              <Text style={styles.applyBtnText}>  조회</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!hasData && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{loading ? '로딩 중...' : '기록된 데이터가 없습니다'}</Text>
        </View>
      )}

      {hasData && <>

        {/* ① 기록 현황 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>기록 현황</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statBig}>{data?.streak ?? 0}일</Text>
              <Text style={styles.statLabel}>연속 기록</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={styles.statBig}>{data?.record_days ?? 0}/{data?.elapsed_days ?? 0}일</Text>
              <Text style={styles.statLabel}>기록 유지율 {recordRate}%</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>🍽️</Text>
              <Text style={styles.statBig}>{data?.total_meals ?? 0}끼</Text>
              <Text style={styles.statLabel}>총 기록 식사</Text>
            </View>
          </View>
        </View>

        {/* ② 칼로리 차트 */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>일별 칼로리</Text>
            <Text style={styles.goalBadge}>목표 {calorieGoal} kcal</Text>
          </View>
          <BarChart
            data={barData}
            width={CHART_W}
            height={200}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={baseChartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
          />
        </View>

        {/* ③ 영양소 비율 — 파이차트 세로 스택 (짤림 방지) */}
        {pieData && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>영양소 비율 (일 평균)</Text>
            <PieChart
              data={pieData}
              width={CHART_W}
              height={180}
              chartConfig={baseChartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              hasLegend={false}
            />
            <View style={styles.pieLegendRow}>
              {[
                { label: '탄수화물', g: averages!.carbohydrates_g, recommended: 50, color: Colors.carbs },
                { label: '단백질', g: averages!.protein_g, recommended: 20, color: Colors.protein },
                { label: '지방', g: averages!.fat_g, recommended: 30, color: Colors.fat },
              ].map(item => {
                const actual = totalMacro > 0 ? Math.round((item.g / totalMacro) * 100) : 0;
                const diff = actual - item.recommended;
                const diffColor = Math.abs(diff) <= 5 ? Colors.success : Colors.warning;
                return (
                  <View key={item.label} style={styles.pieLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                    <Text style={styles.legendActual}>{actual}%</Text>
                    <Text style={[styles.legendRec, { color: diffColor }]}>
                      권장 {item.recommended}%
                    </Text>
                    <Text style={[styles.legendDiff, { color: diffColor }]}>
                      ({diff >= 0 ? '+' : ''}{diff}%)
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ④ 목표 달성 상세 */}
        {averages && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>목표 달성 현황 (일 평균)</Text>
            <NutritionBar label="칼로리" current={averages.calories} goal={calorieGoal} unit="kcal" color={Colors.calories} />
            <NutritionBar label="단백질" current={averages.protein_g} goal={proteinGoal} unit="g" color={Colors.protein} />
            <NutritionBar label="탄수화물" current={averages.carbohydrates_g} goal={carbsGoal} unit="g" color={Colors.carbs} />
            <NutritionBar label="지방" current={averages.fat_g} goal={fatGoal} unit="g" color={Colors.fat} />
            <NutritionBar label="식이섬유" current={averages.fiber_g} goal={fiberGoal} unit="g" color={Colors.fiber} />
            <Text style={styles.goalNote}>* 단백질 목표: 체중 1g/kg 기준 | 탄수화물·지방: 칼로리 목표 기반</Text>
          </View>
        )}

        {/* ⑤ 식사 패턴 */}
        {data?.meal_type_stats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>식사 패턴</Text>
            {MEAL_TYPE_META.map(({ key, emoji, label, color }) => {
              const stat = data.meal_type_stats[key];
              const maxCount = Math.max(
                ...MEAL_TYPE_META.map(m => data.meal_type_stats[m.key].count), 1
              );
              const barPct = stat.count > 0 ? Math.round((stat.count / maxCount) * 100) : 0;
              return (
                <View key={key} style={styles.patternRow}>
                  <Text style={styles.patternEmoji}>{emoji}</Text>
                  <Text style={styles.patternLabel}>{label}</Text>
                  <View style={styles.patternTrack}>
                    <View style={[styles.patternFill, { width: `${barPct}%`, backgroundColor: color }]} />
                  </View>
                  <View style={styles.patternRight}>
                    <Text style={styles.patternCount}>{stat.count}회</Text>
                    {stat.avg_calories > 0 && (
                      <Text style={styles.patternCal}>{stat.avg_calories} kcal</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ⑥ 인기 음식 TOP 5 */}
        {data?.top_foods && data.top_foods.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>자주 먹은 음식 TOP {data.top_foods.length}</Text>
            {data.top_foods.map((food, i) => {
              const maxCount = data.top_foods[0].count;
              const barPct = Math.round((food.count / maxCount) * 100);
              return (
                <View key={food.name} style={styles.foodRow}>
                  <Text style={styles.foodRank}>{i + 1}</Text>
                  <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                  <View style={styles.foodTrack}>
                    <View style={[styles.foodFill, { width: `${barPct}%` }]} />
                  </View>
                  <Text style={styles.foodCount}>{food.count}회</Text>
                </View>
              );
            })}
          </View>
        )}

      </>}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function NutritionBar({ label, current, goal, unit, color }: {
  label: string; current: number; goal: number; unit: string; color: string;
}) {
  const pct = goal > 0 ? Math.min(120, Math.round((current / goal) * 100)) : 0;
  const displayPct = Math.min(100, pct);
  const isOver = pct > 105;
  const barColor = isOver ? Colors.warning : color;
  return (
    <View style={styles.nutBarWrap}>
      <View style={styles.rowBetween}>
        <Text style={styles.nutBarLabel}>{label}</Text>
        <Text style={[styles.nutBarValue, isOver && { color: Colors.accentDark }]}>
          {Math.round(current * 10) / 10}{unit} / {goal}{unit}{'  '}{pct > 120 ? '120+' : pct}%
        </Text>
      </View>
      <View style={styles.nutTrack}>
        <View style={[styles.nutFill, { width: `${displayPct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },

  // 기간 선택
  periodSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  periodRow: { flexDirection: 'row', gap: Spacing.xs },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  periodBtnTextActive: { color: '#fff', fontWeight: '700' },
  customDateSection: { marginTop: Spacing.md, gap: Spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, width: 50 },
  arrowBtn: { padding: Spacing.sm },
  dateValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600', minWidth: 100, textAlign: 'center' },
  applyBtn: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  applyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // 공통 카드
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textLight, fontSize: FontSize.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },

  // ① 기록 현황
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  statDivider: { width: 1, height: 60, backgroundColor: Colors.border },
  statEmoji: { fontSize: 22, marginBottom: 2 },
  statBig: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },

  // ② 칼로리 차트
  goalBadge: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  chart: { borderRadius: BorderRadius.md, marginTop: Spacing.xs },

  // ③ 파이 차트 — 세로 스택
  pieLegendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.sm },
  pieLegendItem: { alignItems: 'center', flex: 1 },
  legendDot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  legendLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  legendActual: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  legendRec: { fontSize: FontSize.xs },
  legendDiff: { fontSize: FontSize.xs, fontWeight: '600' },

  // ④ 목표 달성 바
  nutBarWrap: { marginBottom: Spacing.sm },
  nutBarLabel: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  nutBarValue: { fontSize: FontSize.xs, color: Colors.textSecondary },
  nutTrack: { height: 8, backgroundColor: Colors.border, borderRadius: BorderRadius.full, marginTop: 4, overflow: 'hidden' },
  nutFill: { height: '100%', borderRadius: BorderRadius.full },
  goalNote: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.xs },

  // ⑤ 식사 패턴
  patternRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  patternEmoji: { fontSize: 18, width: 26 },
  patternLabel: { fontSize: FontSize.sm, color: Colors.text, width: 36, fontWeight: '500' },
  patternTrack: { flex: 1, height: 10, backgroundColor: Colors.border, borderRadius: BorderRadius.full, overflow: 'hidden', marginHorizontal: Spacing.sm },
  patternFill: { height: '100%', borderRadius: BorderRadius.full },
  patternRight: { width: 80, alignItems: 'flex-end' },
  patternCount: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.text },
  patternCal: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // ⑥ 인기 음식
  foodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  foodRank: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, width: 20 },
  foodName: { fontSize: FontSize.sm, color: Colors.text, width: 90 },
  foodTrack: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: BorderRadius.full, overflow: 'hidden', marginHorizontal: Spacing.sm },
  foodFill: { height: '100%', borderRadius: BorderRadius.full, backgroundColor: Colors.primary },
  foodCount: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 28, textAlign: 'right' },
});
