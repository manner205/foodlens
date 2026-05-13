// hooks/useMealEntries.ts
// 2026-05-12: 식사 데이터 CRUD 훅

import { addToQueue, isOnline } from '@/services/offlineQueue';
import { supabase } from '@/services/supabaseClient';
import { MealEntry } from '@/types/models';
import { useCallback, useState } from 'react';

// "YYYY-MM-DD" 문자열을 로컬 자정 Date로 파싱 (new Date("YYYY-MM-DD")는 UTC로 파싱되어 KST에서 날짜가 어긋남)
function localMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function useMealEntries(userId: string | undefined) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 오늘 식사 목록 조회
  const fetchTodayMeals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      // 2026-05-12: 테이블명 fl_meal_entries로 변경 (travel-manager 프로젝트 공유)
      const { data, error } = await supabase
        .from('fl_meal_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('meal_time', startOfDay.toISOString())
        .lt('meal_time', endOfDay.toISOString())
        .order('meal_time', { ascending: true });

      if (error) throw error;
      setMeals(data || []);
    } catch (err: any) {
      console.error('오늘 식사 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 날짜별 식사 목록 조회
  const fetchMealsByDate = useCallback(async (date: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const startOfDay = localMidnight(date);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data, error } = await supabase
        .from('fl_meal_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('meal_time', startOfDay.toISOString())
        .lt('meal_time', endOfDay.toISOString())
        .order('meal_time', { ascending: true });

      if (error) throw error;
      setMeals(data || []);
    } catch (err: any) {
      console.error('날짜별 식사 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 식사 기록 저장 (온라인/오프라인 자동 판별)
  const saveMeal = useCallback(async (
    mealData: Partial<MealEntry>,
    localPhotoUri?: string
  ): Promise<MealEntry | null> => {
    if (!userId) return null;

    const online = await isOnline();

    if (!online) {
      await addToQueue({ ...mealData, user_id: userId }, localPhotoUri);
      return mealData as MealEntry;
    }

    const { data, error } = await supabase
      .from('fl_meal_entries')
      .insert({
        ...mealData,
        user_id: userId,
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }, [userId]);

  // 식사 기록 수정
  const updateMeal = useCallback(async (
    mealId: string,
    updates: Partial<MealEntry>
  ): Promise<void> => {
    const { error } = await supabase
      .from('fl_meal_entries')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', mealId)
      .eq('user_id', userId);

    if (error) throw error;
  }, [userId]);

  // 날짜 범위 식사 목록 조회 (주간/월간용, 데이터 직접 반환)
  const fetchMealsByDateRange = useCallback(async (startDate: string, endDate: string): Promise<MealEntry[]> => {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('fl_meal_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('meal_time', localMidnight(startDate).toISOString())
        .lt('meal_time', localMidnight(endDate).toISOString())
        .order('meal_time', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('식사 범위 조회 실패:', error);
      return [];
    }
  }, [userId]);

  // 식사 기록 단건 조회
  const fetchMealById = useCallback(async (mealId: string): Promise<MealEntry | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('fl_meal_entries')
      .select('*')
      .eq('id', mealId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }, [userId]);

  // 식사 기록 삭제
  const deleteMeal = useCallback(async (mealId: string): Promise<void> => {
    const { error } = await supabase
      .from('fl_meal_entries')
      .delete()
      .eq('id', mealId)
      .eq('user_id', userId);

    if (error) throw error;
    setMeals(prev => prev.filter(m => m.id !== mealId));
  }, [userId]);

  return {
    meals,
    loading,
    fetchTodayMeals,
    fetchMealsByDate,
    fetchMealsByDateRange,
    fetchMealById,
    saveMeal,
    updateMeal,
    deleteMeal,
  };
}
