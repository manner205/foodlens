// services/geminiService.ts
// 2026-05-12: Gemini API 음식 분석 + 건강 가이드 서비스

import { DailyNutritionSummary, FoodAnalysisResult, HealthGuideResult, User } from '@/types/models';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
  "confidence_score": 0~100 사이 숫자,
  "warnings": ["불확실한 부분이 있으면 경고 메시지"]
}

규칙:
- 한국 음식에 특히 정확하게 분석
- 포션 크기를 보수적으로 추정
- 불확실하면 confidence_score를 낮게 설정
- 여러 음식이 보이면 전체 합산 영양소 제공`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
        thinkingConfig: {
          thinkingBudget: 0,
        },
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

  return {
    food_items: parsed.food_items || [],
    nutrition: {
      calories: Math.round(parsed.nutrition.calories),
      protein_g: Math.round(parsed.nutrition.protein_g * 10) / 10,
      carbohydrates_g: Math.round(parsed.nutrition.carbohydrates_g * 10) / 10,
      fat_g: Math.round(parsed.nutrition.fat_g * 10) / 10,
      fiber_g: Math.round(parsed.nutrition.fiber_g * 10) / 10,
    },
    confidence_score: parsed.confidence_score ?? 50,
    warnings: parsed.warnings || [],
  };
}

// 건강 가이드 AI 조언 요청
export async function getHealthGuide(
  user: User,
  weeklyData: DailyNutritionSummary[]
): Promise<HealthGuideResult> {
  const goalLabel = { lose: '체중 감량', maintain: '체중 유지', gain: '체중 증가' };

  const prompt = `당신은 전문 영양사 AI입니다. 아래 사용자 프로필과 최근 7일 식단 데이터를 분석하고, 맞춤 건강 가이드를 제공하세요.

사용자 프로필:
- 나이: ${user.age}세
- 체중: ${user.weight_kg}kg
- 키: ${user.height_cm}cm
- 목표: ${goalLabel[user.goal || 'maintain']}
- 일일 칼로리 목표: ${user.daily_calorie_goal}kcal

최근 7일 식단 데이터:
${weeklyData.map(d => `${d.date}: ${d.calories}kcal, 단백질 ${d.protein_g}g, 탄수화물 ${d.carbohydrates_g}g, 지방 ${d.fat_g}g (${d.meal_count}끼)`).join('\n')}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary": "전체 식단 평가 (2-3문장, 한국어)",
  "recommendations": ["구체적인 개선 조언 1", "조언 2", "조언 3"],
  "warnings": ["주의사항이 있으면"]
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API 오류: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('AI 응답이 비어있습니다.');

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패');

  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}
