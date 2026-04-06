import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Langfuse } from 'langfuse';

let langfuse: Langfuse | null = null;
function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';
  if (!secretKey || !publicKey) return null;
  langfuse = new Langfuse({ secretKey, publicKey, baseUrl });
  return langfuse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* keep */ }
    }

    const { messages, max_completion_tokens } = body || {};
    if (!messages) return res.status(400).json({ error: '메시지가 필요합니다.' });

    const systemMsg = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMsgs = messages.filter((m: any) => m.role !== 'system');
    const userInput = userMsgs.map((m: any) => m.content).join('\n');
    const maxTokens = max_completion_tokens || 4096;

    // Langfuse 추적 시작
    const lf = getLangfuse();
    const trace = lf?.trace({
      name: 'accident-analysis',
      input: { userInput: userInput.substring(0, 500) },
      metadata: { maxTokens },
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemMsg,
        messages: userMsgs.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err.error?.message || 'API 호출 실패';
      trace?.update({ output: { error: errorMsg }, level: 'ERROR' });
      await lf?.shutdownAsync();
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = await response.json();
    const outputText = data.content?.[0]?.text || '';
    const duration = Date.now() - startTime;

    // Langfuse 로깅
    if (trace) {
      trace.generation({
        name: 'claude-sonnet-4-6',
        model: 'claude-sonnet-4-6',
        modelParameters: { max_tokens: maxTokens },
        input: { system: systemMsg.substring(0, 200), user: userInput.substring(0, 500) },
        output: outputText.substring(0, 1000),
        usage: {
          input: data.usage?.input_tokens,
          output: data.usage?.output_tokens,
        },
        metadata: { durationMs: duration },
      });
      trace.update({
        output: { text: outputText.substring(0, 500) },
        metadata: { durationMs: duration, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      });
    }
    // 비동기로 flush (응답 지연 방지)
    lf?.shutdownAsync().catch(() => {});

    return res.status(200).json({
      choices: [{ message: { content: outputText } }],
      usage: data.usage,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '서버 오류' });
  }
}
