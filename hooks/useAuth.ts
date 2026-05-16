// hooks/useAuth.ts

import { supabase } from '@/services/supabaseClient';
import { User } from '@/types/models';
import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const prevAppState = useRef<AppStateStatus>('active');

  // fetchUserProfile을 useCallback으로 안정화 — useEffect 의존성으로 안전하게 사용하기 위함
  const fetchUserProfile = useCallback(async (userId: string, email?: string) => {
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
        console.error('[Auth] 프로필 조회 오류:', JSON.stringify(error));
      }
    } catch (err) {
      console.error('[Auth] 프로필 조회 예외:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // onAuthStateChange만 사용 — getSession() 중복 호출로 인한 race condition 제거
  useEffect(() => {
    let mounted = true;

    // 타임아웃: 네트워크 장애 등으로 초기화가 15초 이상 지연될 경우 fallback
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] 15초 타임아웃 — loading 강제 해제');
        setLoading(false);
      }
    }, 15000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        const expiresAt = newSession?.expires_at
          ? new Date(newSession.expires_at * 1000).toLocaleTimeString('ko-KR')
          : 'none';
        console.log('[Auth] event=', event, '/ userId=', newSession?.user?.id ?? 'none', '/ expires=', expiresAt);

        if (event === 'SIGNED_OUT') {
          clearTimeout(timeout);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (!newSession) {
          // INITIAL_SESSION에 세션이 없는 경우 (미로그인 또는 세션 파기)
          clearTimeout(timeout);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // 유효한 세션 (INITIAL_SESSION valid / TOKEN_REFRESHED / SIGNED_IN)
        clearTimeout(timeout);
        setSession(newSession);
        if (newSession.user) {
          await fetchUserProfile(newSession.user.id, newSession.user.email ?? undefined);
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // 세션은 있는데 user가 null인 경우 재시도 (QR 진입 시 순간 네트워크 오류 대응)
  // loading이 false가 된 뒤에도 user가 없으면 2초 후 자동 재시도
  useEffect(() => {
    if (!loading && session?.user && !user) {
      console.log('[Auth] 세션 있으나 user 없음 — 2초 후 프로필 재조회');
      const retryTimer = setTimeout(() => {
        fetchUserProfile(session.user!.id, session.user!.email ?? undefined);
      }, 2000);
      return () => clearTimeout(retryTimer);
    }
  }, [loading, session?.user?.id, user, fetchUserProfile]);

  // 앱이 포그라운드로 돌아올 때 세션 강제 갱신 후 lastRefreshTime 업데이트
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
  }, [fetchUserProfile]);

  const refetchProfile = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user) {
      await fetchUserProfile(current.user.id, current.user.email ?? undefined);
    }
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
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
