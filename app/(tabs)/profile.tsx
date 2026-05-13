// app/(tabs)/profile.tsx
// 2026-05-12: 프로필 설정 — 나이/체중/키/목표 + 일일 칼로리 + 로그아웃

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { calculateDailyCalories } from '@/constants/nutrition';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const { user, updateProfile, signOut } = useAuthContext();

  // 2026-05-12: 닉네임(이름/별명) 필드 추가
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
      setAge(user.age?.toString() || '');
      setWeightKg(user.weight_kg?.toString() || '');
      setHeightCm(user.height_cm?.toString() || '');
      setGoal(user.goal || 'maintain');
      setDailyCalorieGoal(user.daily_calorie_goal?.toString() || '');
    }
  }, [user]);

  const handleAutoCalc = () => {
    const a = parseInt(age);
    const w = parseFloat(weightKg);
    const h = parseInt(heightCm);
    if (!a || !w || !h) {
      Alert.alert('알림', '나이, 체중, 키를 먼저 입력해주세요.');
      return;
    }
    const calories = calculateDailyCalories(w, h, a, goal);
    setDailyCalorieGoal(calories.toString());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        nickname: nickname.trim() || undefined,
        age: parseInt(age) || undefined,
        weight_kg: parseFloat(weightKg) || undefined,
        height_cm: parseInt(heightCm) || undefined,
        goal,
        daily_calorie_goal: parseInt(dailyCalorieGoal) || undefined,
      });
      Alert.alert('완료', '프로필이 저장되었습니다.');
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃 할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive', onPress: async () => {
          try { await signOut(); } catch (e) { /* 로컬 상태는 이미 해제됨 */ }
        }
      },
    ]);
  };

  const goalOptions = [
    { key: 'lose' as const, label: '체중 감량' },
    { key: 'maintain' as const, label: '체중 유지' },
    { key: 'gain' as const, label: '체중 증가' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.email}>{user?.email}</Text>

        {/* 2026-05-12: 이름/별명 입력란 추가 */}
        <Text style={styles.label}>이름 / 별명</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="이름 또는 별명 입력"
        />

        <Text style={styles.label}>나이</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="나이 입력"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>체중 (kg)</Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="체중 입력"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>키 (cm)</Text>
        <TextInput
          style={styles.input}
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="키 입력"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>목표</Text>
        <View style={styles.goalRow}>
          {goalOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.goalButton, goal === opt.key && styles.goalButtonActive]}
              onPress={() => setGoal(opt.key)}
            >
              <Text style={[styles.goalText, goal === opt.key && styles.goalTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>일일 칼로리 목표 (kcal)</Text>
        <View style={styles.calorieRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={dailyCalorieGoal}
            onChangeText={setDailyCalorieGoal}
            placeholder="칼로리 목표"
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.autoButton} onPress={handleAutoCalc}>
            <Text style={styles.autoButtonText}>자동계산</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '프로필 저장'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, elevation: 2 },
  email: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.md, backgroundColor: Colors.background },
  goalRow: { flexDirection: 'row', gap: Spacing.sm },
  goalButton: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  goalButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  goalText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  goalTextActive: { color: Colors.primaryDark, fontWeight: '600' },
  calorieRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  autoButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  autoButtonText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  saveButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  signOutButton: { marginTop: Spacing.lg, padding: Spacing.md, alignItems: 'center' },
  signOutText: { color: Colors.error, fontSize: FontSize.md },
});
