# Workflow 04: 화면 개발

## 목표
Expo Router 파일 기반 라우팅으로 모든 화면을 개발한다.

## 선행 조건
- Workflow 03 완료 (서비스 모듈)

## 단계

### Step 1: 루트 레이아웃 (app/_layout.tsx)
- 인증 상태 체크
- 미인증 → login 화면 리디렉트
- 인증됨 → (tabs) 그룹으로 이동

### Step 2: 로그인 화면 (app/login.tsx)
- 이메일/비밀번호 입력 폼
- Supabase Auth 로그인 호출
- 로그인 성공 → 대시보드 이동

### Step 3: 탭바 레이아웃 (app/(tabs)/_layout.tsx)
- 4개 탭: 대시보드 / 히스토리 / 리포트 / 프로필
- 아이콘 + 라벨

### Step 4: 오늘 대시보드 (app/(tabs)/index.tsx)
- 오늘 총 칼로리 원형 차트 (목표 대비)
- 영양소 합계 바 (단백질/탄수화물/지방)
- 오늘 식사 목록 (MealCard)
- 플로팅 "+ 식사 추가" 버튼

### Step 5: 촬영 화면 (app/camera/index.tsx)
- "카메라 촬영" / "갤러리 선택" 버튼
- 이미지 → 압축 → Gemini 분석 → 로딩 스피너
- 분석 완료 → analysis/[id] 이동

### Step 6: 분석 결과 (app/analysis/[id].tsx)
- AI 인식 음식 목록
- 칼로리/단백질/탄수화물/지방/식이섬유 표시
- 각 수치 수동 수정 가능 (NutritionEditor)
- 식사 유형 선택 (아침/점심/저녁/간식)
- 식사 시간 (EXIF 자동 + 수동 수정)
- confidence_score 표시
- "저장" 버튼

### Step 7: 기록 히스토리 (app/(tabs)/history.tsx)
- 날짜별 식사 목록 (FlatList)
- 날짜 네비게이션 (이전/다음)
- 항목 탭 → 상세보기/수정
- 삭제 기능

### Step 8: 주간/월간 리포트 (app/(tabs)/reports.tsx)
- 주간/월간 탭 전환
- 주간: 7일 바 차트 + 평균
- 월간: 일별 바 차트 + 월 평균 + 트렌드
- 목표 달성률

### Step 9: 건강 가이드 (app/guide/index.tsx)
- 최근 7일 데이터 + 프로필 → Gemini 조언
- 카드 UI로 가이드 표시
- 목표 기반 맞춤 조언

### Step 10: 프로필 설정 (app/(tabs)/profile.tsx)
- 나이/체중/키/목표 입력/수정
- 일일 칼로리 목표 (BMR 자동 or 직접 입력)
- 로그아웃

## 에러 대응
- 카메라 권한 거부 → 권한 재요청 안내
- Gemini 분석 실패 → 수동 입력 폴백
- 네트워크 없음 → 오프라인 큐 사용

## 결과물
- 10개 화면 완성
- 전체 사용자 플로우 동작 확인
