// app/(tabs)/reports.tsx
// 2026-05-12: 주간/월간 리포트 — 바 차트 + 영양소 평균 + 목표 달성률

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { getMonthlyReport, getWeeklyReport } from '@/services/reportService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { MonthlyReport, WeeklyReport } from '@/types/models';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const { user } = useAuthContext();
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');
  const [weeklyData, setWeeklyData] = useState<WeeklyReport | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id, tab]);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (tab === 'weekly') {
        const data = await getWeeklyReport(user.id);
        setWeeklyData(data);
      } else {
        const now = new Date();
        const data = await getMonthlyReport(user.id, now.getFullYear(), now.getMonth() + 1);
        setMonthlyData(data);
      }
    } catch (error) {
      console.error('리포트 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentData = tab === 'weekly' ? weeklyData : monthlyData;
  const dailyData = currentData?.daily_data || [];
  const averages = currentData?.averages;
  const calorieGoal = user?.daily_calorie_goal || 2000;

  const chartData = {
    labels: dailyData.map(d => {
      const date = new Date(d.date);
      return tab === 'weekly'
        ? date.toLocaleDateString('ko-KR', { weekday: 'short' })
        : `${date.getDate()}일`;
    }).slice(-7),
    datasets: [{
      data: dailyData.map(d => d.calories).slice(-7),
    }],
  };

  const avgCalories = averages?.calories || 0;
  const achievementRate = calorieGoal > 0 ? Math.round((avgCalories / calorieGoal) * 100) : 0;

  return (
    <ScrollView style={styles.container}>
      {/* 탭 전환 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'weekly' && styles.tabActive]}
          onPress={() => setTab('weekly')}
        >
          <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>주간</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'monthly' && styles.tabActive]}
          onPress={() => setTab('monthly')}
        >
          <Text style={[styles.tabText, tab === 'monthly' && styles.tabTextActive]}>월간</Text>
        </TouchableOpacity>
      </View>

      {/* 칼로리 차트 */}
      {dailyData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>일별 칼로리</Text>
          <BarChart
            data={chartData}
            width={screenWidth - 48}
            height={220}
            yAxisLabel=""
            yAxisSuffix=" kcal"
            chartConfig={{
              backgroundColor: Colors.surface,
              backgroundGradientFrom: Colors.surface,
              backgroundGradientTo: Colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
              labelColor: () => Colors.textSecondary,
              barPercentage: 0.6,
            }}
            style={styles.chart}
          />
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {loading ? '로딩 중...' : '데이터가 없습니다'}
          </Text>
        </View>
      )}

      {/* 평균 영양소 */}
      {averages && (
        <View style={styles.averageCard}>
          <Text style={styles.cardTitle}>일일 평균</Text>
          <View style={styles.avgRow}>
            <AvgItem label="칼로리" value={`${averages.calories} kcal`} color={Colors.calories} />
            <AvgItem label="단백질" value={`${averages.protein_g}g`} color={Colors.protein} />
          </View>
          <View style={styles.avgRow}>
            <AvgItem label="탄수화물" value={`${averages.carbohydrates_g}g`} color={Colors.carbs} />
            <AvgItem label="지방" value={`${averages.fat_g}g`} color={Colors.fat} />
          </View>
        </View>
      )}

      {/* 목표 달성률 */}
      <View style={styles.achievementCard}>
        <Text style={styles.cardTitle}>목표 달성률</Text>
        <Text style={styles.achievementNumber}>{achievementRate}%</Text>
        <Text style={styles.achievementDetail}>
          평균 {avgCalories} / 목표 {calorieGoal} kcal
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function AvgItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.avgItem, { borderLeftColor: color }]}>
      <Text style={styles.avgLabel}>{label}</Text>
      <Text style={styles.avgValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  tabRow: { flexDirection: 'row', marginBottom: Spacing.md },
  tabButton: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: Colors.border },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.md, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  chartCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  chartTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  chart: { borderRadius: BorderRadius.md },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { color: Colors.textLight, fontSize: FontSize.md },
  averageCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  avgRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  avgItem: { flex: 1, borderLeftWidth: 3, paddingLeft: Spacing.sm, marginRight: Spacing.sm },
  avgLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  avgValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  achievementCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', elevation: 1 },
  achievementNumber: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary, marginVertical: Spacing.sm },
  achievementDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
