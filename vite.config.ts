import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
  plugins: [
    react(),
    basicSsl(),
    // 로컬 개발용 /api/chat 프록시 플러그인
    {
      name: 'local-api-proxy',
      configureServer(server) {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        };

        // /api/embedding 프록시
        server.middlewares.use('/api/embedding', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(200, corsHeaders);
            res.end();
            return;
          }
          if (req.method !== 'POST') {
            res.writeHead(405, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const apiKey = env.OPENAI_API_KEY;
              if (!apiKey) {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'OPENAI_API_KEY가 .env에 설정되지 않았습니다.' }));
                return;
              }
              const { input } = JSON.parse(body);
              const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'text-embedding-3-small', input }),
              });
              const data = await response.json();
              if (!response.ok) {
                res.writeHead(response.status, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: data.error?.message || '임베딩 생성 실패' }));
                return;
              }
              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ embedding: data.data[0].embedding }));
            } catch (err: any) {
              res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || '서버 오류' }));
            }
          });
        });



        // /api/transcribe 프록시 (OpenAI Whisper API)
        server.middlewares.use('/api/transcribe', async (req, res) => {
          if (req.method === 'OPTIONS') { res.writeHead(200, corsHeaders); res.end(); return; }
          if (req.method !== 'POST') { res.writeHead(405, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Method not allowed' })); return; }

          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const apiKey = env.OPENAI_API_KEY;
              if (!apiKey) { res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'OPENAI_API_KEY가 .env에 설정되지 않았습니다.' })); return; }

              const { audio } = JSON.parse(body);
              if (!audio) { res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '오디오 데이터가 필요합니다.' })); return; }

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
                res.writeHead(response.status, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.error?.message || '음성 인식 실패' }));
                return;
              }

              const data = await response.json();
              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ text: data.text }));
            } catch (err: any) {
              res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || '서버 오류' }));
            }
          });
        });

        // /api/chat 프록시 (Anthropic Claude API + Langfuse)
        let langfuseClient: any = null;
        server.middlewares.use('/api/chat', async (req, res) => {
          if (req.method === 'OPTIONS') { res.writeHead(200, corsHeaders); res.end(); return; }
          if (req.method !== 'POST') { res.writeHead(405, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Method not allowed' })); return; }

          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            const startTime = Date.now();
            try {
              const apiKey = env.ANTHROPIC_API_KEY;
              if (!apiKey) { res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY가 .env에 설정되지 않았습니다.' })); return; }

              const { messages, max_completion_tokens } = JSON.parse(body);
              const systemMsg = messages.find((m: any) => m.role === 'system')?.content || '';
              const userMsgs = messages.filter((m: any) => m.role !== 'system');
              const userInput = userMsgs.map((m: any) => m.content).join('\n');
              const maxTokens = max_completion_tokens || 4096;

              // Langfuse 초기화
              if (!langfuseClient && env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY) {
                try {
                  const { Langfuse } = await import('langfuse');
                  langfuseClient = new Langfuse({ secretKey: env.LANGFUSE_SECRET_KEY, publicKey: env.LANGFUSE_PUBLIC_KEY, baseUrl: env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com' });
                } catch { /* langfuse not installed */ }
              }
              const trace = langfuseClient?.trace({ name: 'accident-analysis', input: { user: userInput.substring(0, 500) } });

              const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system: systemMsg, messages: userMsgs.map((m: any) => ({ role: m.role, content: m.content })) }),
              });

              const data = await response.json();
              if (!response.ok) {
                trace?.update({ output: { error: data.error?.message }, level: 'ERROR' });
                langfuseClient?.flushAsync?.().catch(() => {});
                res.writeHead(response.status, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: data.error?.message || 'API 호출 실패' })); return;
              }

              const outputText = data.content?.[0]?.text || '';
              // Langfuse 로깅
              if (trace) {
                trace.generation({ name: 'claude-sonnet-4-6', model: 'claude-sonnet-4-6', input: { user: userInput.substring(0, 500) }, output: outputText.substring(0, 1000), usage: { input: data.usage?.input_tokens, output: data.usage?.output_tokens }, metadata: { durationMs: Date.now() - startTime } });
                trace.update({ output: { text: outputText.substring(0, 500) } });
                langfuseClient?.flushAsync?.().catch(() => {});
              }

              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ choices: [{ message: { content: outputText } }], usage: data.usage }));
            } catch (err: any) { res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message || '서버 오류' })); }
          });
        });
      },
    },
    {
      name: 'inject-env-vars',
      transformIndexHtml(html) {
        // Google Analytics ID만 주입 (다른 환경 변수는 import.meta.env로 처리)
        const gaId = process.env.VITE_GA_MEASUREMENT_ID || '';
        
        let result = html;
        if (gaId) {
          result = result.replace(/%VITE_GA_MEASUREMENT_ID%/g, gaId);
        }
        
        return result;
      },
    },
  ],
  optimizeDeps: {
    exclude: [],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
};
});