// app/login.tsx
// 2026-05-12: 로그인 화면 — 이메일/비밀번호 인증

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function LoginScreen() {
  const { signIn } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 2026-05-12: 로그인 실패 시 화면에 에러 메시지 표시
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      // Supabase 에러 메시지를 사용자 친화적으로 변환
      const msg = error.message || '';
      if (msg.includes('Invalid login credentials')) {
        setErrorMessage('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (msg.includes('Email not confirmed')) {
        setErrorMessage('이메일 인증이 완료되지 않았습니다.');
      } else if (msg.includes('Too many requests')) {
        setErrorMessage('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setErrorMessage('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>FoodLens</Text>
        <Text style={styles.subtitle}>AI 식단 분석 & 기록</Text>

        <View style={styles.form}>
          {/* 2026-05-12: 로그인 실패 에러 메시지 인라인 표시 */}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorMessage(''); }}
            placeholder="이메일"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMessage(''); }}
            placeholder="비밀번호"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  title: { fontSize: FontSize.title, fontWeight: 'bold', color: Colors.primary, marginTop: Spacing.md },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  logo: { width: 140, height: 140, marginBottom: Spacing.sm },
  form: { width: '100%' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, backgroundColor: Colors.surface, marginBottom: Spacing.md },
  errorText: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.md, backgroundColor: '#FFF0F0', padding: Spacing.sm, borderRadius: BorderRadius.sm },
  loginButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  loginButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
