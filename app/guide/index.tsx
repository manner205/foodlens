// app/guide/index.tsx
// 2026-05-12: 건강 가이드 — 최근 7일 데이터 + 프로필 → Gemini AI 맞춤 조언

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { getHealthGuide } from '@/services/geminiService';
import { getWeeklyReport } from '@/services/reportService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { HealthGuideResult } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function GuideScreen() {
  const { user } = useAuthContext();
  const [guide, setGuide] = useState<HealthGuideResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuide();
  }, [user?.id]);

  const loadGuide = async () => {
    if (!user?.id) return;

    // 프로필 미완성 체크
    if (!user.age || !user.weight_kg || !user.height_cm) {
      setError('프로필에서 나이, 체중, 키를 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const weeklyReport = await getWeeklyReport(user.id);

      if (weeklyReport.total_meals === 0) {
        setError('최근 7일간 식사 기록이 없습니다. 식사를 기록한 후 다시 시도해주세요.');
        return;
      }

      const result = await getHealthGuide(user, weeklyReport.daily_data);
      setGuide(result);
    } catch (err: any) {
      setError(err.message || 'AI 가이드를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>AI가 식단을 분석하고 있습니다...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <FontAwesome name="exclamation-circle" size={48} color={Colors.warning} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGuide}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {guide && (
        <>
          {/* 종합 평가 */}
          <View style={styles.summaryCard}>
            <FontAwesome name="heartbeat" size={24} color={Colors.primary} />
            <Text style={styles.summaryTitle}>종합 평가</Text>
            <Text style={styles.summaryText}>{guide.summary}</Text>
          </View>

          {/* 추천 사항 */}
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

          {/* 주의사항 */}
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

          {/* 새로고침 */}
          <TouchableOpacity style={styles.refreshButton} onPress={loadGuide}>
            <FontAwesome name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.refreshText}>  가이드 새로고침</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  centerContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.md },
  errorText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 24 },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  retryText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
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
  refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, marginTop: Spacing.sm },
  refreshText: { fontSize: FontSize.md, color: Colors.primary },
});
