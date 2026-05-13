// app/guide/index.tsx

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { getHealthGuide } from '@/services/geminiService';
import { checkDayMealTypes, getMealsForGuide, getSingleMealData } from '@/services/reportService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { DayGuideData, HealthGuideResult, MealEntry } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

type Period = '한끼' | '오늘' | '7일' | '30일' | '이번달' | '직접선택';

const MEAL_TYPE_LABELS: Record<MealEntry['meal_type'], string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

function getDateRange(period: Period, customStart?: Date, customEnd?: Date): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === '오늘') {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { start: today, end, label: '오늘' };
  }
  if (period === '7일') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { start, end: now, label: '최근 7일' };
  }
  if (period === '30일') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { start, end: now, label: '최근 30일' };
  }
  if (period === '이번달') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: `${now.getMonth() + 1}월 전체` };
  }
  // 직접선택
  const s = customStart ?? today;
  const e = customEnd ?? now;
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return { start: s, end: e, label: `${fmt(s)} ~ ${fmt(e)}` };
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function adjustDate(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function GuideScreen() {
  const { user } = useAuthContext();
  const [guide, setGuide] = useState<HealthGuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('7일');
  const [mealType, setMealType] = useState<MealEntry['meal_type']>('lunch');
  const [customStart, setCustomStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [customEnd, setCustomEnd] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [analyzedLabel, setAnalyzedLabel] = useState<string | null>(null);
  const [mealAvailability, setMealAvailability] = useState<Record<MealEntry['meal_type'], boolean>>({
    breakfast: false, lunch: false, dinner: false, snack: false,
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  useEffect(() => {
    if (period !== '한끼' || !user?.id) return;
    let cancelled = false;
    setAvailabilityLoading(true);
    checkDayMealTypes(user.id, customStart)
      .then(result => { if (!cancelled) setMealAvailability(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [period, customStart, user?.id]);

  const loadGuide = async () => {
    if (!user?.id) return;

    if (!user.age || !user.weight_kg || !user.height_cm) {
      setError('프로필에서 나이, 체중, 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setGuide(null);

    try {
      if (period === '한끼') {
        const label = `${formatDate(customStart)} ${MEAL_TYPE_LABELS[mealType]}`;
        const mealData = await getSingleMealData(user.id, customStart, mealType);
        if (!mealData) {
          setError(`${label} 식사 기록이 없습니다.`);
          return;
        }
        const result = await getHealthGuide(user, [mealData], label, true);
        setGuide(result);
        setAnalyzedLabel(label);
      } else {
        const { start, end, label } = getDateRange(period, customStart, customEnd);
        const data: DayGuideData[] = await getMealsForGuide(user.id, start, end);

        if (data.length === 0 || data.every(d => d.meal_count === 0)) {
          setError(`선택한 기간(${label})에 식사 기록이 없습니다.`);
          return;
        }

        const result = await getHealthGuide(user, data, label, false, period === '오늘');
        setGuide(result);
        setAnalyzedLabel(label);
      }
    } catch (err: any) {
      setError(err.message || 'AI 가이드를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const PERIODS: Period[] = ['한끼', '오늘', '7일', '30일', '이번달', '직접선택'];

  return (
    <ScrollView style={styles.container}>
      {/* 기간 선택 */}
      <View style={styles.periodSection}>
        <Text style={styles.sectionTitle}>분석 기간 선택</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => { setPeriod(p); setGuide(null); setError(null); }}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 한끼 선택 UI */}
        {period === '한끼' && (
          <View style={styles.customDateSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>날짜</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, -1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.dateValue}>{formatDate(customStart)}</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, 1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.mealTypeRow}>
              {(Object.entries(MEAL_TYPE_LABELS) as [MealEntry['meal_type'], string][]).map(([type, label]) => {
                const hasData = mealAvailability[type];
                const isSelected = mealType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.mealTypeBtn,
                      isSelected && styles.mealTypeBtnActive,
                      hasData && !isSelected && styles.mealTypeBtnHasData,
                    ]}
                    onPress={() => setMealType(type)}
                  >
                    <Text style={[
                      styles.mealTypeBtnText,
                      isSelected && styles.mealTypeBtnTextActive,
                      hasData && !isSelected && styles.mealTypeBtnTextHasData,
                    ]}>{label}</Text>
                    {availabilityLoading
                      ? <View style={styles.dotLoading} />
                      : hasData
                        ? <View style={[styles.dot, styles.dotHas]} />
                        : <View style={[styles.dot, styles.dotNone]} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 직접선택 날짜 조정 */}
        {period === '직접선택' && (
          <View style={styles.customDateSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>시작일</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, -1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.dateValue}>{formatDate(customStart)}</Text>
              <TouchableOpacity onPress={() => setCustomStart(d => adjustDate(d, 1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>종료일</Text>
              <TouchableOpacity onPress={() => setCustomEnd(d => adjustDate(d, -1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-left" size={14} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.dateValue}>{formatDate(customEnd)}</Text>
              <TouchableOpacity onPress={() => setCustomEnd(d => adjustDate(d, 1))} style={styles.arrowBtn}>
                <FontAwesome name="chevron-right" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
          onPress={loadGuide}
          disabled={loading}
        >
          <FontAwesome name={guide ? 'refresh' : 'search'} size={16} color="#fff" />
          <Text style={styles.analyzeBtnText}>  {guide ? '재분석' : '분석 시작'}</Text>
        </TouchableOpacity>
      </View>

      {/* 로딩 */}
      {loading && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>AI가 식단을 분석하고 있습니다...</Text>
        </View>
      )}

      {/* 에러 */}
      {!loading && error && (
        <View style={styles.errorBox}>
          <FontAwesome name="exclamation-circle" size={20} color={Colors.warning} />
          <Text style={styles.errorText}>  {error}</Text>
        </View>
      )}

      {/* 결과 */}
      {!loading && guide && (
        <>
          {analyzedLabel && (
            <Text style={styles.analyzedPeriod}>분석 기간: {analyzedLabel}</Text>
          )}

          <View style={styles.summaryCard}>
            <FontAwesome name="heartbeat" size={24} color={Colors.primary} />
            <Text style={styles.summaryTitle}>종합 평가</Text>
            <Text style={styles.summaryText}>{guide.summary}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>맞춤 추천</Text>
            {guide.recommendations.map((rec, i) => (
              <View key={i} style={styles.recommendCard}>
                <View style={styles.recNumber}>
                  <Text style={styles.recNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>

          {guide.warnings && guide.warnings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주의사항</Text>
              {guide.warnings.map((w, i) => (
                <View key={i} style={styles.warningCard}>
                  <FontAwesome name="exclamation-triangle" size={16} color={Colors.accentDark} />
                  <Text style={styles.warningText}>{w}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  periodSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 2 },
  periodRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  periodBtnTextActive: { color: '#fff', fontWeight: '700' },
  customDateSection: { marginBottom: Spacing.md, gap: Spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, width: 50 },
  arrowBtn: { padding: Spacing.sm },
  dateValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600', minWidth: 100, textAlign: 'center' },
  mealTypeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  mealTypeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  mealTypeBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  mealTypeBtnHasData: { borderColor: Colors.primary, borderWidth: 1.5 },
  mealTypeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  mealTypeBtnTextActive: { color: Colors.primaryDark, fontWeight: '700' },
  mealTypeBtnTextHasData: { color: Colors.text, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dotHas: { backgroundColor: Colors.primary },
  dotNone: { backgroundColor: Colors.border },
  dotLoading: { width: 6, height: 6, borderRadius: 3, marginTop: 3, backgroundColor: Colors.border },
  analyzeBtn: { flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  centerContainer: { alignItems: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.md },
  errorBox: { flexDirection: 'row', backgroundColor: '#FFF3E0', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'flex-start' },
  errorText: { flex: 1, fontSize: FontSize.md, color: Colors.accentDark, lineHeight: 22 },
  analyzedPeriod: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, elevation: 2 },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  summaryText: { fontSize: FontSize.md, color: Colors.text, lineHeight: 24, textAlign: 'center' },
  section: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  recommendCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, alignItems: 'flex-start', elevation: 1 },
  recNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  recNumberText: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primaryDark },
  recText: { flex: 1, fontSize: FontSize.md, color: Colors.text, lineHeight: 22 },
  warningCard: { flexDirection: 'row', backgroundColor: '#FFF3E0', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: FontSize.md, color: Colors.accentDark, marginLeft: Spacing.sm, lineHeight: 22 },
});
