// hooks/useAuth.ts
// 2026-05-12: 인증 상태 관리 훅

import { supabase } from '@/services/supabaseClient';
import { User } from '@/types/models';
import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // 포그라운드 복귀 + 인증 갱신 완료 시점을 알리는 타임스탬프
  // 0 = 아직 초기화 전, 그 외 = Date.now() 값
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const prevAppState = useRef<AppStateStatus>('active');

  useEffect(() => {
    console.log('[Auth] init: getSession 시작');
    const timeout = setTimeout(() => {
      console.warn('[Auth] init: 5초 타임아웃 — loading 강제 해제');
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      console.log('[Auth] init: session 존재=', !!session, '/ userId=', session?.user?.id ?? 'none');
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email ?? undefined);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('[Auth] init: getSession 실패', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('[Auth] onAuthStateChange event=', _event, '/ userId=', newSession?.user?.id ?? 'none');
        setSession(newSession);
        if (newSession?.user) {
          await fetchUserProfile(newSession.user.id, newSession.user.email ?? undefined);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 앱이 포그라운드로 돌아올 때 세션 강제 갱신 후 lastRefreshTime 업데이트
  // index.tsx 등 화면에서 lastRefreshTime 변화를 감지해 데이터 재로드
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && prevAppState.current !== 'active') {
        console.log('[Auth] AppState: background → active, getSession 시작');
        try {
          const { data: { session: fresh }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('[Auth] AppState: getSession 오류', error.message);
            return;
          }
          if (fresh?.user) {
            const expiresAt = fresh.expires_at
              ? new Date(fresh.expires_at * 1000).toLocaleTimeString('ko-KR')
              : '정보없음';
            console.log('[Auth] AppState: 세션 유효 / userId=', fresh.user.id, '/ 만료=', expiresAt);
            setSession(fresh);
            await fetchUserProfile(fresh.user.id, fresh.user.email ?? undefined);
            const ts = Date.now();
            setLastRefreshTime(ts);
            console.log('[Auth] AppState: lastRefreshTime 갱신 →', ts);
          } else {
            console.warn('[Auth] AppState: 세션 없음 — user 초기화');
            setSession(null);
            setUser(null);
          }
        } catch (err) {
          console.error('[Auth] AppState: 예외 발생', err);
        }
      }
      prevAppState.current = nextState;
    });
    return () => appStateSub.remove();
  }, []);

  // email 파라미터로 직접 받아 stale session 클로저 버그 방지
  const fetchUserProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('fl_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newUser, error: insertError } = await supabase
          .from('fl_users')
          .insert({ id: userId, email: email || '' })
          .select()
          .single();

        if (!insertError && newUser) setUser(newUser);
      } else if (data) {
        setUser(data);
      } else if (error) {
        console.error('프로필 조회 오류:', error);
      }
    } catch (error) {
      console.error('프로필 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 프로필만 다시 로드 (세션은 유지한 채 user가 null일 때 호출)
  const refetchProfile = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user) {
      await fetchUserProfile(current.user.id, current.user.email ?? undefined);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    // 로컬 상태 먼저 초기화 — 네트워크 실패해도 로그아웃 보장
    setSession(null);
    setUser(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('서버 로그아웃 실패 (로컬 세션은 해제됨):', e);
    }
  };

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!session?.user?.id) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('fl_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('updateProfile 오류:', JSON.stringify(error));
      throw new Error(`저장 실패: ${error.message} (${error.code})`);
    }
    if (data) setUser(data);
  }, [session]);

  return {
    session,
    user,
    loading,
    lastRefreshTime,
    signIn,
    signOut,
    updateProfile,
    refetchProfile,
    isAuthenticated: !!session,
  };
}
