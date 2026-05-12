// services/supabaseClient.ts
// 2026-05-12: Supabase 클라이언트 초기화
// 2026-05-12: import 경로 수정 (dist/setup → auto, 패키지 구조 변경 대응)

// import 'react-native-url-polyfill/dist/setup'; // 이전 경로 (패키지 구조 변경으로 제거)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
