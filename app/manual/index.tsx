// app/manual/index.tsx
// 사진 없이 식사를 직접 입력하는 화면

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { MEAL_TYPE_LABELS } from '@/constants/nutrition';
import { useMealEntries } from '@/hooks/useMealEntries';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { MealEntry } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

function adjustDate(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MEAL_TYPES: MealEntry['meal_type'][] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<MealEntry['meal_type'], string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪',
};

export default function ManualEntryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { saveMeal } = useMealEntries(user?.id);

  const now = new Date();
  const [mealType, setMealType] = useState<MealEntry['meal_type']>('lunch');
  const [mealDate, setMealDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [hour, setHour] = useState(now.getHours());
  const [minute, setMinute] = useState(Math.floor(now.getMinutes() / 15) * 15);
  const [foodItems, setFoodItems] = useState([{ name: '', amount: '' }]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const adjustHour = (d: number) => setHour(h => Math.max(0, Math.min(23, h + d)));
  const adjustMinute = (d: number) => setMinute(m => {
    const next = m + d * 5;
    if (next < 0) return 55;
    if (next > 55) return 0;
    return next;
  });

  const addFoodItem = () => setFoodItems(prev => [...prev, { name: '', amount: '' }]);
  const removeFoodItem = (i: number) => setFoodItems(prev => prev.filter((_, idx) => idx !== i));
  const updateFoodItem = (i: number, field: 'name' | 'amount', val: string) =>
    setFoodItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleDefaultFill = () => {
    const dailyGoal = user?.daily_calorie_goal || 2000;
    setFoodItems([{ name: '간편식', amount: '' }]);
    setCalories(String(Math.round(dailyGoal / 3)));
    setProtein(String(Math.round((dailyGoal * 0.15) / 3 / 4)));
    setCarbs(String(Math.round((dailyGoal * 0.55) / 3 / 4)));
    setFat(String(Math.round((dailyGoal * 0.30) / 3 / 9)));
    setFiber('8');
    if (mealType === 'breakfast') { setHour(8); setMinute(0); }
    else if (mealType === 'lunch') { setHour(13); setMinute(0); }
    else if (mealType === 'dinner') { setHour(19); setMinute(0); }
  };

  const handleSave = async () => {
    if (!calories || parseInt(calories) <= 0) {
      Alert.alert('알림', '칼로리는 필수 입력입니다.');
      return;
    }

    const mealTime = new Date(
      mealDate.getFullYear(), mealDate.getMonth(), mealDate.getDate(),
      hour, minute, 0
    ).toISOString();

    const validFoodItems = foodItems
      .filter(f => f.name.trim())
      .map(f => ({
        name: f.name.trim(),
        quantity: f.amount.trim() || '1',
        unit: f.amount.trim() ? '' : '인분',
      }));

    setSaving(true);
    try {
      await saveMeal({
        meal_type: mealType,
        meal_time: mealTime,
        nutrition: {
          calories: parseInt(calories) || 0,
          protein_g: parseFloat(protein) || 0,
          carbohydrates_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
          fiber_g: parseFloat(fiber) || 0,
        },
        food_items: validFoodItems.length > 0 ? validFoodItems : undefined,
        notes: notes.trim() || undefined,
      });

      Alert.alert('저장 완료', '식사 기록이 저장되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* 식사 종류 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>식사 종류</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.mealTypeBtn, mealType === type && styles.mealTypeBtnActive]}
                onPress={() => setMealType(type)}
              >
                <Text style={styles.mealTypeEmoji}>{MEAL_ICONS[type]}</Text>
                <Text style={[styles.mealTypeLabel, mealType === type && styles.mealTypeLabelActive]}>
                  {MEAL_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 식사 시간 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>식사 시간</Text>
          {/* 날짜 */}
          <View style={styles.timeRow}>
            <Text style={styles.timeRowLabel}>날짜</Text>
            <TouchableOpacity onPress={() => setMealDate(d => adjustDate(d, -1))} style={styles.arrowBtn}>
              <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{formatDate(mealDate)}</Text>
            <TouchableOpacity
              onPress={() => {
                const next = adjustDate(mealDate, 1);
                if (next <= new Date()) setMealDate(next);
              }}
              style={styles.arrowBtn}
            >
              <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {/* 시간 */}
          <View style={styles.timeRow}>
            <Text style={styles.timeRowLabel}>시각</Text>
            <View style={styles.clockRow}>
              <TouchableOpacity onPress={() => adjustHour(-1)} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.clockValue}>{pad(hour)}</Text>
              <TouchableOpacity onPress={() => adjustHour(1)} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.clockColon}>:</Text>
              <TouchableOpacity onPress={() => adjustMinute(-1)} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.clockValue}>{pad(minute)}</Text>
              <TouchableOpacity onPress={() => adjustMinute(1)} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 먹은 음식 */}
        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>먹은 음식 <Text style={styles.optional}>(선택)</Text></Text>
            <TouchableOpacity style={styles.defaultBtn} onPress={handleDefaultFill}>
              <FontAwesome name="magic" size={11} color="#fff" />
              <Text style={styles.defaultBtnText}> 기본 세팅</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>AI 건강 가이드에서 구체적인 조언을 받을 수 있습니다</Text>
          {foodItems.map((item, i) => (
            <View key={i} style={styles.foodItemRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={item.name}
                onChangeText={v => updateFoodItem(i, 'name', v)}
                placeholder={`음식 이름 (예: 된장찌개)`}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: Spacing.xs }]}
                value={item.amount}
                onChangeText={v => updateFoodItem(i, 'amount', v)}
                placeholder="양 (예: 200g)"
                placeholderTextColor={Colors.textLight}
              />
              {foodItems.length > 1 && (
                <TouchableOpacity onPress={() => removeFoodItem(i)} style={styles.removeBtn}>
                  <FontAwesome name="minus-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addFoodBtn} onPress={addFoodItem}>
            <FontAwesome name="plus-circle" size={16} color={Colors.primary} />
            <Text style={styles.addFoodText}>  음식 추가</Text>
          </TouchableOpacity>
        </View>

        {/* 영양 정보 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>영양 정보</Text>

          {/* 칼로리 — 강조 */}
          <Text style={styles.fieldLabel}>칼로리 <Text style={styles.required}>*필수</Text></Text>
          <View style={styles.calorieInputRow}>
            <TextInput
              style={[styles.input, styles.calorieInput]}
              value={calories}
              onChangeText={setCalories}
              placeholder="0"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textLight}
            />
            <Text style={styles.calorieUnit}>kcal</Text>
          </View>

          {/* 나머지 영양소 2열 */}
          <View style={styles.nutriGrid}>
            <View style={styles.nutriCell}>
              <Text style={styles.fieldLabel}>단백질</Text>
              <View style={styles.nutriInputRow}>
                <TextInput
                  style={[styles.input, styles.nutriInput]}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.nutriUnit}>g</Text>
              </View>
            </View>
            <View style={styles.nutriCell}>
              <Text style={styles.fieldLabel}>탄수화물</Text>
              <View style={styles.nutriInputRow}>
                <TextInput
                  style={[styles.input, styles.nutriInput]}
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.nutriUnit}>g</Text>
              </View>
            </View>
            <View style={styles.nutriCell}>
              <Text style={styles.fieldLabel}>지방</Text>
              <View style={styles.nutriInputRow}>
                <TextInput
                  style={[styles.input, styles.nutriInput]}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.nutriUnit}>g</Text>
              </View>
            </View>
            <View style={styles.nutriCell}>
              <Text style={styles.fieldLabel}>식이섬유</Text>
              <View style={styles.nutriInputRow}>
                <TextInput
                  style={[styles.input, styles.nutriInput]}
                  value={fiber}
                  onChangeText={setFiber}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.nutriUnit}>g</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 메모 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>메모 <Text style={styles.optional}>(선택)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="기억나는 내용을 자유롭게 적어보세요"
            placeholderTextColor={Colors.textLight}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 저장 */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <FontAwesome name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>  {saving ? '저장 중...' : '식사 기록 저장'}</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  defaultBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: BorderRadius.sm },
  defaultBtnText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '700' },
  optional: { fontSize: FontSize.xs, color: Colors.textLight, fontWeight: '400' },
  required: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 18 },

  // 식사 종류
  mealTypeRow: { flexDirection: 'row', gap: Spacing.xs },
  mealTypeBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  mealTypeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  mealTypeEmoji: { fontSize: 20, marginBottom: 2 },
  mealTypeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  mealTypeLabelActive: { color: Colors.primaryDark, fontWeight: '700' },

  // 시간
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  timeRowLabel: { width: 36, fontSize: FontSize.sm, color: Colors.textSecondary },
  arrowBtn: { padding: Spacing.sm },
  timeValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, minWidth: 90, textAlign: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'center' },
  clockValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, minWidth: 32, textAlign: 'center' },
  clockColon: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginHorizontal: 2 },

  // 음식 항목
  foodItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  removeBtn: { padding: Spacing.xs, marginLeft: Spacing.xs },
  addFoodBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  addFoodText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  // 입력 공통
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs, fontSize: FontSize.md, backgroundColor: Colors.background, color: Colors.text },

  // 칼로리
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.3 },
  calorieInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  calorieInput: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center', borderColor: Colors.primary, borderWidth: 2 },
  calorieUnit: { fontSize: FontSize.md, color: Colors.textSecondary, marginLeft: Spacing.sm, fontWeight: '600' },

  // 영양소 그리드
  nutriGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  nutriCell: { width: '47%' },
  nutriInputRow: { flexDirection: 'row', alignItems: 'center' },
  nutriInput: { flex: 1, textAlign: 'center' },
  nutriUnit: { fontSize: FontSize.sm, color: Colors.textSecondary, marginLeft: 4 },

  // 메모
  notesInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: Spacing.sm },

  // 저장 버튼
  saveBtn: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, padding: Spacing.md + 2, alignItems: 'center', justifyContent: 'center', elevation: 3, marginBottom: Spacing.sm },
  saveBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
});
