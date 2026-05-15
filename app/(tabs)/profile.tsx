// app/(tabs)/profile.tsx

import { useAuthContext } from '@/app/_layout';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Text, View } from '@/components/Themed';
import { CalorieBreakdown, calculateDailyCaloriesWithBreakdown } from '@/constants/nutrition';
import { pickFromGallery, takePhoto, uploadAvatar } from '@/services/imageService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

const PRESET_CHARACTERS = [
  '🐱', '🐶', '🦊', '🐸', '🐨', '🐼',
  '🦁', '🐯', '🐰', '🐻', '🦋', '🌸',
  '⭐', '🍎', '🥑', '💪',
];

export default function ProfileScreen() {
  const { user, updateProfile, signOut, refetchProfile, session } = useAuthContext();

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState('');
  const [breakdown, setBreakdown] = useState<CalorieBreakdown | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const retried = useRef(false);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
      setAge(user.age?.toString() || '');
      setWeightKg(user.weight_kg?.toString() || '');
      setHeightCm(user.height_cm?.toString() || '');
      setGender(user.gender || 'male');
      setGoal(user.goal || 'maintain');
      setTargetWeightKg(user.target_weight_kg?.toString() || '');
      setDailyCalorieGoal(user.daily_calorie_goal?.toString() || '');
      setAvatarUrl(user.avatar_url);
    } else if (session && !retried.current) {
      // 세션은 있지만 프로필이 null인 경우 자동 재시도 (1회)
      retried.current = true;
      refetchProfile();
    }
  }, [user, session]);

  const handleAvatarPress = () => {
    Alert.alert('프로필 사진', '사진을 변경하세요', [
      { text: '갤러리에서 선택', onPress: handlePickPhoto },
      { text: '카메라로 촬영', onPress: handleTakePhoto },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handlePickPhoto = async () => {
    try {
      const result = await pickFromGallery();
      if (result.canceled || !result.assets[0]) return;
      await saveAvatarPhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('오류', e.message || '사진 선택에 실패했습니다.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takePhoto();
      if (result.canceled || !result.assets[0]) return;
      await saveAvatarPhoto(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('오류', e.message || '카메라 촬영에 실패했습니다.');
    }
  };

  const saveAvatarPhoto = async (uri: string) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const path = await uploadAvatar(uri, user.id);
      setAvatarUrl(path);
      await updateProfile({ avatar_url: path });
    } catch (e: any) {
      Alert.alert('오류', e.message || '사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectCharacter = async (char: string) => {
    const newUrl = `character:${char}`;
    setAvatarUrl(newUrl);
    try {
      await updateProfile({ avatar_url: newUrl });
    } catch {
      Alert.alert('오류', '캐릭터 저장에 실패했습니다.');
    }
  };

  const handleAutoCalc = () => {
    const a = parseInt(age);
    const w = parseFloat(weightKg);
    const h = parseInt(heightCm);
    if (!a || !w || !h) {
      Alert.alert('알림', '나이, 체중, 키를 먼저 입력해주세요.');
      return;
    }
    const tw = goal !== 'maintain' ? (parseFloat(targetWeightKg) || undefined) : undefined;
    if (goal !== 'maintain' && !tw) {
      Alert.alert('알림', '목표 체중을 입력해주세요.');
      return;
    }
    const bd = calculateDailyCaloriesWithBreakdown(w, h, a, goal, gender === 'male', tw);
    setDailyCalorieGoal(bd.result.toString());
    setBreakdown(bd);
    setShowFormula(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.race([
        updateProfile({
          nickname: nickname.trim() || undefined,
          age: parseInt(age) || undefined,
          weight_kg: parseFloat(weightKg) || undefined,
          height_cm: parseInt(heightCm) || undefined,
          gender,
          goal,
          target_weight_kg: goal !== 'maintain' ? (parseFloat(targetWeightKg) || undefined) : undefined,
          daily_calorie_goal: parseInt(dailyCalorieGoal) || undefined,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('요청 시간 초과 (30초). 네트워크를 확인하세요.')), 30000)
        ),
      ]);
      Alert.alert('완료', '프로필이 저장되었습니다.');
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃 할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive', onPress: async () => {
          try { await signOut(); } catch { /* 로컬 상태 해제됨 */ }
        },
      },
    ]);
  };

  const displayName = nickname || user?.email?.split('@')[0] || '사용자';
  const goalOptions = [
    { key: 'lose' as const, label: '체중 감량' },
    { key: 'maintain' as const, label: '체중 유지' },
    { key: 'gain' as const, label: '체중 증가' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ─── 아바타 헤더 ─── */}
      <View style={styles.avatarHeader}>
        <View style={styles.avatarBg} />
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handleAvatarPress}
          disabled={uploading}
        >
          <AvatarDisplay avatarUrl={avatarUrl} size={96} style={styles.avatarImage} />
          <View style={styles.cameraOverlay}>
            {uploading
              ? <FontAwesome name="spinner" size={15} color="#fff" />
              : <FontAwesome name="camera" size={15} color="#fff" />
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>
      </View>

      {/* ─── 캐릭터 선택 ─── */}
      <View style={styles.characterCard}>
        <Text style={styles.sectionLabel}>캐릭터 선택</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.characterScroll}>
          {PRESET_CHARACTERS.map(char => {
            const isActive = avatarUrl === `character:${char}`;
            return (
              <TouchableOpacity
                key={char}
                style={[styles.charOption, isActive && styles.charOptionActive]}
                onPress={() => handleSelectCharacter(char)}
              >
                <Text style={styles.charEmoji}>{char}</Text>
                {isActive && <View style={styles.charCheck}><Text style={{ fontSize: 9, color: '#fff' }}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.charHint}>또는 위 아바타를 눌러 사진을 등록하세요</Text>
      </View>

      {/* ─── 프로필 폼 ─── */}
      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>내 정보</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>이름 / 별명</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="이름 또는 별명 입력"
            placeholderTextColor={Colors.textLight}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>성별</Text>
          <View style={styles.goalRow}>
            {([{ key: 'male', label: '남성' }, { key: 'female', label: '여성' }] as const).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.goalButton, gender === opt.key && styles.goalButtonActive]}
                onPress={() => setGender(opt.key)}
              >
                <Text style={[styles.goalText, gender === opt.key && styles.goalTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.rowFields}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: Spacing.sm }]}>
            <Text style={styles.label}>나이</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="세"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              placeholder="cm"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textLight}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>체중 (kg)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder="kg"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.textLight}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>목표</Text>
          <View style={styles.goalRow}>
            {goalOptions.map(opt => (
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
        </View>

        {goal !== 'maintain' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>목표 체중 (kg)</Text>
            <TextInput
              style={styles.input}
              value={targetWeightKg}
              onChangeText={setTargetWeightKg}
              placeholder={goal === 'lose' ? '현재보다 낮은 체중' : '현재보다 높은 체중'}
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.textLight}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>일일 칼로리 목표 (kcal)</Text>
          <View style={styles.calorieRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={dailyCalorieGoal}
              onChangeText={setDailyCalorieGoal}
              placeholder="kcal"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textLight}
            />
            <TouchableOpacity style={styles.autoButton} onPress={handleAutoCalc}>
              <Text style={styles.autoButtonText}>자동계산</Text>
            </TouchableOpacity>
          </View>

          {breakdown && (
            <View style={styles.breakdownBox}>
              <Text style={styles.breakdownSummary}>
                {breakdown.goal !== 'maintain' && breakdown.target_weight_kg
                  ? `목표 ${breakdown.target_weight_kg}kg 기준  `
                  : '현재 체중 기준  '}
                BMR {breakdown.bmr} × 1.55 = {breakdown.result} kcal
              </Text>
              {breakdown.goal !== 'maintain' && breakdown.target_weight_kg && (
                <Text style={styles.breakdownDiff}>
                  현재 체중 유지 {breakdown.current_tdee} kcal 대비{' '}
                  {breakdown.result < breakdown.current_tdee
                    ? `−${breakdown.current_tdee - breakdown.result}`
                    : `+${breakdown.result - breakdown.current_tdee}`} kcal
                </Text>
              )}
              <TouchableOpacity
                style={styles.formulaToggle}
                onPress={() => setShowFormula(v => !v)}
              >
                <Text style={styles.formulaToggleText}>
                  {showFormula ? '▲ 공식 접기' : '▼ 계산 공식 보기'}
                </Text>
              </TouchableOpacity>
              {showFormula && (
                <View style={styles.formulaBox}>
                  <Text style={styles.formulaTitle}>
                    ① BMR (기초대사량) — Mifflin-St Jeor
                    {breakdown.goal !== 'maintain' && breakdown.target_weight_kg
                      ? `  [목표 ${breakdown.target_weight_kg}kg 기준]`
                      : ''}
                  </Text>
                  <Text style={styles.formulaLine}>
                    {breakdown.isMale
                      ? `10×${breakdown.calc_weight_kg} + 6.25×${breakdown.height_cm} - 5×${breakdown.age} + 5`
                      : `10×${breakdown.calc_weight_kg} + 6.25×${breakdown.height_cm} - 5×${breakdown.age} - 161`
                    } = {breakdown.bmr} kcal
                  </Text>
                  <Text style={styles.formulaTitle}>② TDEE (총 소모 칼로리)</Text>
                  <Text style={styles.formulaLine}>
                    BMR {breakdown.bmr} × 활동계수 1.55 = {breakdown.tdee} kcal
                  </Text>
                  <Text style={styles.formulaTitle}>③ 목표 보정 방식</Text>
                  <Text style={styles.formulaLine}>
                    {breakdown.goal === 'maintain'
                      ? '현재 체중 유지 → TDEE 그대로 적용'
                      : breakdown.goal === 'lose'
                        ? `목표 체중(${breakdown.target_weight_kg}kg) 기준 유지 칼로리로 설정\n→ 현재보다 적게 먹어 자연스럽게 감량`
                        : `목표 체중(${breakdown.target_weight_kg}kg) 기준 유지 칼로리로 설정\n→ 현재보다 더 먹어 자연스럽게 증량`
                    }
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <FontAwesome name="check" size={16} color="#fff" />
          <Text style={styles.saveButtonText}>  {saving ? '저장 중...' : '프로필 저장'}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 데이터 새로고침 (user가 null일 때) ─── */}
      {!user && session && (
        <TouchableOpacity style={styles.refetchButton} onPress={refetchProfile}>
          <FontAwesome name="refresh" size={14} color={Colors.primary} />
          <Text style={styles.refetchText}>  프로필 데이터 다시 불러오기</Text>
        </TouchableOpacity>
      )}

      {/* ─── 로그아웃 ─── */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <FontAwesome name="sign-out" size={16} color={Colors.error} />
        <Text style={styles.signOutText}>  로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // 아바타 헤더
  avatarHeader: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, marginBottom: Spacing.md, position: 'relative' },
  avatarBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: Colors.primaryLight, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  avatarWrapper: { width: 96, height: 96, position: 'relative', marginBottom: Spacing.sm },
  avatarImage: { borderWidth: 3, borderColor: '#fff' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  displayName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  emailText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // 캐릭터 선택
  characterCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  characterScroll: { marginBottom: Spacing.xs },
  charOption: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  charOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  charEmoji: { fontSize: 26 },
  charCheck: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  charHint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.xs },

  // 폼 카드
  formCard: { marginHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, elevation: 2 },
  formCardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  fieldGroup: { marginBottom: Spacing.md },
  rowFields: { flexDirection: 'row' },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm + 2, fontSize: FontSize.md, backgroundColor: Colors.background, color: Colors.text },
  goalRow: { flexDirection: 'row', gap: Spacing.sm },
  goalButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  goalButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  goalText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  goalTextActive: { color: Colors.primaryDark, fontWeight: '700' },
  calorieRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  autoButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.sm },
  autoButtonText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  breakdownBox: { marginTop: Spacing.sm, backgroundColor: Colors.background, borderRadius: BorderRadius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  breakdownSummary: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600', marginBottom: 2 },
  breakdownDiff: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  formulaToggle: { alignSelf: 'flex-start', marginTop: 2 },
  formulaToggleText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  formulaBox: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: 4 },
  formulaTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginTop: 4 },
  formulaLine: { fontSize: FontSize.xs, color: Colors.text, lineHeight: 18 },
  saveButton: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  saveButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },

  // 로그아웃
  signOutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  signOutText: { color: Colors.error, fontSize: FontSize.md },
  refetchButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.sm },
  refetchText: { color: Colors.primary, fontSize: FontSize.sm },
});
