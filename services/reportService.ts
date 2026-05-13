// services/reportService.ts
// 2026-05-12: 주간/월간 리포트 집계 서비스

import { DailyNutritionSummary, DayGuideData, MealEntry, MealTypeStats, MonthlyReport, NutritionData, TopFood, WeeklyReport } from '@/types/models';
import { supabase } from './supabaseClient';

// ISO 문자열을 로컬 날짜 "YYYY-MM-DD"로 변환 (UTC 기준 split 금지)
function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 날짜 범위로 식사 기록 조회
async function fetchMealsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MealEntry[]> {
  // 2026-05-12: 테이블명 fl_meal_entries로 변경 (travel-manager 프로젝트 공유)
  const { data, error } = await supabase
    .from('fl_meal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('meal_time', startDate)
    .lte('meal_time', endDate)
    .order('meal_time', { ascending: true });

  if (error) throw new Error(`데이터 조회 실패: ${error.message}`);
  return data || [];
}

// 식사 목록을 날짜별로 집계
function aggregateByDate(meals: MealEntry[]): DailyNutritionSummary[] {
  const grouped: Record<string, MealEntry[]> = {};

  for (const meal of meals) {
    const date = toLocalDate(meal.meal_time);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(meal);
  }

  return Object.entries(grouped).map(([date, dayMeals]) => ({
    date,
    calories: dayMeals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
    protein_g: dayMeals.reduce((sum, m) => sum + (m.nutrition?.protein_g || 0), 0),
    carbohydrates_g: dayMeals.reduce((sum, m) => sum + (m.nutrition?.carbohydrates_g || 0), 0),
    fat_g: dayMeals.reduce((sum, m) => sum + (m.nutrition?.fat_g || 0), 0),
    fiber_g: dayMeals.reduce((sum, m) => sum + (m.nutrition?.fiber_g || 0), 0),
    meal_count: dayMeals.length,
  }));
}

// 연속 기록 스트릭 계산
function computeStreak(dailyData: DailyNutritionSummary[]): number {
  if (dailyData.length === 0) return 0;
  const dateSet = new Set(dailyData.map(d => d.date));
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const check = new Date();
  if (!dateSet.has(fmt(check))) check.setDate(check.getDate() - 1);
  let streak = 0;
  while (dateSet.has(fmt(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
    if (streak > 366) break;
  }
  return streak;
}

// 식사 유형별 통계 집계
function aggregateMealTypeStats(meals: MealEntry[]): MealTypeStats {
  const types = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const result = {} as MealTypeStats;
  for (const type of types) {
    const tm = meals.filter(m => m.meal_type === type);
    result[type] = {
      count: tm.length,
      avg_calories: tm.length > 0
        ? Math.round(tm.reduce((s, m) => s + (m.nutrition?.calories || 0), 0) / tm.length)
        : 0,
    };
  }
  return result;
}

// 인기 음식 TOP N 집계
function aggregateTopFoods(meals: MealEntry[], limit = 5): TopFood[] {
  const counts: Record<string, number> = {};
  for (const meal of meals) {
    for (const item of meal.food_items || []) {
      const name = item.name?.trim();
      if (name) counts[name] = (counts[name] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

// 평균 계산
function calculateAverages(dailyData: DailyNutritionSummary[]): NutritionData {
  const days = dailyData.length || 1;
  return {
    calories: Math.round(dailyData.reduce((sum, d) => sum + d.calories, 0) / days),
    protein_g: Math.round(dailyData.reduce((sum, d) => sum + d.protein_g, 0) / days * 10) / 10,
    carbohydrates_g: Math.round(dailyData.reduce((sum, d) => sum + d.carbohydrates_g, 0) / days * 10) / 10,
    fat_g: Math.round(dailyData.reduce((sum, d) => sum + d.fat_g, 0) / days * 10) / 10,
    fiber_g: Math.round(dailyData.reduce((sum, d) => sum + d.fiber_g, 0) / days * 10) / 10,
  };
}

// 주간 리포트 (최근 7일)
export async function getWeeklyReport(userId: string): Promise<WeeklyReport> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  const meals = await fetchMealsByDateRange(userId, startDate.toISOString(), endDate.toISOString());
  const dailyData = aggregateByDate(meals);

  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    daily_data: dailyData,
    averages: calculateAverages(dailyData),
    total_meals: meals.length,
    streak: computeStreak(dailyData),
    record_days: dailyData.length,
    elapsed_days: 7,
    total_period_days: 7,
    meal_type_stats: aggregateMealTypeStats(meals),
    top_foods: aggregateTopFoods(meals),
  };
}

// 월간 리포트
export async function getMonthlyReport(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyReport> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);

  const meals = await fetchMealsByDateRange(userId, startDate.toISOString(), endDate.toISOString());
  const dailyData = aggregateByDate(meals);
  const totalPeriodDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const elapsedDays = isCurrentMonth ? today.getDate() : totalPeriodDays;

  return {
    year,
    month,
    daily_data: dailyData,
    averages: calculateAverages(dailyData),
    total_meals: meals.length,
    streak: computeStreak(dailyData),
    record_days: dailyData.length,
    elapsed_days: elapsedDays,
    total_period_days: totalPeriodDays,
    meal_type_stats: aggregateMealTypeStats(meals),
    top_foods: aggregateTopFoods(meals),
  };
}

// 날짜 범위 리포트 (범용 — 오늘/7일/30일/이번달/직접선택 공통)
export async function getReportByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  elapsedDays: number,
  totalPeriodDays: number,
): Promise<WeeklyReport> {
  const meals = await fetchMealsByDateRange(userId, startDate.toISOString(), endDate.toISOString());
  const dailyData = aggregateByDate(meals);
  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    daily_data: dailyData,
    averages: calculateAverages(dailyData),
    total_meals: meals.length,
    streak: computeStreak(dailyData),
    record_days: dailyData.length,
    elapsed_days: elapsedDays,
    total_period_days: totalPeriodDays,
    meal_type_stats: aggregateMealTypeStats(meals),
    top_foods: aggregateTopFoods(meals),
  };
}

// 건강 가이드용: 기간별 일별 집계 + 음식 이름 포함
export async function getMealsForGuide(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DayGuideData[]> {
  const meals = await fetchMealsByDateRange(
    userId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  const grouped: Record<string, typeof meals> = {};
  for (const meal of meals) {
    const date = toLocalDate(meal.meal_time);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(meal);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMeals]) => {
      const foodNames: string[] = [];
      for (const meal of dayMeals) {
        if (meal.food_items) {
          for (const item of meal.food_items) {
            if (item.name && !foodNames.includes(item.name)) {
              foodNames.push(item.name);
            }
          }
        }
      }
      return {
        date,
        calories: Math.round(dayMeals.reduce((s, m) => s + (m.nutrition?.calories || 0), 0)),
        protein_g: Math.round(dayMeals.reduce((s, m) => s + (m.nutrition?.protein_g || 0), 0) * 10) / 10,
        carbohydrates_g: Math.round(dayMeals.reduce((s, m) => s + (m.nutrition?.carbohydrates_g || 0), 0) * 10) / 10,
        fat_g: Math.round(dayMeals.reduce((s, m) => s + (m.nutrition?.fat_g || 0), 0) * 10) / 10,
        meal_count: dayMeals.length,
        food_names: foodNames,
      };
    });
}

// 특정 날짜의 식사 타입별 존재 여부 확인
export async function checkDayMealTypes(
  userId: string,
  date: Date
): Promise<Record<MealEntry['meal_type'], boolean>> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await supabase
    .from('fl_meal_entries')
    .select('meal_type')
    .eq('user_id', userId)
    .gte('meal_time', startOfDay.toISOString())
    .lt('meal_time', endOfDay.toISOString());

  if (error) throw new Error(`데이터 조회 실패: ${error.message}`);

  const exists = new Set((data || []).map((r: any) => r.meal_type));
  return {
    breakfast: exists.has('breakfast'),
    lunch: exists.has('lunch'),
    dinner: exists.has('dinner'),
    snack: exists.has('snack'),
  };
}

// 한끼 식사 단건 조회 (건강 가이드용)
export async function getSingleMealData(
  userId: string,
  date: Date,
  mealType: MealEntry['meal_type']
): Promise<DayGuideData | null> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await supabase
    .from('fl_meal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_type', mealType)
    .gte('meal_time', startOfDay.toISOString())
    .lt('meal_time', endOfDay.toISOString())
    .order('meal_time', { ascending: false })
    .limit(1);

  if (error) throw new Error(`데이터 조회 실패: ${error.message}`);
  if (!data || data.length === 0) return null;

  const meal = data[0] as MealEntry;
  return {
    date: startOfDay.toISOString().split('T')[0],
    calories: Math.round(meal.nutrition?.calories || 0),
    protein_g: Math.round((meal.nutrition?.protein_g || 0) * 10) / 10,
    carbohydrates_g: Math.round((meal.nutrition?.carbohydrates_g || 0) * 10) / 10,
    fat_g: Math.round((meal.nutrition?.fat_g || 0) * 10) / 10,
    meal_count: 1,
    food_names: meal.food_items?.map(f => f.name).filter(Boolean) || [],
  };
}

// 오늘 영양소 합계
export async function getTodaySummary(userId: string): Promise<DailyNutritionSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const meals = await fetchMealsByDateRange(
    userId,
    startOfDay.toISOString(),
    endOfDay.toISOString()
  );

  const dailyData = aggregateByDate(meals);
  const todayStr = toLocalDate(startOfDay.toISOString());
  const todayData = dailyData.find(d => d.date === todayStr);
  if (todayData) return todayData;

  return {
    date: todayStr,
    calories: 0,
    protein_g: 0,
    carbohydrates_g: 0,
    fat_g: 0,
    fiber_g: 0,
    meal_count: 0,
  };
}
