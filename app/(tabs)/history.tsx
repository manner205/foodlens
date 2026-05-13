// app/(tabs)/history.tsx
// 2026-05-12: 기록 히스토리 — 일/주간/월간 뷰
// 2026-05-13: 갤러리 모드 추가, photo_url signed URL 수정

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { MEAL_TYPE_LABELS } from '@/constants/nutrition';
import { useMealEntries } from '@/hooks/useMealEntries';
import { getSignedPhotoUrl } from '@/services/imageService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { MealEntry } from '@/types/models';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

type ViewMode = 'daily' | 'weekly' | 'monthly';
type DisplayMode = 'list' | 'gallery';

interface DayGroup {
  date: string;
  meals: MealEntry[];
  totalCalories: number;
}

const TILE_SIZE = Math.floor(Dimensions.get('window').width / 3);

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupByDate(meals: MealEntry[]): DayGroup[] {
  const groups: Record<string, MealEntry[]> = {};
  meals.forEach(m => {
    const d = new Date(m.meal_time);
    const date = toLocalDateStr(d);
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });
  return Object.entries(groups)
    .map(([date, dayMeals]) => ({
      date,
      meals: dayMeals,
      totalCalories: dayMeals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// 갤러리 타일 — 자체적으로 signed URL 로드
function MealPhotoTile({ meal, onPress, onLongPress }: { meal: MealEntry; onPress: () => void; onLongPress?: () => void }) {
  const [signedUri, setSignedUri] = useState<string | null>(null);

  useEffect(() => {
    if (meal.photo_url) {
      getSignedPhotoUrl(meal.photo_url).then(url => setSignedUri(url));
    }
  }, [meal.photo_url]);

  return (
    <TouchableOpacity style={styles.photoTile} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      {signedUri ? (
        <Image source={{ uri: signedUri }} style={styles.photoTileImage} resizeMode="cover" />
      ) : (
        <View style={[styles.photoTilePlaceholder, { backgroundColor: Colors[meal.meal_type] || Colors.primary }]}>
          <FontAwesome name="cutlery" size={22} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <View style={styles.photoTileOverlay}>
        <Text style={styles.photoTileCalories}>{meal.nutrition?.calories || 0} kcal</Text>
      </View>
      <View style={[styles.photoTileBadge, { backgroundColor: Colors[meal.meal_type] || Colors.primary }]}>
        <Text style={styles.photoTileBadgeText}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
      </View>
    </TouchableOpacity>
  );
}

// 리스트 뷰용 썸네일 — signed URL 로드
function MealThumbnail({ photoUrl, mealType }: { photoUrl?: string; mealType: MealEntry['meal_type'] }) {
  const [signedUri, setSignedUri] = useState<string | null>(null);

  useEffect(() => {
    if (photoUrl) {
      getSignedPhotoUrl(photoUrl).then(url => setSignedUri(url));
    }
  }, [photoUrl]);

  if (signedUri) {
    return <Image source={{ uri: signedUri }} style={styles.mealThumbnail} resizeMode="cover" />;
  }
  return (
    <View style={[styles.mealTypeBadge, { backgroundColor: Colors[mealType] || Colors.primary }]}>
      <Text style={styles.mealTypeText}>{MEAL_TYPE_LABELS[mealType]}</Text>
    </View>
  );
}

// 갤러리 그리드 섹션 (날짜별)
function GallerySection({ group, onPressItem, onLongPressItem }: { group: DayGroup; onPressItem: (meal: MealEntry) => void; onLongPressItem?: (meal: MealEntry) => void }) {
  const date = new Date(group.date + 'T12:00:00');
  const label = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const rows = chunkArray(group.meals, 3);

  return (
    <View style={styles.gallerySection}>
      <View style={styles.gallerySectionHeader}>
        <Text style={styles.gallerySectionDate}>{label}</Text>
        <Text style={styles.gallerySectionCalories}>{group.totalCalories} kcal · {group.meals.length}끼</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.galleryRow}>
          {row.map(meal => (
            <MealPhotoTile key={meal.id} meal={meal} onPress={() => onPressItem(meal)} onLongPress={onLongPressItem ? () => onLongPressItem(meal) : undefined} />
          ))}
          {/* 마지막 줄 빈칸 채우기 */}
          {row.length < 3 && Array(3 - row.length).fill(null).map((_, j) => (
            <View key={`empty-${j}`} style={styles.photoTileEmpty} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { meals, fetchMealsByDate, fetchMealsByDateRange, deleteMeal } = useMealEntries(user?.id);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangedMeals, setRangedMeals] = useState<MealEntry[]>([]);

  const dateStr = toLocalDateStr(selectedDate);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!user?.id) return; // 인증 완료 전 조기 반환
        if (viewMode === 'daily') {
          fetchMealsByDate(dateStr);
        } else if (viewMode === 'weekly') {
          const ws = getWeekStart(selectedDate);
          const we = new Date(ws);
          we.setDate(we.getDate() + 7);
          const data = await fetchMealsByDateRange(toLocalDateStr(ws), toLocalDateStr(we));
          if (active) setRangedMeals(data);
        } else {
          const ms = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          const me = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
          const data = await fetchMealsByDateRange(toLocalDateStr(ms), toLocalDateStr(me));
          if (active) setRangedMeals(data);
        }
      };
      load();
      return () => { active = false; };
    }, [user?.id, viewMode, selectedDate, dateStr, fetchMealsByDate, fetchMealsByDateRange])
  );

  const goToPrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'daily') d.setDate(d.getDate() - 1);
    else if (viewMode === 'weekly') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const goToNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'daily') d.setDate(d.getDate() + 1);
    else if (viewMode === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    if (d <= new Date()) setSelectedDate(d);
  };

  const getHeaderLabel = () => {
    if (viewMode === 'daily') {
      return selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    } else if (viewMode === 'weekly') {
      const ws = getWeekStart(selectedDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - ${we.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
    } else {
      return selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    }
  };

  const handleDelete = useCallback((meal: MealEntry, onDeleted?: () => void) => {
    Alert.alert(
      '삭제 확인',
      `${MEAL_TYPE_LABELS[meal.meal_type]} 기록을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeal(meal.id);
              onDeleted?.();
            } catch {
              Alert.alert('오류', '삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  }, [deleteMeal]);

  const reloadDaily = useCallback(() => fetchMealsByDate(dateStr), [fetchMealsByDate, dateStr]);

  // 주간/월간에서 삭제 후 로컬 상태 즉시 반영 (재조회 없이)
  const removeFromRange = useCallback((mealId: string) => {
    setRangedMeals(prev => prev.filter(m => m.id !== mealId));
  }, []);

  const activeMeals = viewMode === 'daily' ? meals : rangedMeals;
  const totalCalories = activeMeals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0);
  const dayGroups = viewMode !== 'daily' ? groupByDate(rangedMeals) : [];

  const summaryText = viewMode === 'daily'
    ? `총 ${totalCalories} kcal · ${meals.length}끼`
    : `총 ${totalCalories} kcal · ${dayGroups.length}일 · ${rangedMeals.length}끼`;

  // 리스트 뷰 — 일별 카드
  const renderMeal = ({ item }: { item: MealEntry }) => (
    <TouchableOpacity style={styles.mealCard} onPress={() => router.push(`/analysis/${item.id}`)}>
      <MealThumbnail photoUrl={item.photo_url} mealType={item.meal_type} />
      <View style={styles.mealContent}>
        <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[item.meal_type]}</Text>
        <Text style={styles.mealCalories}>{item.nutrition?.calories || 0} kcal</Text>
        <Text style={styles.mealDetails}>
          단 {item.nutrition?.protein_g || 0}g · 탄 {item.nutrition?.carbohydrates_g || 0}g · 지 {item.nutrition?.fat_g || 0}g
        </Text>
        <Text style={styles.mealTime}>
          {new Date(item.meal_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item, reloadDaily)} style={styles.deleteButton}>
        <FontAwesome name="trash-o" size={18} color={Colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 리스트 뷰 — 주간/월간 날짜 그룹
  const renderDayGroup = (group: DayGroup) => {
    const date = new Date(group.date + 'T12:00:00');
    const dayLabel = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    return (
      <View key={group.date} style={styles.dayGroup}>
        <TouchableOpacity
          style={styles.dayGroupHeader}
          onPress={() => { setSelectedDate(date); setViewMode('daily'); }}
        >
          <Text style={styles.dayGroupDate}>{dayLabel}</Text>
          <Text style={styles.dayGroupCalories}>{group.totalCalories} kcal · {group.meals.length}끼</Text>
          <FontAwesome name="chevron-right" size={12} color={Colors.textSecondary} />
        </TouchableOpacity>
        {group.meals.map(meal => (
          <TouchableOpacity
            key={meal.id}
            style={styles.compactMealRow}
            onPress={() => router.push(`/analysis/${meal.id}`)}
          >
            <View style={[styles.compactBadge, { backgroundColor: Colors[meal.meal_type] || Colors.primary }]}>
              <Text style={styles.compactBadgeText}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
            </View>
            <Text style={styles.compactCalories}>{meal.nutrition?.calories || 0} kcal</Text>
            <Text style={styles.compactTime}>
              {new Date(meal.meal_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <TouchableOpacity onPress={() => handleDelete(meal, () => removeFromRange(meal.id))} style={styles.deleteButton}>
              <FontAwesome name="trash-o" size={15} color={Colors.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 뷰 모드 탭 */}
      <View style={styles.modeTabs}>
        {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeTab, viewMode === mode && styles.modeTabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.modeTabText, viewMode === mode && styles.modeTabTextActive]}>
              {mode === 'daily' ? '일' : mode === 'weekly' ? '주간' : '월간'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 날짜 네비게이션 + 갤러리 토글 */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPrev} style={styles.navButton}>
          <FontAwesome name="chevron-left" size={16} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{getHeaderLabel()}</Text>
        <TouchableOpacity onPress={goToNext} style={styles.navButton}>
          <FontAwesome name="chevron-right" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 합계 + 갤러리/리스트 토글 */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {summaryText}
          {displayMode === 'gallery' ? '  · 길게 누르면 삭제' : ''}
        </Text>
        <TouchableOpacity
          style={styles.displayToggle}
          onPress={() => setDisplayMode(d => d === 'list' ? 'gallery' : 'list')}
        >
          <FontAwesome
            name={displayMode === 'list' ? 'th' : 'list'}
            size={16}
            color={Colors.primaryDark}
          />
          <Text style={styles.displayToggleText}>{displayMode === 'list' ? '갤러리' : '목록'}</Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 */}
      {displayMode === 'gallery' ? (
        // ── 갤러리 모드 ──
        viewMode === 'daily' ? (
          activeMeals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>이 날의 기록이 없습니다</Text>
            </View>
          ) : (
            <FlatList
              key="gallery"
              data={activeMeals}
              keyExtractor={item => item.id}
              numColumns={3}
              renderItem={({ item }) => (
                <MealPhotoTile
                  meal={item}
                  onPress={() => router.push(`/analysis/${item.id}`)}
                  onLongPress={() => handleDelete(item, reloadDaily)}
                />
              )}
              contentContainerStyle={styles.galleryContainer}
            />
          )
        ) : (
          <ScrollView>
            {dayGroups.length === 0 ? (
              <Text style={styles.emptyText}>이 기간의 기록이 없습니다</Text>
            ) : (
              dayGroups.map(group => (
                <GallerySection
                  key={group.date}
                  group={group}
                  onPressItem={meal => router.push(`/analysis/${meal.id}`)}
                  onLongPressItem={meal => handleDelete(meal, () => removeFromRange(meal.id))}
                />
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )
      ) : (
        // ── 리스트 모드 ──
        viewMode === 'daily' ? (
          <FlatList
            key="list"
            data={meals}
            keyExtractor={item => item.id}
            renderItem={renderMeal}
            ListEmptyComponent={<Text style={styles.emptyText}>이 날의 기록이 없습니다</Text>}
            contentContainerStyle={meals.length === 0 ? styles.emptyContainer : undefined}
          />
        ) : (
          <ScrollView>
            {dayGroups.length === 0 ? (
              <Text style={styles.emptyText}>이 기간의 기록이 없습니다</Text>
            ) : (
              dayGroups.map(renderDayGroup)
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  modeTabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modeTab: { flex: 1, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  modeTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  modeTabText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  modeTabTextActive: { color: Colors.primary, fontWeight: '700' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: Colors.surface },
  navButton: { padding: Spacing.sm },
  dateText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },

  // 합계 + 토글 바
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.primaryLight },
  summaryText: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: '600' },
  displayToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  displayToggleText: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: '600' },

  // 갤러리 모드
  galleryContainer: { paddingBottom: 40 },
  photoTile: { width: TILE_SIZE, height: TILE_SIZE, position: 'relative' },
  photoTileImage: { width: TILE_SIZE, height: TILE_SIZE },
  photoTilePlaceholder: { width: TILE_SIZE, height: TILE_SIZE, justifyContent: 'center', alignItems: 'center' },
  photoTileEmpty: { width: TILE_SIZE, height: TILE_SIZE },
  photoTileOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 4, paddingVertical: 3 },
  photoTileCalories: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  photoTileBadge: { position: 'absolute', top: 4, left: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  photoTileBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // 갤러리 섹션 (주간/월간)
  gallerySection: { marginBottom: Spacing.xs },
  gallerySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  gallerySectionDate: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  gallerySectionCalories: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  galleryRow: { flexDirection: 'row' },

  // 리스트 모드
  mealCard: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', elevation: 1 },
  mealThumbnail: { width: 56, height: 56, borderRadius: BorderRadius.sm },
  mealTypeBadge: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.sm },
  mealTypeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  mealContent: { flex: 1, marginLeft: Spacing.md },
  mealTypeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  mealCalories: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  mealDetails: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  mealTime: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  deleteButton: { padding: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textLight, textAlign: 'center', paddingVertical: Spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 주간/월간 리스트 뷰
  dayGroup: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden', elevation: 1 },
  dayGroupHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  dayGroupDate: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  dayGroupCalories: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginRight: Spacing.sm },
  compactMealRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  compactBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4, marginRight: Spacing.sm },
  compactBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  compactCalories: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  compactTime: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
