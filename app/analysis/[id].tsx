// app/analysis/[id].tsx
// 2026-05-12: 분석 결과 화면 — AI 결과 표시/수정 + 식사 유형 + 시간 + 저장

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '@/constants/nutrition';
import { useMealEntries } from '@/hooks/useMealEntries';
import { getSignedPhotoUrl, uploadImage } from '@/services/imageService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { MealEntry, NutritionData } from '@/types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function AnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthContext();
  const { saveMeal, updateMeal, fetchMealById } = useMealEntries(user?.id);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<NutritionData>({
    calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0, fiber_g: 0,
  });
  const [foodItems, setFoodItems] = useState<string>('');
  const [mealType, setMealType] = useState<MealEntry['meal_type']>('lunch');
  const [mealTime, setMealTime] = useState(new Date().toISOString());
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isExisting, setIsExisting] = useState(false);

  useEffect(() => {
    loadAnalysisData();
  }, [id]);

  const loadAnalysisData = async () => {
    if (!id) return;

    // 임시 분석 데이터 (카메라에서 넘어온 경우)
    if (id.startsWith('temp_')) {
      const stored = await AsyncStorage.getItem(`@analysis_${id}`);
      if (stored) {
        const { analysisResult, imageUri: img, originalUri: orig, mealTime: time } = JSON.parse(stored);
        setImageUri(img);
        setOriginalUri(orig);
        setMealTime(time);

        if (analysisResult) {
          setNutrition(analysisResult.nutrition);
          setFoodItems(analysisResult.food_items?.map((f: any) => `${f.name} ${f.quantity}${f.unit}`).join(', ') || '');
          setConfidenceScore(analysisResult.confidence_score);
          setWarnings(analysisResult.warnings || []);
          autoDetectMealType(time);
        }
      }
    } else {
      // 기존 기록 조회 (히스토리에서 탭한 경우)
      setIsExisting(true);
      try {
        const meal = await fetchMealById(id);
        if (meal) {
          setNutrition(meal.nutrition);
          setFoodItems(meal.food_items?.map(f => [f.name, f.quantity, f.unit].filter(Boolean).join(' ')).join(', ') || '');
          setMealType(meal.meal_type);
          setMealTime(meal.meal_time);
          if (meal.photo_url) {
            const signed = await getSignedPhotoUrl(meal.photo_url);
            setImageUri(signed);
          }
        }
      } catch (error) {
        Alert.alert('오류', '기록을 불러오는데 실패했습니다.');
      }
    }
  };

  // 시간 기반 식사 유형 자동 감지
  const autoDetectMealType = (timeStr: string) => {
    const hour = new Date(timeStr).getHours();
    if (hour >= 5 && hour < 10) setMealType('breakfast');
    else if (hour >= 10 && hour < 15) setMealType('lunch');
    else if (hour >= 15 && hour < 21) setMealType('dinner');
    else setMealType('snack');
  };

  const updateNutrition = (key: keyof NutritionData, value: string) => {
    setNutrition(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      let photoUrl: string | undefined;

      // 이미지 업로드
      if (originalUri && !isExisting) {
        try {
          photoUrl = await uploadImage(originalUri, user.id, id || 'unknown');
        } catch {
          // 업로드 실패해도 기록은 저장 (오프라인 가능성)
          console.warn('이미지 업로드 실패, 기록만 저장');
        }
      }

      const mealData: Partial<MealEntry> = {
        meal_type: mealType,
        meal_time: mealTime,
        nutrition,
        food_items: foodItems.split(',').map(f => ({
          name: f.trim(),
          quantity: '',
          unit: '',
        })),
        photo_url: photoUrl,
      };

      if (isExisting && id) {
        await updateMeal(id, mealData);
      } else {
        await saveMeal(mealData, originalUri || undefined);
      }

      // 임시 데이터 정리
      if (id?.startsWith('temp_')) {
        await AsyncStorage.removeItem(`@analysis_${id}`);
      }

      Alert.alert('완료', '식사가 기록되었습니다.', [
        { text: '확인', onPress: () => router.replace('/') },
      ]);
    } catch (error: any) {
      Alert.alert('오류', error.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 이미지 미리보기 */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.preview}
          resizeMode="contain"
          onError={() => setImageUri(null)}
        />
      ) : isExisting ? (
        <View style={[styles.preview, styles.noImage]}>
          <Text style={styles.noImageText}>사진 없음</Text>
        </View>
      ) : null}

      {/* 신뢰도 */}
      {confidenceScore > 0 && (
        <View style={[styles.confidenceBadge, confidenceScore < 60 && { backgroundColor: Colors.warning }]}>
          <Text style={styles.confidenceText}>
            AI 신뢰도: {confidenceScore}%
            {confidenceScore < 60 ? ' — 수정을 권장합니다' : ''}
          </Text>
        </View>
      )}

      {/* 경고 메시지 */}
      {warnings.map((w, i) => (
        <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
      ))}

      {/* 식사 유형 선택 */}
      <Text style={styles.label}>식사 유형</Text>
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.mealTypeButton, mealType === type && styles.mealTypeActive]}
            onPress={() => setMealType(type)}
          >
            <Text style={[styles.mealTypeText, mealType === type && styles.mealTypeTextActive]}>
              {MEAL_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 식사 시간 */}
      <Text style={styles.label}>식사 시간</Text>
      <Text style={styles.timeText}>
        {new Date(mealTime).toLocaleString('ko-KR', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </Text>

      {/* 인식된 음식 */}
      <Text style={styles.label}>인식된 음식</Text>
      <TextInput
        style={styles.foodInput}
        value={foodItems}
        onChangeText={setFoodItems}
        placeholder="음식 이름 (쉼표로 구분)"
        multiline
      />

      {/* 영양소 수정 */}
      <Text style={styles.sectionTitle}>영양소 정보</Text>
      <NutritionInput label="칼로리 (kcal)" value={nutrition.calories} onChange={(v) => updateNutrition('calories', v)} color={Colors.calories} />
      <NutritionInput label="단백질 (g)" value={nutrition.protein_g} onChange={(v) => updateNutrition('protein_g', v)} color={Colors.protein} />
      <NutritionInput label="탄수화물 (g)" value={nutrition.carbohydrates_g} onChange={(v) => updateNutrition('carbohydrates_g', v)} color={Colors.carbs} />
      <NutritionInput label="지방 (g)" value={nutrition.fat_g} onChange={(v) => updateNutrition('fat_g', v)} color={Colors.fat} />
      <NutritionInput label="식이섬유 (g)" value={nutrition.fiber_g} onChange={(v) => updateNutrition('fiber_g', v)} color={Colors.fiber} />

      {/* 저장 버튼 */}
      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? '저장 중...' : '저장'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function NutritionInput({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: string) => void; color: string;
}) {
  return (
    <View style={styles.nutritionRow}>
      <View style={[styles.nutritionDot, { backgroundColor: color }]} />
      <Text style={styles.nutritionLabel}>{label}</Text>
      <TextInput
        style={styles.nutritionInput}
        value={value.toString()}
        onChangeText={onChange}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  preview: { width: '100%', height: 300, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, backgroundColor: '#000' },
  noImage: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  noImageText: { color: Colors.textSecondary, fontSize: FontSize.md },
  confidenceBadge: { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm, alignItems: 'center' },
  confidenceText: { fontSize: FontSize.sm, fontWeight: '600' },
  warningText: { fontSize: FontSize.sm, color: Colors.accentDark, marginBottom: 4 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
  mealTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  mealTypeButton: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  mealTypeActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  mealTypeText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  mealTypeTextActive: { color: Colors.primaryDark, fontWeight: '600' },
  timeText: { fontSize: FontSize.md, color: Colors.text, padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.sm },
  foodInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.sm, fontSize: FontSize.md, backgroundColor: Colors.surface, minHeight: 60 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  nutritionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  nutritionDot: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.sm },
  nutritionLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  nutritionInput: { width: 100, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, padding: Spacing.xs, fontSize: FontSize.md, textAlign: 'right', backgroundColor: Colors.surface },
  saveButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  saveButtonText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
});
