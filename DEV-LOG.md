# FoodLens 개발 일지

## 프로젝트 개요
- **앱 이름**: FoodLens — AI 식단 분석 & 기록 앱
- **목적**: 하루 식단을 사진으로 찍으면 AI(Gemini)가 칼로리·영양소를 분석하고 기록
- **사용자**: 본인 + 와이프 (2명, iPhone)
- **예산**: 0원 (모든 서비스 무료 티어)
- **기술 스택**: Expo (React Native) + TypeScript + Supabase + Gemini API

---

## 환경 정보
- **Expo SDK**: 54 (React Native 0.81.5)
- **Node.js**: v24.14.0
- **개발 PC (Windows)**: d:\Vibe-Coding-Project\FoodLens
- **Supabase**: travel-manager 프로젝트 공유 (free tier, 1프로젝트 제한)
  - URL: https://nodwnyghvzgewwdgtber.supabase.co
  - Region: Northeast Asia Seoul (ap-northeast-2)
  - ⚠️ FoodLens 테이블은 `fl_` 접두어 사용 (기존 travel-manager 테이블과 충돌 방지)
- **Gemini API**: 2.0 Flash 모델, 무료 (1,500 req/day)
- **인증**: Supabase Auth (이메일/비밀번호), travel-manager와 같은 Auth 계정 공유

---

## 프로젝트 구조
```
FoodLens/
├── app/                    # Expo Router (파일 기반 라우팅)
│   ├── _layout.tsx         # 루트 레이아웃 + AuthContext
│   ├── login.tsx           # 로그인 화면
│   ├── (tabs)/             # 탭 네비게이션
│   │   ├── _layout.tsx     # 탭 설정 (오늘/기록/리포트/프로필)
│   │   ├── index.tsx       # 오늘 대시보드
│   │   ├── history.tsx     # 날짜별 기록
│   │   ├── reports.tsx     # 기간별 리포트 (오늘/7일/30일/이번달/직접선택)
│   │   └── profile.tsx     # 프로필 설정
│   ├── camera/index.tsx    # 카메라/갤러리 → AI 분석
│   ├── analysis/[id].tsx   # 분석 결과 확인/수정/저장
│   ├── guide/index.tsx     # AI 건강 가이드
│   └── manual/index.tsx    # 식사 직접 입력
├── components/
│   └── AvatarDisplay.tsx   # 아바타 이미지 공통 컴포넌트
├── services/               # 외부 서비스 연동
│   ├── supabaseClient.ts   # Supabase 클라이언트
│   ├── imageService.ts     # 카메라/갤러리/압축/업로드 + 아바타
│   ├── geminiService.ts    # Gemini AI 분석 API
│   ├── offlineQueue.ts     # 오프라인 큐 (AsyncStorage)
│   └── reportService.ts    # 기간별 리포트 집계 (범용 날짜범위 지원)
├── hooks/                  # React 커스텀 훅
│   ├── useAuth.ts          # 인증 + 프로필 관리 + AppState 세션 갱신
│   ├── useMealEntries.ts   # 식사 기록 CRUD
│   └── useOfflineSync.ts   # 오프라인 자동 동기화
├── types/models.ts         # TypeScript 타입 (MealTypeStats, TopFood 등)
├── styles/theme.ts         # 디자인 토큰 (색상/간격/폰트)
├── constants/nutrition.ts  # 영양 상수 + BMR 계산
├── workflows/              # 단계별 설정 가이드 (6개)
├── .env                    # 환경변수 (⚠️ .gitignore에 포함)
└── app.json                # Expo 설정
```

---

## Supabase DB 구조

### fl_users 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | auth.users 참조 |
| email | text | 이메일 |
| nickname | text | 이름/별명 |
| age | int | 나이 |
| weight_kg | numeric | 체중 |
| height_cm | int | 키 |
| goal | text | lose/maintain/gain |
| daily_calorie_goal | int | 일일 칼로리 목표 |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

