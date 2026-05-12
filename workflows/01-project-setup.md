# Workflow 01: 프로젝트 초기화

## 목표
Expo(React Native) + TypeScript 프로젝트를 생성하고, 필요한 의존성을 설치한다.

## 선행 조건
- Node.js 설치 (v18+)
- npm 접근 가능한 네트워크

## 단계

### Step 1: Expo 프로젝트 생성
```bash
cd d:\Vibe-Coding-Project
npx create-expo-app@latest FoodLens --template tabs
```
- 결과: FoodLens/ 폴더에 Expo Router + TypeScript 기반 프로젝트 생성
- 검증: `cd FoodLens && npx expo start` 실행 → QR 코드 출력 확인

### Step 2: 추가 의존성 설치
```bash
cd FoodLens
npx expo install expo-image-picker expo-image-manipulator expo-file-system @react-native-async-storage/async-storage react-native-svg expo-network
npm install @supabase/supabase-js react-native-chart-kit
```

### Step 3: 프로젝트 구조 생성
src/ 하위에 다음 폴더 생성:
- services/ — 비즈니스 로직 (supabaseClient, geminiService, imageService, offlineQueue, reportService)
- hooks/ — 커스텀 훅 (useAuth, useMealEntries, useOfflineSync)
- types/ — TypeScript 타입 정의
- constants/ — 상수 (영양 권장량)
- styles/ — 디자인 토큰
- components/ — 공통/차트 컴포넌트

### Step 4: 환경변수 설정
- .env 파일에 EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY 설정
- .gitignore에 .env 추가

## 에러 대응
- npm registry 접근 불가 → 집 네트워크에서 재시도
- Expo 버전 호환성 에러 → `npx expo install --fix` 실행
- TypeScript 에러 → tsconfig.json 확인 후 수정

## 결과물
- 실행 가능한 Expo 프로젝트
- 모든 의존성 설치 완료
- 프로젝트 폴더 구조 완성
