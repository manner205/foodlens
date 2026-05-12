// app/_layout.tsx
// 2026-05-12: FoodLens 루트 레이아웃 — 인증 체크 + 네비게이션
// [기존 템플릿 코드 주석 처리 — 원본: FontAwesome font, ThemeProvider, modal 라우트]

import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types/models';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect } from 'react';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// 인증 컨텍스트
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  isAuthenticated: false,
});

export const useAuthContext = () => useContext(AuthContext);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const auth = useAuth();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && !auth.loading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, auth.loading]);

  if (!loaded || auth.loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={auth}>
      <RootLayoutNav />
    </AuthContext.Provider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isAuthenticated } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="camera/index" options={{ title: '식사 촬영', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="analysis/[id]" options={{ title: '분석 결과', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="guide/index" options={{ title: '건강 가이드', headerBackTitle: '뒤로' }} />
      </Stack>
    </ThemeProvider>
  );
}