### fl_meal_entries 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 자동 생성 |
| user_id | uuid (FK) | fl_users.id 참조 |
| meal_type | text | breakfast/lunch/dinner/snack |
| meal_time | timestamptz | 식사 시간 |
| photo_url | text | Supabase Storage URL |
| nutrition | jsonb | {calories, protein_g, carbohydrates_g, fat_g, fiber_g} |
| food_items | jsonb | [{name, quantity, unit}] |
| notes | text | 메모 |
| synced_at | timestamptz | 동기화 시간 |
| created_at / updated_at | timestamptz | 생성/수정일 |

### Storage
- **버킷**: `meal-photos` (private)
- 경로: `{user_id}/{meal_id}.jpg`
- 압축: 800px 리사이즈, quality 0.3 → 약 50KB/장

### RLS 정책
- 모든 테이블: 본인 데이터만 CRUD 가능 (auth.uid() 기반)
- 정책명: `FL:` 접두어 (travel-manager 정책과 구분)

---

## 개발 진행 상황

### 2026-05-12 (Day 1) — 프로젝트 초기 세팅 + 전체 코드 작성

#### 완료 항목
- [x] Expo 프로젝트 생성 (tabs 템플릿)
- [x] 모든 의존성 설치 (737 패키지)
- [x] 전체 소스 코드 작성 (26+ 파일)
  - 로그인, 대시보드, 기록, 리포트, 프로필 화면
  - 카메라 촬영 → Gemini AI 분석 → 저장 플로우
  - 오프라인 큐 + 자동 동기화
  - 주간/월간 리포트 (BarChart)
  - AI 건강 가이드
- [x] Supabase 연동 (travel-manager 프로젝트 공유, fl_ 접두어)
  - fl_users, fl_meal_entries 테이블 생성
  - nickname 컬럼 추가
  - RLS 정책 설정
  - meal-photos Storage 버킷 생성
- [x] .env 환경변수 설정 (Supabase URL/Key, Gemini API Key)
- [x] 로컬 웹 테스트 (localhost:8081) — 로그인 화면 정상 표시 확인

#### 수정 이력
1. `app.json`: web.output `"static"` → `"single"` (SSR window 에러 수정)
2. `services/supabaseClient.ts`: import 경로 `dist/setup` → `auto`
3. `app/(tabs)/index.tsx`: 마지막 `});` 중복 제거
4. `app/login.tsx`: 로그인 실패 시 Alert → 인라인 에러 메시지 (한국어)
5. `app/(tabs)/profile.tsx`: 이름/별명 입력란 추가
6. `types/models.ts`: User 인터페이스에 nickname 필드 추가

#### 미완료 / 다음에 할 것
- [x] iPhone Expo Go 실제 테스트 — 로그인 성공 확인 (Day 2에서 완료)
- [ ] 로그인 → 프로필 설정 → 사진 촬영 → AI 분석 전체 플로우 테스트
- [ ] 에러/예외 케이스 테스트 (오프라인, API 실패 등)
- [ ] 앱 아이콘/스플래시 커스터마이징
- [ ] 필요시 UI 다듬기

---

### 2026-05-13 (Day 2) — 새 PC 환경 세팅 + iPhone 로그인 버그 수정

#### 완료 항목
- [x] 새 PC(Windows)에서 GitHub 클론으로 개발 환경 재구성
  - `git clone https://github.com/manner205/foodlens.git`
  - `npm install` (737 패키지)
  - `.env` 파일 수동 생성 (git에 포함 안 됨)
- [x] iPhone Expo Go 로그인 버그 수정
  - **원인**: `app/login.tsx` 비밀번호 `TextInput`에 `autoCapitalize="none"`, `autoCorrect={false}` 누락
  - **증상**: 맥북 웹에서는 로그인 되는데 iPhone에서 "이메일 또는 비밀번호가 올바르지 않습니다" 오류
  - **수정**: 비밀번호 필드에 두 옵션 추가 → iPhone Expo Go 로그인 정상 동작 확인

