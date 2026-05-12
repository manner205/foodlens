// services/imageService.ts
// 2026-05-12: 이미지 촬영, 압축, EXIF 추출, Storage 업로드

import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseClient';

// 카메라로 사진 촬영
export async function takePhoto(): Promise<ImagePicker.ImagePickerResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('카메라 권한이 필요합니다.');
  }

  return await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    exif: true,
  });
}

// 갤러리에서 사진 선택
export async function pickFromGallery(): Promise<ImagePicker.ImagePickerResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('갤러리 접근 권한이 필요합니다.');
  }

  return await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    exif: true,
  });
}

// 이미지 압축 (50~80KB 목표)
export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// 이미지를 base64로 변환 (Gemini API용)
export async function imageToBase64(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    base64: true,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  if (!result.base64) throw new Error('base64 변환 실패');
  return result.base64;
}

// EXIF 데이터에서 촬영 시간 추출
export function extractMealTime(exif?: Record<string, any>): string {
  if (exif?.DateTimeOriginal) {
    // EXIF 형식: "2026:05:12 12:30:00" → ISO 형식으로 변환
    const dateStr = exif.DateTimeOriginal.replace(
      /^(\d{4}):(\d{2}):(\d{2})/,
      '$1-$2-$3'
    );
    return new Date(dateStr).toISOString();
  }
  // EXIF 없으면 현재 시간 사용
  return new Date().toISOString();
}

// Supabase Storage에 이미지 업로드
export async function uploadImage(
  localUri: string,
  userId: string,
  mealId: string
): Promise<string> {
  const compressedUri = await compressImage(localUri);
  const base64 = await imageToBase64(compressedUri);
  const filePath = `${userId}/${mealId}_${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('meal-photos')
    .upload(filePath, decode(base64), {
      contentType: 'image/jpeg',
    });

  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);

  const { data } = supabase.storage
    .from('meal-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
