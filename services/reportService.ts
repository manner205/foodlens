// services/reportService.ts
// 2026-05-12: 주간/월간 리포트 집계 서비스

import { DailyNutritionSummary, MealEntry, MonthlyReport, NutritionData, WeeklyReport } from '@/types/models';
import { supabase } from './supabaseClient';

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
    const date = meal.meal_time.split('T')[0]; // "2026-05-12"
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

  const meals = await fetchMealsByDateRange(
    userId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  const dailyData = aggregateByDate(meals);

  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    daily_data: dailyData,
    averages: calculateAverages(dailyData),
    total_meals: meals.length,
  };
}

// 월간 리포트
export async function getMonthlyReport(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyReport> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // 해당 월 마지막 날
  endDate.setHours(23, 59, 59, 999);

  const meals = await fetchMealsByDateRange(
    userId,
    startDate.toISOString(),
    endDate.toISOString()
  );

  const dailyData = aggregateByDate(meals);

  return {
    year,
    month,
    daily_data: dailyData,
    averages: calculateAverages(dailyData),
    total_meals: meals.length,
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
  if (dailyData.length > 0) return dailyData[0];

  return {
    date: startOfDay.toISOString().split('T')[0],
    calories: 0,
    protein_g: 0,
    carbohydrates_g: 0,
    fat_g: 0,
    fiber_g: 0,
    meal_count: 0,
  };
}
