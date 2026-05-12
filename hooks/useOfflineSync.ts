// hooks/useOfflineSync.ts
// 2026-05-12: 오프라인 동기화 훅 — 앱 포그라운드 복귀 시 자동 동기화

import { getQueueCount, isOnline, syncQueue } from '@/services/offlineQueue';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const checkAndSync = useCallback(async () => {
    const online = await isOnline();
    const count = await getQueueCount();
    setPendingCount(count);

    if (online && count > 0) {
      setSyncing(true);
      try {
        const result = await syncQueue();
        const newCount = await getQueueCount();
        setPendingCount(newCount);
        if (result.synced > 0) {
          console.log(`동기화 완료: ${result.synced}건 성공, ${result.failed}건 실패`);
        }
      } catch (error) {
        console.error('동기화 오류:', error);
      } finally {
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    // 앱 시작 시 동기화 시도
    checkAndSync();

    // 앱 포그라운드 복귀 시 동기화
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkAndSync();
      }
    });

    return () => subscription.remove();
  }, [checkAndSync]);

  return { pendingCount, syncing, checkAndSync };
}
