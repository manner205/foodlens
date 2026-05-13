// hooks/useAuth.ts
// 2026-05-12: 인증 상태 관리 훅

import { supabase } from '@/services/supabaseClient';
import { User } from '@/types/models';
import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 5초 안에 응답 없으면 강제로 loading 해제 (스플래시 무한 대기 방지)
    const timeout = setTimeout(() => setLoading(false), 5000);

    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email ?? undefined);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
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

  // 앱이 포그라운드로 돌아올 때 세션 강제 갱신
  // iOS가 백그라운드에서 토큰 갱신 타이머를 멈추기 때문에 필요
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const { data: { session: fresh } } = await supabase.auth.getSession();
        if (fresh?.user) {
          setSession(fresh);
          fetchUserProfile(fresh.user.id, fresh.user.email ?? undefined);
        } else if (!fresh) {
          setSession(null);
          setUser(null);
        }
      }
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

    // upsert: 행이 없으면 생성, 있으면 업데이트
    const { data, error } = await supabase
      .from('fl_users')
      .upsert({
        id: session.user.id,
        email: session.user.email || '',
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('updateProfile 오류:', JSON.stringify(error));
      throw error;
    }
    if (data) setUser(data);
  }, [session]);

  return {
    session,
    user,
    loading,
    signIn,
    signOut,
    updateProfile,
    refetchProfile,
    isAuthenticated: !!session,
  };
}
