// constants/nutrition.ts
// 2026-05-12: 영양 상수 및 BMR 계산 함수

// 일일 권장량 (한국인 기준, 성인)
export const DAILY_RECOMMENDED = {
  calories: 2000,
  protein_g: 55,
  carbohydrates_g: 300,
  fat_g: 65,
  fiber_g: 25,
};

// 목표별 칼로리 조정 비율
export const GOAL_MULTIPLIER = {
  lose: 0.8,      // 20% 감소
  maintain: 1.0,
  gain: 1.2,      // 20% 증가
};

// 활동 계수 (보통 활동량 기준)
export const ACTIVITY_FACTOR = 1.55;

// BMR 계산 (Mifflin-St Jeor 공식)
export function calculateBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  isMale: boolean = true
): number {
  if (isMale) {
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  }
  return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
}

// 목표 기반 일일 칼로리 계산
export function calculateDailyCalories(
  weight_kg: number,
  height_cm: number,
  age: number,
  goal: 'lose' | 'maintain' | 'gain',
  isMale: boolean = true
): number {
  const bmr = calculateBMR(weight_kg, height_cm, age, isMale);
  const tdee = bmr * ACTIVITY_FACTOR;
  return Math.round(tdee * GOAL_MULTIPLIER[goal]);
}

export interface CalorieBreakdown {
  bmr: number;
  tdee: number;
  current_tdee: number;
  result: number;
  isMale: boolean;
  current_weight_kg: number;
  target_weight_kg?: number;
  calc_weight_kg: number;
  height_cm: number;
  age: number;
  goal: 'lose' | 'maintain' | 'gain';
}

// 목표 체중 기반 칼로리 계산
// - 유지: 현재 체중 TDEE
// - 감량/증량: 목표 체중 TDEE (목표 체중 수준으로 먹으면 자연스럽게 수렴)
export function calculateDailyCaloriesWithBreakdown(
  current_weight_kg: number,
  height_cm: number,
  age: number,
  goal: 'lose' | 'maintain' | 'gain',
  isMale: boolean = true,
  target_weight_kg?: number,
): CalorieBreakdown {
  const calcWeight = (goal !== 'maintain' && target_weight_kg) ? target_weight_kg : current_weight_kg;
  const bmr = calculateBMR(calcWeight, height_cm, age, isMale);
  const tdee = bmr * ACTIVITY_FACTOR;
  const currentBmr = calculateBMR(current_weight_kg, height_cm, age, isMale);
  const currentTdee = currentBmr * ACTIVITY_FACTOR;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    current_tdee: Math.round(currentTdee),
    result: Math.round(tdee),
    isMale,
    current_weight_kg,
    target_weight_kg,
    calc_weight_kg: calcWeight,
    height_cm,
    age,
    goal,
  };
}

// 식사 유형 한국어 라벨
export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
};

// 식사 유형 목록
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
