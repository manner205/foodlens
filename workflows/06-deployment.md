# Workflow 06: 배포

## 목표
Expo Go와 EAS Update로 2대 아이폰에 배포한다.

## 단계

### Step 1: Expo Go 로컬 테스트
- 개발 PC와 아이폰이 같은 Wi-Fi에 연결
- `npx expo start` → QR 코드 생성
- 본인 아이폰 Expo Go 앱 → QR 스캔 → 앱 실행
- 와이프 아이폰도 동일하게

### Step 2: EAS Update 설정 (선택)
- `npm install -g eas-cli`
- `eas update:configure`
- `eas update --branch production`
- Wi-Fi 없이도 OTA 업데이트 가능

## 에러 대응
- QR 코드 스캔 안됨 → 같은 Wi-Fi인지 확인, 방화벽 확인
- Expo Go 호환성 → `npx expo install --fix`로 버전 맞춤

## 결과물
- 2대 아이폰에서 FoodLens 앱 정상 실행
