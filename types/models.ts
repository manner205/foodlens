// src/types/models.ts
// 2026-05-12: FoodLens 타입 정의 초기 생성

export interface User {
  id: string;
  email: string;
  nickname?: string; // 2026-05-12: 이름/별명 필드 추가
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  goal?: 'lose' | 'maintain' | 'gain';
  daily_calorie_goal?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NutritionData {
  calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface FoodItem {
  name: string;
  quantity: string;
  unit: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_time: string;
  photo_url?: string;
  nutrition: NutritionData;
  food_items?: FoodItem[];
  notes?: string;
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FoodAnalysisResult {
  food_items: FoodItem[];
  nutrition: NutritionData;
  confidence_score: number;
  warnings?: string[];
}

export interface DailyNutritionSummary {
  date: string;
  calories: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  meal_count: number;
}

export interface WeeklyReport {
  start_date: string;
  end_date: string;
  daily_data: DailyNutritionSummary[];
  averages: NutritionData;
  total_meals: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  daily_data: DailyNutritionSummary[];
  averages: NutritionData;
  total_meals: number;
}

export interface QueuedMeal {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  mealData: Partial<MealEntry>;
  timestamp: number;
  localPhotoUri?: string;
}

export interface HealthGuideResult {
  summary: string;
  recommendations: string[];
  warnings?: string[];
}
