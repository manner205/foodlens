// services/geminiService.ts
// 2026-05-12: Gemini API 음식 분석 + 건강 가이드 서비스

import { DayGuideData, FoodAnalysisResult, HealthGuideResult, User } from '@/types/models';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_TEXT_URL = GEMINI_VISION_URL;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('AI 응답 시간이 초과되었습니다 (30초). 다시 시도해주세요.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 음식 사진 분석
export async function analyzeFoodPhoto(base64Image: string): Promise<FoodAnalysisResult> {
  const prompt = `당신은 전문 영양사 AI입니다. 이 음식 사진을 분석하고 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 추가하지 마세요.

{
  "food_items": [
    {"name": "음식 이름", "quantity": "추정량", "unit": "g/ml/개/컵 등"}
  ],
  "nutrition": {
    "calories": 숫자,
    "protein_g": 숫자,
    "carbohydrates_g": 숫자,
    "fat_g": 숫자,
    "fiber_g": 숫자
  },
  "warnings": ["불확실한 부분이 있으면 경고 메시지"]
}

규칙:
- 한국 음식에 특히 정확하게 분석
- 포션 크기를 보수적으로 추정
- 여러 음식이 보이면 전체 합산 영양소 제공`;

  const response = await fetchWithTimeout(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('Gemini response structure:', JSON.stringify(data).substring(0, 300));
  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.find((p: any) => p.text)?.text;

  if (!text) {
    throw new Error('Gemini API 응답이 비어있습니다.');
  }

  return parseGeminiResponse(text);
}

// Gemini 응답 JSON 파싱
function parseGeminiResponse(text: string): FoodAnalysisResult {
  let parsed: any;
  try {
    // responseMimeType: application/json 이면 순수 JSON으로 옴
    parsed = JSON.parse(text.trim());
  } catch {
    // fallback: 마크다운 코드블록 또는 중괄호 추출
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다. 수동으로 입력해주세요.');
    }
    parsed = JSON.parse((jsonMatch[1] || jsonMatch[0]).trim());
  }

  // 필수 필드 검증
  if (!parsed.nutrition || typeof parsed.nutrition.calories !== 'number') {
    throw new Error('AI 응답 형식이 올바르지 않습니다. 수동으로 입력해주세요.');
  }

  const foodItems: any[] = parsed.food_items || [];
  const warnings: string[] = parsed.warnings || [];

  // Gemini 자체 평가 대신 응답 품질 기반으로 직접 계산
  let confidence = 95;
  confidence -= warnings.length * 15;
  confidence -= foodItems.filter((f: any) => !f.quantity || f.quantity === '').length * 5;
  if (foodItems.length === 0) confidence -= 20;
  const confidence_score = Math.max(30, Math.min(95, confidence));

  return {
    food_items: foodItems,
    nutrition: {
      calories: Math.round(parsed.nutrition.calories),
      protein_g: Math.round(parsed.nutrition.protein_g * 10) / 10,
      carbohydrates_g: Math.round(parsed.nutrition.carbohydrates_g * 10) / 10,
      fat_g: Math.round(parsed.nutrition.fat_g * 10) / 10,
      fiber_g: Math.round(parsed.nutrition.fiber_g * 10) / 10,
    },
    confidence_score,
    warnings,
  };
}

// 건강 가이드 AI 조언 요청
export async function getHealthGuide(
  user: User,
  guideData: DayGuideData[],
  periodLabel: string,
  isSingleMeal = false,
  isToday = false
): Promise<HealthGuideResult> {
  const goalLabel = { lose: '체중 감량', maintain: '체중 유지', gain: '체중 증가' };
  const d = guideData[0];

  const now = new Date();
  const currentTimeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const remainingHours = 24 - now.getHours();

  let prompt: string;

  if (isSingleMeal) {
    prompt = `당신은 전문 영양사 AI입니다. 아래 사용자 프로필과 한 끼 식사 데이터를 분석하고, 이 식사에 대한 맞춤 평가를 제공하세요.

사용자 프로필:
- 나이: ${user.age}세
- 체중: ${user.weight_kg}kg
- 키: ${user.height_cm}cm
- 목표: ${goalLabel[user.goal || 'maintain']}
- 일일 칼로리 목표: ${user.daily_calorie_goal}kcal (한끼 기준 약 ${Math.round((user.daily_calorie_goal || 2000) / 3)}kcal)

${periodLabel} 식사:
- 칼로리: ${d?.calories}kcal
- 단백질: ${d?.protein_g}g / 탄수화물: ${d?.carbohydrates_g}g / 지방: ${d?.fat_g}g
- 음식: ${d?.food_names.join(', ') || '정보 없음'}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "이 식사의 영양 균형 평가 (2-3문장, 한국어, 음식명 직접 언급)",
  "recommendations": ["이 식사를 보완할 음식/영양소 추천", "다음 끼니 조언", "조언 3"],
  "warnings": ["주의사항이 있으면 (예: 나트륨, 포화지방 등)"]
}`;
  } else if (isToday) {
    const todayData = guideData[0];
    const mealCount = todayData?.meal_count ?? 0;
    const remainingCalories = Math.max(0, (user.daily_calorie_goal || 2000) - (todayData?.calories ?? 0));

    prompt = `당신은 전문 영양사 AI입니다. 오늘 지금까지 섭취한 식사를 분석하고, 남은 끼니에 대한 맞춤 조언을 제공하세요.

사용자 프로필:
- 나이: ${user.age}세
- 체중: ${user.weight_kg}kg
- 키: ${user.height_cm}cm
- 목표: ${goalLabel[user.goal || 'maintain']}
- 일일 칼로리 목표: ${user.daily_calorie_goal}kcal

오늘 현재까지 섭취 (현재 시각: ${currentTimeStr}, 약 ${remainingHours}시간 남음):
- 섭취 칼로리: ${todayData?.calories ?? 0}kcal (남은 칼로리 여유: 약 ${remainingCalories}kcal)
- 단백질: ${todayData?.protein_g ?? 0}g / 탄수화물: ${todayData?.carbohydrates_g ?? 0}g / 지방: ${todayData?.fat_g ?? 0}g
- 기록된 끼니 수: ${mealCount}끼
- 먹은 음식: ${todayData?.food_names.join(', ') || '정보 없음'}

⚠️ 중요: 오늘 하루는 아직 진행 중입니다. 지금까지 먹은 것만 기록된 것이며 저녁 등 남은 끼니가 있을 수 있습니다.
절대로 하루 칼로리 미달로 평가하지 마세요. 지금까지의 영양 섭취 현황을 평가하고, 남은 끼니에서 무엇을 먹으면 좋을지 구체적으로 추천하세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "오늘 지금까지 섭취 현황 평가 (2-3문장, 한국어, 먹은 음식 직접 언급, 하루 미달 표현 금지)",
  "recommendations": ["남은 끼니에서 보완할 음식/영양소 추천 (구체적 음식명 포함)", "남은 칼로리 여유를 고려한 식사 제안", "오늘 식단 전체 균형 팁"],
  "warnings": ["주의사항이 있으면 (예: 나트륨, 포화지방 등, 없으면 빈 배열)"]
}`;
  } else {
    prompt = `당신은 전문 영양사 AI입니다. 아래 사용자 프로필과 ${periodLabel} 식단 데이터를 분석하고, 맞춤 건강 가이드를 제공하세요.

사용자 프로필:
- 나이: ${user.age}세
- 체중: ${user.weight_kg}kg
- 키: ${user.height_cm}cm
- 목표: ${goalLabel[user.goal || 'maintain']}
- 일일 칼로리 목표: ${user.daily_calorie_goal}kcal

${periodLabel} 식단 데이터:
${guideData.map(d =>
  `${d.date}: ${d.calories}kcal, 단백질 ${d.protein_g}g, 탄수화물 ${d.carbohydrates_g}g, 지방 ${d.fat_g}g (${d.meal_count}끼)${d.food_names.length > 0 ? ` | 음식: ${d.food_names.join(', ')}` : ''}`
).join('\n')}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "전체 식단 평가 (2-3문장, 한국어, 구체적인 음식명 언급 포함)",
  "recommendations": ["구체적인 개선 조언 1 (음식명 포함)", "조언 2", "조언 3"],
  "warnings": ["주의사항이 있으면"]
}`;
  }

  const response = await fetchWithTimeout(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.find((p: any) => p.text)?.text;

  if (!text) throw new Error('AI 응답이 비어있습니다.');

  let parsed: any;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error('AI 응답 파싱 실패');
    parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }

  if (!parsed.summary || !Array.isArray(parsed.recommendations)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.');
  }

  return {
    summary: parsed.summary,
    recommendations: parsed.recommendations,
    warnings: parsed.warnings || [],
  };
}
