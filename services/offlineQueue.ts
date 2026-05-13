// services/offlineQueue.ts
// 2026-05-12: 오프라인 큐 관리 (AsyncStorage 기반)

import { MealEntry, QueuedMeal } from '@/types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { uploadImage } from './imageService';
import { supabase } from './supabaseClient';

const QUEUE_KEY = '@foodlens_offline_queue';

// 큐에 식사 기록 추가 (오프라인 시)
export async function addToQueue(
  mealData: Partial<MealEntry>,
  localPhotoUri?: string
): Promise<void> {
  const queue = await getQueue();
  const item: QueuedMeal = {
    id: `temp_${Date.now()}`,
    operation: 'INSERT',
    mealData,
    timestamp: Date.now(),
    localPhotoUri,
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// 큐 조회
export async function getQueue(): Promise<QueuedMeal[]> {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// 큐 개수
export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

// 네트워크 상태 확인
// isInternetReachable은 iOS에서 null로 올 수 있어 isConnected만 체크
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    // isInternetReachable이 null인 경우(판별 전)에는 연결된 것으로 간주
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true; // 판별 실패 시 온라인으로 간주 (Supabase가 직접 에러 반환)
  }
}

// 큐 전체 동기화
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: QueuedMeal[] = [];

  for (const item of queue) {
    try {
      let photoUrl = item.mealData.photo_url;

      // 로컬 사진이 있으면 업로드
      if (item.localPhotoUri && item.mealData.user_id) {
        photoUrl = await uploadImage(
          item.localPhotoUri,
          item.mealData.user_id,
          item.mealData.id || item.id
        );
      }

      // DB에 저장
      if (item.operation === 'INSERT') {
        // 2026-05-12: 테이블명 fl_meal_entries로 변경 (travel-manager 프로젝트 공유)
        const { error } = await supabase.from('fl_meal_entries').insert({
          ...item.mealData,
          photo_url: photoUrl,
          synced_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      synced++;
    } catch (error) {
      console.error('동기화 실패:', item.id, error);
      remaining.push(item);
      failed++;
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, failed };
}

// 큐 초기화 (디버그용)
export async function clearQueue(): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
}
