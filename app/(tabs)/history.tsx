// app/(tabs)/history.tsx
// 2026-05-12: 기록 히스토리 — 일/주간/월간 뷰

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { MEAL_TYPE_LABELS } from '@/constants/nutrition';
import { useMealEntries } from '@/hooks/useMealEntries';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { MealEntry } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

type ViewMode = 'daily' | 'weekly' | 'monthly';

interface DayGroup {
  date: string;
  meals: MealEntry[];
  totalCalories: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupByDate(meals: MealEntry[]): DayGroup[] {
  const groups: Record<string, MealEntry[]> = {};
  meals.forEach(m => {
    const date = m.meal_time.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });
  return Object.entries(groups)
    .map(([date, dayMeals]) => ({
      date,
      meals: dayMeals,
      totalCalories: dayMeals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { meals, fetchMealsByDate, fetchMealsByDateRange, deleteMeal } = useMealEntries(user?.id);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangedMeals, setRangedMeals] = useState<MealEntry[]>([]);

  const dateStr = selectedDate.toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (viewMode === 'daily') {
          fetchMealsByDate(dateStr);
        } else if (viewMode === 'weekly') {
          const ws = getWeekStart(selectedDate);
          const we = new Date(ws);
          we.setDate(we.getDate() + 7);
          const data = await fetchMealsByDateRange(ws.toISOString().split('T')[0], we.toISOString().split('T')[0]);
          if (active) setRangedMeals(data);
        } else {
          const ms = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          const me = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
          const data = await fetchMealsByDateRange(ms.toISOString().split('T')[0], me.toISOString().split('T')[0]);
          if (active) setRangedMeals(data);
        }
      };
      load();
      return () => { active = false; };
    }, [viewMode, selectedDate, dateStr, fetchMealsByDate, fetchMealsByDateRange])
  );

  const goToPrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'daily') d.setDate(d.getDate() - 1);
    else if (viewMode === 'weekly') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const goToNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'daily') d.setDate(d.getDate() + 1);
    else if (viewMode === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    if (d <= new Date()) setSelectedDate(d);
  };

  const getHeaderLabel = () => {
    if (viewMode === 'daily') {
      return selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    } else if (viewMode === 'weekly') {
      const ws = getWeekStart(selectedDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - ${we.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
    } else {
      return selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    }
  };

  const handleDelete = useCallback((meal: MealEntry, reload: () => void) => {
    Alert.alert(
      '삭제 확인',
      `${MEAL_TYPE_LABELS[meal.meal_type]} 기록을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeal(meal.id);
              reload();
            } catch {
              Alert.alert('오류', '삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  }, [deleteMeal]);

  const reloadDaily = useCallback(() => fetchMealsByDate(dateStr), [fetchMealsByDate, dateStr]);

  const totalCalories = viewMode === 'daily'
    ? meals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0)
    : rangedMeals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0);

  const dayGroups = viewMode !== 'daily' ? groupByDate(rangedMeals) : [];

  const summaryText = viewMode === 'daily'
    ? `총 ${totalCalories} kcal · ${meals.length}끼`
    : `총 ${totalCalories} kcal · ${dayGroups.length}일 · ${rangedMeals.length}끼`;

  const renderMeal = ({ item }: { item: MealEntry }) => (
    <TouchableOpacity style={styles.mealCard} onPress={() => router.push(`/analysis/${item.id}`)}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.mealThumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.mealTypeBadge, { backgroundColor: Colors[item.meal_type] || Colors.primary }]}>
          <Text style={styles.mealTypeText}>{MEAL_TYPE_LABELS[item.meal_type]}</Text>
        </View>
      )}
      <View style={styles.mealContent}>
        <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[item.meal_type]}</Text>
        <Text style={styles.mealCalories}>{item.nutrition?.calories || 0} kcal</Text>
        <Text style={styles.mealDetails}>
          단 {item.nutrition?.protein_g || 0}g · 탄 {item.nutrition?.carbohydrates_g || 0}g · 지 {item.nutrition?.fat_g || 0}g
        </Text>
        <Text style={styles.mealTime}>
          {new Date(item.meal_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item, reloadDaily)} style={styles.deleteButton}>
        <FontAwesome name="trash-o" size={18} color={Colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderDayGroup = (group: DayGroup) => {
    const date = new Date(group.date + 'T12:00:00');
    const dayLabel = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    return (
      <View key={group.date} style={styles.dayGroup}>
        <TouchableOpacity
          style={styles.dayGroupHeader}
          onPress={() => { setSelectedDate(date); setViewMode('daily'); }}
        >
          <Text style={styles.dayGroupDate}>{dayLabel}</Text>
          <Text style={styles.dayGroupCalories}>{group.totalCalories} kcal · {group.meals.length}끼</Text>
          <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
        </TouchableOpacity>
        {group.meals.map(meal => (
          <TouchableOpacity
            key={meal.id}
            style={styles.compactMealRow}
            onPress={() => router.push(`/analysis/${meal.id}`)}
          >
            <View style={[styles.compactBadge, { backgroundColor: Colors[meal.meal_type] || Colors.primary }]}>
              <Text style={styles.compactBadgeText}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
            </View>
            <Text style={styles.compactCalories}>{meal.nutrition?.calories || 0} kcal</Text>
            <Text style={styles.compactTime}>
              {new Date(meal.meal_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 뷰 모드 탭 */}
      <View style={styles.modeTabs}>
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeTab, viewMode === mode && styles.modeTabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.modeTabText, viewMode === mode && styles.modeTabTextActive]}>
              {mode === 'daily' ? '일' : mode === 'weekly' ? '주간' : '월간'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 날짜 네비게이션 */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPrev} style={styles.navButton}>
          <FontAwesome name="chevron-left" size={16} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{getHeaderLabel()}</Text>
        <TouchableOpacity onPress={goToNext} style={styles.navButton}>
          <FontAwesome name="chevron-right" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 합계 */}
      <View style={styles.dailySummary}>
        <Text style={styles.summaryText}>{summaryText}</Text>
      </View>

      {/* 콘텐츠 */}
      {viewMode === 'daily' ? (
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          renderItem={renderMeal}
          ListEmptyComponent={<Text style={styles.emptyText}>이 날의 기록이 없습니다</Text>}
          contentContainerStyle={meals.length === 0 ? styles.emptyContainer : undefined}
        />
      ) : (
        <ScrollView>
          {dayGroups.length === 0 ? (
            <Text style={styles.emptyText}>이 기간의 기록이 없습니다</Text>
          ) : (
            dayGroups.map(renderDayGroup)
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  modeTabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modeTab: { flex: 1, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  modeTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  modeTabText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  modeTabTextActive: { color: Colors.primary, fontWeight: '700' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: Colors.surface },
  navButton: { padding: Spacing.sm },
  dateText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  dailySummary: { padding: Spacing.sm, backgroundColor: Colors.primaryLight, alignItems: 'center' },
  summaryText: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: '600' },
  // Daily view
  mealCard: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', elevation: 1 },
  mealThumbnail: { width: 56, height: 56, borderRadius: BorderRadius.sm },
  mealTypeBadge: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.sm },
  mealTypeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  mealContent: { flex: 1, marginLeft: Spacing.md },
  mealTypeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  mealCalories: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  mealDetails: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  mealTime: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  deleteButton: { padding: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center', paddingVertical: Spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Weekly / Monthly view
  dayGroup: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden', elevation: 1 },
  dayGroupHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  dayGroupDate: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  dayGroupCalories: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginRight: Spacing.sm },
  compactMealRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  compactBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4, marginRight: Spacing.sm },
  compactBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  compactCalories: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  compactTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
