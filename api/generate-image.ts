import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });

    const { summary } = req.body || {};
    if (!summary) return res.status(400).json({ error: '사고 요약이 필요합니다.' });

    const prompt = `Simple top-down 2D diagram of a traffic accident scene: ${summary}. Clean illustration style, bird's eye view, showing road lanes, vehicles as simple colored rectangles with arrows showing direction of travel, collision point marked. No text, no people, minimal clean design, light gray road, white lane markings.`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || '이미지 생성 실패' });
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) return res.status(500).json({ error: '이미지 URL 없음' });

    // DALL-E URL을 서버에서 다운로드 → base64로 반환 (CORS 우회)
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return res.status(500).json({ error: '이미지 다운로드 실패' });
    const buffer = Buffer.from(await imgResp.arrayBuffer());
    const base64 = buffer.toString('base64');

    return res.status(200).json({ imageBase64: base64 });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '서버 오류' });
  }
}