---

### 2026-05-13 (Day 3) — 리포트 전면 개편 + 건강 가이드 기간 선택 + 버그 수정

#### 완료 항목

**리포트 화면 (`reports.tsx`) 5가지 기능 추가**
- [x] 기록 현황 스트릭 — 연속 기록일, 기록 유지율(기록일/경과일), 총 식사 수
- [x] 영양소 비율 파이 차트 — 탄수화물/단백질/지방 비율, 권장치 대비 차이 표시
- [x] 목표 달성 프로그레스 바 — 칼로리/단백질/탄수화물/지방/식이섬유 일 평균 vs 목표
- [x] 식사 패턴 분석 — 아침/점심/저녁/간식 횟수 가로 바 + 평균 칼로리
- [x] 인기 음식 TOP 5 — 기간 내 자주 먹은 음식 순위

**건강 가이드 (`guide/index.tsx`) 기간 선택 UI**
- [x] 한끼/오늘/7일/30일/이번달/직접선택 pill 버튼 방식
- [x] 직접선택: 화살표 버튼으로 시작일/종료일 조정
- [x] 한끼: 날짜 + 식사 유형(아침/점심/저녁/간식) 선택, 데이터 있는 유형 표시

**타입/서비스 확장**
- [x] `types/models.ts`: `MealTypeStats`, `TopFood` 인터페이스 추가; `WeeklyReport`/`MonthlyReport`에 신규 필드 추가
- [x] `reportService.ts`: `computeStreak()`, `aggregateMealTypeStats()`, `aggregateTopFoods()` 헬퍼 추가

**버그 수정**
- [x] 아바타 업로드 RLS 오류 (`new row violates row-level security policy`) 수정
  - **원인**: Storage `upsert: true` 옵션이 내부적으로 UPDATE 정책을 요구하는데 INSERT 정책만 존재
  - **수정**: `imageService.ts`에서 기존 파일 DELETE 후 새로 INSERT하는 방식으로 변경
  - Supabase Storage에 DELETE 정책 추가 필요 (SQL: `auth.uid()::text = (storage.foldername(name))[1]`)

---

### 2026-05-14 (Day 4) — 리포트 기간 선택 UI 개편 + 파이차트 짤림 수정 + 백그라운드 세션 버그 수정

#### 완료 항목

**리포트 기간 선택 UI 개편 (`reports.tsx`)**
- [x] 주간/월간 탭 → 오늘/7일/30일/이번달/직접선택 pill 버튼 방식으로 교체 (건강 가이드와 동일)
- [x] 직접선택 시 시작일/종료일 화살표 조정 + 조회 버튼
- [x] `reportService.ts`에 `getReportByDateRange(userId, startDate, endDate, elapsedDays, totalPeriodDays)` 범용 함수 추가

**파이차트 짤림 수정 (`reports.tsx`)**
- [x] 기존: `flexDirection: 'row'` 레이아웃에서 `width={SW/2 - 8}` → 차트 좌측 클리핑 발생
- [x] 수정: 파이차트를 카드 전체 너비(`CHART_W`)로 표시 후 아래에 레전드 3개 가로 나열 (세로 스택)

**백그라운드 장시간 후 null user 버그 수정**
- [x] **현상**: iPhone을 몇 시간 두었다 앱 복귀 시 "안녕하세요" + 0 데이터 표시 (강제 종료 후 재실행하면 정상)
- [x] **원인**: iOS가 백그라운드에서 JS 스레드를 일시 중단 → Supabase 토큰 갱신 타이머 멈춤 → 1시간 TTL 액세스 토큰 만료 → 포그라운드 복귀 시 API 401 에러
- [x] **수정 1** (`useAuth.ts`): AppState `'active'` 이벤트에서 `supabase.auth.getSession()` 강제 호출 → Supabase가 refresh token으로 자동 재발급
- [x] **수정 2** (`index.tsx`): AppState `'active'` + `user?.id` 존재 확인 후 대시보드 데이터 재로드 (`loadDataRef` + `userIdRef` 패턴으로 stale closure 방지)

