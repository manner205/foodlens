// styles/theme.ts
// 2026-05-12: FoodLens 디자인 토큰 초기 생성

export const Colors = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#C8E6C9',
  accent: '#FF9800',
  accentDark: '#F57C00',

  // 영양소 색상
  calories: '#FF6B6B',
  protein: '#4ECDC4',
  carbs: '#FFE66D',
  fat: '#FF8A65',
  fiber: '#81C784',

  // 식사 유형 색상
  breakfast: '#FFB74D',
  lunch: '#4FC3F7',
  dinner: '#9575CD',
  snack: '#A1887F',

  // 기본 색상
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#BDBDBD',
  border: '#E0E0E0',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FFC107',

  // 다크모드
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  title: 28,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
