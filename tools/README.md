# FoodLens Tools

실제 동작을 수행하는 코드 모듈. Agent(Claude)가 직접 머릿속으로 처리하지 않고, 이 Tool들을 실행하여 결과를 받는다.

## Tool 목록

### 앱 소스코드 (src/)
| 경로 | 역할 |
|------|------|
| src/services/supabaseClient.ts | Supabase 초기화 및 세션 관리 |
| src/services/geminiService.ts | Gemini API 음식 분석 + 건강 가이드 |
| src/services/imageService.ts | 이미지 압축, EXIF 추출, Storage 업로드 |
| src/services/offlineQueue.ts | 오프라인 큐 관리 및 동기화 |
| src/services/reportService.ts | 주간/월간 리포트 집계 |
| src/hooks/useAuth.ts | 인증 상태 관리 훅 |
| src/hooks/useMealEntries.ts | 식사 데이터 CRUD 훅 |
| src/hooks/useOfflineSync.ts | 오프라인 동기화 훅 |

### 규칙
- 하나의 Tool은 하나의 역할만 수행 (단일 책임)
- 입력과 출력이 명확
- 에러 발생 시 명확한 에러 메시지 반환
- Tool끼리 직접 호출하지 않음 (Agent가 흐름 관리)
