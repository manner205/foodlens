# Workflow 02: Supabase 백엔드 설정

## 목표
기존 travel-manager Supabase 프로젝트에 FoodLens용 테이블을 추가한다.
(무료 플랜 프로젝트 수 제한으로 기존 프로젝트 공유)

## 선행 조건
- Supabase 계정 (travel-manager 프로젝트 사용 중)
- supabase.com 접근 가능한 네트워크
- 프로젝트 URL: https://nodwnyghvzgewwdgtber.supabase.co

## 주의사항
- travel-manager 기존 테이블에 영향 없도록 FoodLens 테이블은 `fl_` 접두어 사용
- 인증(Auth)은 travel-manager와 공유 (같은 계정으로 로그인 가능)

## 단계

### Step 1: Supabase 대시보드 접속
- https://supabase.com/dashboard/project/nodwnyghvzgewwdgtber
- SQL Editor 열기

### Step 2: fl_users 테이블 생성
```sql
create table fl_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  age int,
  weight_kg numeric,
  height_cm int,
  goal text check (goal in ('lose', 'maintain', 'gain')),
  daily_calorie_goal int,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table fl_users enable row level security;

create policy "FL: Users can view own profile" on fl_users for select to authenticated using (auth.uid() = id);
create policy "FL: Users can insert own profile" on fl_users for insert to authenticated with check (auth.uid() = id);
create policy "FL: Users can update own profile" on fl_users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
```

### Step 3: fl_meal_entries 테이블 생성
```sql
create table fl_meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references fl_users(id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_time timestamp with time zone not null,
  photo_url text,
  nutrition jsonb not null,
  food_items jsonb,
  notes text,
  synced_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_fl_meal_entries_user_id on fl_meal_entries(user_id);
create index idx_fl_meal_entries_meal_time on fl_meal_entries(meal_time desc);
create index idx_fl_meal_entries_user_date on fl_meal_entries(user_id, (meal_time::date));

alter table fl_meal_entries enable row level security;

create policy "FL: Users can view own meals" on fl_meal_entries for select to authenticated using (auth.uid() = user_id);
create policy "FL: Users can create own meals" on fl_meal_entries for insert to authenticated with check (auth.uid() = user_id);
create policy "FL: Users can update own meals" on fl_meal_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "FL: Users can delete own meals" on fl_meal_entries for delete to authenticated using (auth.uid() = user_id);
```

### Step 4: Storage 버킷 설정
- `meal-photos` 버킷 생성 (public: false)
```sql
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);

create policy "FL: Users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "FL: Users can view own photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

### Step 5: 인증 계정 확인
- travel-manager에서 이미 생성된 계정이 있으면 그대로 사용
- 없으면: Authentication > Users에서 2개 계정 생성 (본인 + 와이프)

### Step 6: 환경변수 업데이트
- .env 파일에 ANON_KEY 입력
- Settings > API > anon public 키 복사

## 에러 대응
- RLS 정책 오류 → SQL Editor에서 직접 실행하여 디버그
- 기존 테이블 충돌 → fl_ 접두어로 분리되어 있으므로 영향 없음

## 결과물
- fl_users, fl_meal_entries 테이블 생성 완료
- RLS 정책 활성화 (계정별 데이터 분리)
- meal-photos Storage 버킷 준비
- travel-manager 기존 기능에 영향 없음
