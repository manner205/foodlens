// hooks/useAuth.ts
// 2026-05-12: 인증 상태 관리 훅

import { supabase } from '@/services/supabaseClient';
import { User } from '@/types/models';
import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

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
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // 2026-05-12: 테이블명 fl_users로 변경 (travel-manager 프로젝트 공유)
      const { data, error } = await supabase
        .from('fl_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // 프로필이 없으면 기본 프로필 생성
        const { data: newUser, error: insertError } = await supabase
          .from('fl_users')
          .insert({
            id: userId,
            email: session?.user?.email || '',
          })
          .select()
          .single();

        if (!insertError) setUser(newUser);
      } else if (data) {
        setUser(data);
      }
    } catch (error) {
      console.error('프로필 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from('fl_users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    if (data) setUser(data);
  }, [session]);

  return {
    session,
    user,
    loading,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!session,
  };
}
