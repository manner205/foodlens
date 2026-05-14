// app/(tabs)/index.tsx
// 2026-05-12: 오늘 대시보드 — 칼로리 원형 차트, 영양소 합계, 오늘 식사 목록
// [기존 템플릿 코드 주석 처리 — 원본: Tab One 화면]

import { useAuthContext } from '@/app/_layout';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Text, View } from '@/components/Themed';
import { MEAL_TYPE_LABELS } from '@/constants/nutrition';
import { useMealEntries } from '@/hooks/useMealEntries';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getTodaySummary } from '@/services/reportService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { DailyNutritionSummary } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, session } = useAuthContext();
  const { meals, loading, fetchTodayMeals } = useMealEntries(user?.id);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    await fetchTodayMeals();
    const todaySummary = await getTodaySummary(user.id);
    setSummary(todaySummary);
  }, [user?.id, fetchTodayMeals]);

  const { pendingCount, syncing } = useOfflineSync(loadData);

  // session.access_token이 바뀔 때 데이터 로드:
  // - 콜드 스타트: null → 토큰값 (최초 인증 완료)
  // - 포그라운드 복귀: 만료 토큰 → 갱신 토큰 (useAuth.ts AppState가 갱신 완료 후 session 업데이트)
  // user?.id도 dep에 포함해 로그인 직후(user 세팅 타이밍)도 커버
  useEffect(() => {
    if (user?.id && session?.access_token) {
      loadData();
    }
  }, [session?.access_token, user?.id, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const calorieGoal = user?.daily_calorie_goal || 2000;
  const caloriesCurrent = summary?.calories || 0;
  const caloriePercent = Math.min(Math.round((caloriesCurrent / calorieGoal) * 100), 100);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 동기화 배지 */}
      {pendingCount > 0 && (
        <View style={styles.syncBadge}>
          <Text style={styles.syncText}>
            {syncing ? '동기화 중...' : `${pendingCount}건 동기화 대기`}
          </Text>
        </View>
      )}

      {/* 칼로리 요약 카드 */}
      <View style={styles.calorieCard}>
        <View style={styles.cardHeader}>
          <AvatarDisplay avatarUrl={user?.avatar_url} size={48} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardGreeting}>
              {user?.nickname ? `${user.nickname} 님, 안녕하세요 👋` : '안녕하세요 👋'}
            </Text>
            <Text style={styles.cardDate}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </Text>
          </View>
        </View>
        <View style={styles.calorieDivider} />
        <Text style={styles.cardTitle}>오늘의 칼로리</Text>
        <View style={styles.calorieCircle}>
          <Text style={styles.calorieNumber}>{caloriesCurrent}</Text>
          <Text style={styles.calorieUnit}>/ {calorieGoal} kcal</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${caloriePercent}%` }]} />
        </View>
        <Text style={styles.percentText}>{caloriePercent}% 달성</Text>
      </View>

      {/* 영양소 합계 */}
      <View style={styles.nutritionRow}>
        <NutrientBox label="단백질" value={summary?.protein_g || 0} unit="g" color={Colors.protein} />
        <NutrientBox label="탄수화물" value={summary?.carbohydrates_g || 0} unit="g" color={Colors.carbs} />
        <NutrientBox label="지방" value={summary?.fat_g || 0} unit="g" color={Colors.fat} />
      </View>

      {/* 오늘 식사 목록 */}
      <View style={styles.mealsSection}>
        <Text style={styles.sectionTitle}>오늘 식사 ({meals.length}끼)</Text>
        {meals.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>아직 기록된 식사가 없습니다</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadData}>
              <FontAwesome name="refresh" size={14} color={Colors.primary} />
              <Text style={styles.retryText}>  새로고침</Text>
            </TouchableOpacity>
          </View>
        )}
        {meals.map((meal) => (
          <TouchableOpacity
            key={meal.id}
            style={styles.mealCard}
            onPress={() => router.push(`/analysis/${meal.id}`)}
          >
            <View style={[styles.mealTypeBadge, { backgroundColor: Colors[meal.meal_type] || Colors.primary }]}>
              <Text style={styles.mealTypeText}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
            </View>
            <View style={styles.mealInfo}>
              <Text style={styles.mealCalories}>{meal.nutrition?.calories || 0} kcal</Text>
              <Text style={styles.mealTime}>
                {new Date(meal.meal_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* 건강 가이드 바로가기 */}
      <TouchableOpacity
        style={styles.guideButton}
        onPress={() => router.push('/guide')}
      >
        <FontAwesome name="heartbeat" size={20} color={Colors.surface} />
        <Text style={styles.guideButtonText}>  건강 가이드 보기</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />

      {/* 플로팅 + 버튼 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/camera')}
      >
        <FontAwesome name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );
}

function NutrientBox({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[styles.nutrientBox, { borderTopColor: color }]}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{value}<Text style={styles.nutrientUnit}>{unit}</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  syncBadge: { backgroundColor: Colors.warning, padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm, alignItems: 'center' },
  syncText: { fontSize: FontSize.sm, fontWeight: '600' },
  calorieCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: Spacing.sm },
  cardHeaderText: { flex: 1, marginLeft: Spacing.sm },
  cardGreeting: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardDate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  calorieDivider: { height: 1, backgroundColor: Colors.border, alignSelf: 'stretch', marginBottom: Spacing.sm },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  calorieCircle: { alignItems: 'center', marginVertical: Spacing.md },
  calorieNumber: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.calories },
  calorieUnit: { fontSize: FontSize.sm, color: Colors.textSecondary },
  progressBar: { width: '100%', height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  percentText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  nutrientBox: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginHorizontal: 4, alignItems: 'center', borderTopWidth: 3, elevation: 1 },
  nutrientLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  nutrientValue: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text },
  nutrientUnit: { fontSize: FontSize.xs, color: Colors.textSecondary },
  mealsSection: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyText: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center' },
  retryButton: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  retryText: { fontSize: FontSize.sm, color: Colors.primary },
  mealCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, alignItems: 'center', elevation: 1 },
  mealTypeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  mealTypeText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  mealInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', marginLeft: Spacing.md, alignItems: 'center' },
  mealCalories: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  mealTime: { fontSize: FontSize.sm, color: Colors.textSecondary },
  guideButton: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  guideButtonText: { color: Colors.surface, fontSize: FontSize.md, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 },
});
// 2026-05-12: 마지막 }); 중복 제거 (SyntaxError 수정)
