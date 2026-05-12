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
│   │   ├── reports.tsx     # 주간/월간 리포트
│   │   └── profile.tsx     # 프로필 설정
│   ├── camera/index.tsx    # 카메라/갤러리 → AI 분석
│   ├── analysis/[id].tsx   # 분석 결과 확인/수정/저장
│   └── guide/index.tsx     # AI 건강 가이드
├── services/               # 외부 서비스 연동
│   ├── supabaseClient.ts   # Supabase 클라이언트
│   ├── imageService.ts     # 카메라/갤러리/압축/업로드
│   ├── geminiService.ts    # Gemini AI 분석 API
│   ├── offlineQueue.ts     # 오프라인 큐 (AsyncStorage)
│   └── reportService.ts    # 주간/월간 리포트 집계
├── hooks/                  # React 커스텀 훅
│   ├── useAuth.ts          # 인증 + 프로필 관리
│   ├── useMealEntries.ts   # 식사 기록 CRUD
│   └── useOfflineSync.ts   # 오프라인 자동 동기화
├── types/models.ts         # TypeScript 타입 정의
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
- [ ] iPhone Expo Go 실제 테스트 (회사 네트워크 제한으로 미진행)
- [ ] 로그인 → 프로필 설정 → 사진 촬영 → AI 분석 전체 플로우 테스트
- [ ] 에러/예외 케이스 테스트 (오프라인, API 실패 등)
- [ ] 앱 아이콘/스플래시 커스터마이징
- [ ] 필요시 UI 다듬기

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