#### 미완료 / 다음에 할 것
- [ ] 수동 식사 입력 화면(`manual/index.tsx`) UI 완성 및 연동
- [ ] 앱 아이콘/스플래시 실기기 확인
- [ ] 오프라인 → 온라인 전환 시 동기화 엣지케이스 테스트
- [ ] TestFlight 배포 (필요 시)

---

### 2026-05-16 (Day 5) — QR 코드 접속 시 로그인 풀림 현상 근본 수정

#### 문제 현상
- Expo Go QR 코드로 앱 진입 시 "안녕하세요 👋" (비로그인 UI) + 0 데이터 표시
- 앱을 끄고 다시 켜면 (포그라운드 복귀) 정상 표시
- 30분 이상 유휴 후 QR 재접속 시 재현 (이전 AppState 수정으로도 해결 안 됨)

#### 근본 원인 분석 (Supabase auth-js 2.105.4 소스코드 직접 분석)

**원인 1: `fetchUserProfile` 실패 + 재시도 없음 (주 원인)**
- QR 진입 시 WiFi가 30분 이상 유휴 상태에서 깨어나면서 첫 Supabase DB 쿼리가 순간 네트워크 오류로 실패
- 토큰은 만료되지 않음 (Supabase 기본 JWT TTL = 1시간, 30분이면 아직 유효)
- 실패 후 재시도 로직이 전혀 없어 `user = null`, `loading = false`로 영구 고착

**원인 2: `getSession()` + `onAuthStateChange` 이중 호출 race condition (부 원인)**
- `getSession()`과 `onAuthStateChange` 두 경로가 동시에 `fetchUserProfile()`을 호출
- Supabase 내부적으로 두 호출이 `_acquireLock`으로 직렬화되지만, 실패한 쪽이 성공한 쪽보다 나중에 완료되는 경우 상태 역전 가능

**왜 끄고 다시 켜면 되는가?**
- AppState `active` 이벤트 → `getSession()` + `fetchUserProfile()` 재실행
- 포그라운드 복귀 시점에는 네트워크가 이미 안정화 → 성공

#### 수정 내용 (`hooks/useAuth.ts`)

| 변경 | 내용 |
|------|------|
| `getSession()` 초기 호출 **제거** | `onAuthStateChange`만 사용하여 중복 호출 및 race condition 완전 제거 |
| `fetchUserProfile` → `useCallback(fn, [])` | `useEffect` 의존성 배열에서 안정적으로 참조 가능 |
| **재시도 `useEffect` 추가** | `!loading && session?.user && !user` 조건 감지 → 2초 후 자동 재조회 |
| 타임아웃 **5초 → 15초** | 느린 네트워크에서도 충분한 초기화 시간 확보 |

```
[정상 흐름 - 수정 후]
QR 진입 → INITIAL_SESSION 발화 → fetchUserProfile 실패 (순간 오류)
  → user=null, loading=false → "안녕하세요" 잠깐 표시
  → 2초 후 재시도 → 네트워크 안정 → 성공
  → user=profile → "매너리아 님, 안녕하세요" 표시 ✅
```

#### 기술 메모
- Supabase `onAuthStateChange`의 `INITIAL_SESSION` 이벤트는 `_recoverAndRefresh()` 완료 후 발화
- 토큰 갱신 실패(네트워크 오류, `isAuthRetryableFetchError = true`)시 만료 세션이 AsyncStorage에 유지되고 30초마다 자동 재시도
- `EXPIRY_MARGIN_MS = 90,000ms` (90초): 만료 90초 전부터 갱신 시도

---

## 다른 컴퓨터에서 이어서 개발하기

