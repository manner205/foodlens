# Workflow 03: 핵심 서비스 모듈 개발

## 목표
앱의 핵심 비즈니스 로직 모듈을 개발한다.

## 선행 조건
- Workflow 01 완료 (프로젝트 + 의존성)
- Workflow 02 완료 (Supabase 설정)

## 단계

### Step 1: TypeScript 타입 정의 (src/types/models.ts)
- User, MealEntry, NutritionData, FoodItem, WeeklyReport, MonthlyReport 등
- Gemini API 응답 타입 (FoodAnalysisResult)

### Step 2: Supabase 클라이언트 (src/services/supabaseClient.ts)
- Supabase 초기화 (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)
- AsyncStorage로 세션 지속 (앱 재시작 시 로그인 유지)

### Step 3: 이미지 서비스 (src/services/imageService.ts)
- expo-image-picker로 카메라 촬영 / 갤러리 선택
- expo-image-manipulator로 이미지 압축 (원본 → 50~80KB JPEG)
- EXIF 데이터에서 촬영 시간 추출 (식사 시간 자동 기록)
- base64 변환 (Gemini API 전송용)
- Supabase Storage 업로드

### Step 4: Gemini 서비스 (src/services/geminiService.ts)
- Gemini 2.0 Flash 모델 사용
- 구조화된 JSON 프롬프트 (calories, protein_g, carbohydrates_g, fat_g, fiber_g)
- 응답 JSON 파싱 + 유효성 검증
- confidence_score 포함
- 건강 가이드용 AI 조언 요청 함수
- 에러 핸들링 (파싱 실패 시 수동 입력 안내)

### Step 5: 오프라인 큐 (src/services/offlineQueue.ts)
- AsyncStorage 기반 로컬 큐 관리
- 큐 추가 (addToQueue) — 오프라인 시 식사 기록 임시 저장
- 큐 동기화 (syncQueue) — 사진 업로드 + DB 저장
- 네트워크 상태 확인 (expo-network)

### Step 6: 리포트 서비스 (src/services/reportService.ts)
- 주간 리포트: 최근 7일 일별 칼로리/영양소 집계 + 평균
- 월간 리포트: 해당 월 일별 집계 + 월 평균
- 클라이언트 사이드 집계 (Supabase에서 데이터 fetch → 로컬 계산)

## 에러 대응
- Gemini API 키 오류 → .env 값 확인
- Supabase 연결 실패 → URL/KEY 확인, 네트워크 상태 확인
- 이미지 압축 실패 → 원본 크기/형식 로그 확인

## 결과물
- 5개 서비스 모듈 완성
- 각 모듈이 단일 책임 원칙 준수
- 입출력이 명확한 함수들
