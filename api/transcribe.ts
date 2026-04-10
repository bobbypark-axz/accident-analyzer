import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });

    const { audio } = req.body;
    if (!audio) return res.status(400).json({ error: '오디오 데이터가 필요합니다.' });

    // base64 → Buffer → Blob for FormData
    const audioBuffer = Buffer.from(audio, 'base64');
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');
    formData.append('prompt', '교통사고 상황 설명. 신호등, 교차로, 차선, 직진, 좌회전, 우회전, 추돌, 접촉, 과실.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || '음성 인식 실패' });
    }

    const data = await response.json();
    return res.status(200).json({ text: data.text });
  } catch (error: any) {
    console.error('Whisper API 오류:', error);
    return res.status(500).json({ error: error.message || '서버 오류' });
  }
}