### 방법 1: USB로 프로젝트 복사 (권장)
```bash
# 1. Windows에서 USB로 복사 (node_modules 제외!)
#    탐색기에서 FoodLens 폴더를 USB에 복사하되
#    node_modules 폴더는 제외 (용량 크고 OS별로 다름)

# 2. MacBook에서 USB → 원하는 위치에 복사
cp -r /Volumes/USB/FoodLens ~/Projects/FoodLens

# 3. .env 파일 확인 (.gitignore에 포함이라 별도 확인)
#    .env 파일이 복사되었는지 확인

# 4. 의존성 재설치
cd ~/Projects/FoodLens
npm install

# 5. 실행
npx expo start
```

### 방법 2: Git 사용
```bash
# Windows에서
cd d:\Vibe-Coding-Project\FoodLens
git add .
git commit -m "Day 1: 프로젝트 초기 세팅 완료"
git remote add origin <GitHub repo URL>
git push -u origin main

# MacBook에서
git clone <GitHub repo URL>
cd FoodLens
# .env 파일은 수동으로 생성 (보안상 git에 포함 안 됨)
npm install
npx expo start
```

### ⚠️ 주의사항
1. **node_modules는 복사하지 마세요** — OS/아키텍처별 네이티브 모듈이 달라서 `npm install`로 새로 설치해야 합니다
2. **.env 파일** — .gitignore에 포함되어 있으므로 Git 사용 시 별도로 복사해야 합니다. USB 복사 시에는 함께 복사됩니다
3. **.expo/ 폴더** — 복사 안 해도 됩니다 (자동 생성)
4. **MacBook에 Node.js 필요** — v18 이상 권장 (`node -v`로 확인)
5. **MacBook에 Expo Go 앱 설치** — App Store에서 "Expo Go" 설치
6. **iPhone과 MacBook이 같은 Wi-Fi** — Expo Go로 테스트 시 필수

---

## 환경변수 (맥북에서 .env 만들 때 참고)
```
EXPO_PUBLIC_SUPABASE_URL=https://nodwnyghvzgewwdgtber.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=(Supabase 대시보드 > Settings > API > Legacy anon key)
EXPO_PUBLIC_GEMINI_API_KEY=(Google AI Studio에서 발급한 키)
```

---

## 기술 메모
- Expo Router v6: 파일 기반 라우팅 (app/ 폴더 구조 = URL 구조)
- Supabase Auth: travel-manager와 계정 공유됨
- Gemini 2.0 Flash: REST API 직접 호출 (SDK 미사용, fetch 기반)
- 오프라인: AsyncStorage 큐에 저장 → 앱 foreground 복귀 시 자동 sync
- 이미지: expo-image-manipulator로 800px 리사이즈 + 0.3 quality 압축
- 차트: react-native-chart-kit (Expo Go 호환)
- PieChart 주의: `hasLegend={false}` + 전체 너비 사용 시 클리핑 없음. 좁은 너비(`SW/2`)에서는 세로 스택 레이아웃 필요
- iOS 백그라운드: JS 스레드 일시 중단으로 Supabase 토큰 갱신 타이머 멈춤 → AppState `'active'` 이벤트에서 `getSession()` 강제 호출로 해결
- Supabase Storage upsert: `upsert: true` 옵션은 UPDATE 정책 필요 → DELETE 후 INSERT 방식 권장
- **QR 진입 로그인 풀림**: `getSession()` + `onAuthStateChange` 동시 사용 금지 (race condition) → `onAuthStateChange`만 사용. `fetchUserProfile` 실패 시 2초 후 자동 재시도 useEffect로 해결 (`!loading && session?.user && !user` 조건 감지)
- Supabase auth-js 2.x 내부 동작: `onAuthStateChange` 등록 시 `initializePromise` 대기 후 `_emitInitialSession()` → `_useSession()` → `__loadSession()` 순으로 실행. 토큰 만료 시 내부적으로 `_callRefreshToken()` 호출 후 `INITIAL_SESSION` 발화
