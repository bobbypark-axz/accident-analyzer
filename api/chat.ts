import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Langfuse } from 'langfuse';

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

    // Langfuse — 매 요청마다 새 인스턴스
    let lf: Langfuse | null = null;
    const lfSecret = process.env.LANGFUSE_SECRET_KEY;
    const lfPublic = process.env.LANGFUSE_PUBLIC_KEY;
    const lfBase = (process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com').trim();
    if (lfSecret && lfPublic) {
      lf = new Langfuse({ secretKey: lfSecret.trim(), publicKey: lfPublic.trim(), baseUrl: lfBase });
    }

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
      trace?.update({ output: { error: errorMsg }, metadata: { level: 'ERROR' } });
      if (lf) await lf.shutdownAsync().catch(() => {});
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = await response.json();
    const outputText = data.content?.[0]?.text || '';
    const duration = Date.now() - startTime;

    // Langfuse 로깅
    if (trace && lf) {
      trace.generation({
        name: 'claude-sonnet-4-6',
        model: 'claude-sonnet-4-6',
        modelParameters: { max_tokens: maxTokens },
        input: { system: systemMsg, user: userInput },
        output: outputText,
        usage: {
          input: data.usage?.input_tokens,
          output: data.usage?.output_tokens,
        },
        metadata: { durationMs: duration },
      });
      trace.update({
        output: { text: outputText },
        metadata: { durationMs: duration, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      });
    }

    // 응답 전에 Langfuse flush 완료
    if (lf) {
      await lf.flushAsync().catch(() => {});
    }

    return res.status(200).json({
      choices: [{ message: { content: outputText } }],
      usage: data.usage,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '서버 오류' });
  }
}
