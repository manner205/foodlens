// app/camera/index.tsx
// 2026-05-12: 촬영 화면 — 카메라/갤러리 → 압축 → Gemini 분석

import { useAuthContext } from '@/app/_layout';
import { Text, View } from '@/components/Themed';
import { analyzeFoodPhoto } from '@/services/geminiService';
import { compressImage, extractMealTime, imageToBase64, pickFromGallery, takePhoto } from '@/services/imageService';
import { BorderRadius, Colors, FontSize, Spacing } from '@/styles/theme';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity } from 'react-native';

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleImageSelected = async (uri: string, exif?: Record<string, any>) => {
    setPreviewUri(uri);
    setLoading(true);

    try {
      // Step 1: 이미지 압축
      setLoadingText('이미지 압축 중...');
      const compressedUri = await compressImage(uri);

      // Step 2: base64 변환
      setLoadingText('AI 분석 준비 중...');
      const base64 = await imageToBase64(compressedUri);

      // Step 3: Gemini 분석
      setLoadingText('AI가 음식을 분석하고 있습니다...');
      const analysisResult = await analyzeFoodPhoto(base64);

      // Step 4: 촬영 시간 추출
      const mealTime = extractMealTime(exif);

      // Step 5: 임시 저장 후 분석 화면으로 이동
      const tempId = `temp_${Date.now()}`;
      await AsyncStorage.setItem(`@analysis_${tempId}`, JSON.stringify({
        analysisResult,
        imageUri: compressedUri,
        originalUri: uri,
        mealTime,
      }));

      router.push(`/analysis/${tempId}`);
    } catch (error: any) {
      console.error('분석 실패:', error);
      Alert.alert(
        '분석 실패',
        error.message || 'AI 분석에 실패했습니다. 수동으로 입력하시겠습니까?',
        [
          { text: '취소', onPress: () => router.back() },
          {
            text: '수동 입력',
            onPress: async () => {
              const tempId = `temp_${Date.now()}`;
              await AsyncStorage.setItem(`@analysis_${tempId}`, JSON.stringify({
                analysisResult: null,
                imageUri: uri,
                originalUri: uri,
                mealTime: new Date().toISOString(),
              }));
              router.push(`/analysis/${tempId}`);
            },
          },
        ]
      );
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const handleCamera = async () => {
    try {
      const result = await takePhoto();
      if (!result.canceled && result.assets[0]) {
        await handleImageSelected(result.assets[0].uri, result.assets[0].exif as Record<string, any>);
      }
    } catch (error: any) {
      Alert.alert('오류', error.message);
    }
  };

  const handleGallery = async () => {
    try {
      const result = await pickFromGallery();
      if (!result.canceled && result.assets[0]) {
        await handleImageSelected(result.assets[0].uri, result.assets[0].exif as Record<string, any>);
      }
    } catch (error: any) {
      Alert.alert('오류', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} />}
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>식사를 기록하세요</Text>
      <Text style={styles.subtitle}>사진을 찍거나 갤러리에서 선택하세요</Text>

      <TouchableOpacity style={styles.optionButton} onPress={handleCamera}>
        <FontAwesome name="camera" size={32} color={Colors.primary} />
        <Text style={styles.optionText}>카메라 촬영</Text>
        <Text style={styles.optionDesc}>지금 먹고 있는 음식을 촬영</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionButton} onPress={handleGallery}>
        <FontAwesome name="image" size={32} color={Colors.accent} />
        <Text style={styles.optionText}>갤러리 선택</Text>
        <Text style={styles.optionDesc}>이전에 찍어둔 사진 선택</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  optionButton: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  optionText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginTop: Spacing.md },
  optionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  previewImage: { width: 200, height: 200, borderRadius: BorderRadius.lg },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
});
