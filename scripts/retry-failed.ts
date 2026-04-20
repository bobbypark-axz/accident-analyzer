import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generateTitle } from '../src/lib/chart-titles';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const API_BASE = 'https://whosefault-ai.vercel.app';

const SYSTEM_PROMPT = `당신은 교통사고 분석 전문가입니다. 반드시 아래 JSON만 출력하세요.
코드블록(\`\`\`)이나 설명 텍스트 없이 순수 JSON만 출력하세요.

중요: ratio.a=본인, ratio.b=상대방.

{"summary":"사고 개요 2~3문장","chartCode":"차X-X","chartName":"도표 유형명","ratio":{"a":{"label":"본인 차량 (행동)","percent":30},"b":{"label":"상대 차량 (행동)","percent":70},"reason":"핵심 근거"},"laws":[{"name":"도로교통법 제X조","content":"조문","relevance":"관련성","effect":"효과"}],"cases":[{"title":"사례","facts":"사실관계","ruling":"과실비율","reason":"근거"}],"notes":["참고"],"needed":["필요정보"]}

chartCode: 차1-1~2, 차2-1~6, 차3-1~8(신호교차로), 차10-1, 차11-1~6, 차12-1~2, 차13-1~4, 차14-1~20-2(비신호교차로), 차31-1~4, 차33-1~2(도로외), 차41-1(후행추돌), 차42-1~3, 차43-1~7(차선변경), 차44-1, 차51-1~2(보행자).

후행추돌=차41-1 필수. laws 2~3개, cases 1~2개. ratio 합=100. 한국어.`;

const FAILED = ['2765bf29-5bac-4207-951e-644281ab7e8c', 'a130ec86-19f1-43ed-8cf8-7e7a9bae99f6'];

function esc(s: string) { return s.replace(/'/g, "''"); }

async function analyze(description: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `다음 교통사고 상황을 분석하여 과실비율을 예측해주세요:\n\n${description}` },
          ],
          max_completion_tokens: 2500,
        }),
      });
      if (!res.ok) {
        console.log(`  시도 ${attempt}: HTTP ${res.status}`);
        if (attempt < retries) await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const si = cleaned.indexOf('{');
      if (si === -1) throw new Error('no JSON');
      let d = 0, ei = si;
      for (let i = si; i < cleaned.length; i++) {
        if (cleaned[i] === '{') d++;
        else if (cleaned[i] === '}') { d--; if (d === 0) { ei = i; break; } }
      }
      const parsed = JSON.parse(cleaned.slice(si, ei + 1));

      if (parsed.ratio?.a && parsed.ratio?.b) {
        parsed.ratio.a.percent = Number(parsed.ratio.a.percent) || 0;
        parsed.ratio.b.percent = Number(parsed.ratio.b.percent) || 0;
        const sum = parsed.ratio.a.percent + parsed.ratio.b.percent;
        if (sum !== 100 && sum > 0) {
          parsed.ratio.a.percent = Math.round((parsed.ratio.a.percent / sum) * 100);
          parsed.ratio.b.percent = 100 - parsed.ratio.a.percent;
        }
      }
      return parsed;
    } catch (e: any) {
      console.log(`  시도 ${attempt} 파싱 실패: ${e.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return null;
}

(async () => {
  const { data } = await supabase
    .from('posts')
    .select('id, title, description')
    .in('id', FAILED);

  let sql = `-- 재시도 결과\n\nbegin;\n\n`;
  for (const p of (data || []) as any[]) {
    console.log(`\n━ ${p.id.slice(0, 8)} ${p.title?.slice(0, 30)} ━`);
    const a = await analyze(p.description || '');
    if (!a) { console.log('  최종 실패'); continue; }
    console.log(`  ✓ ${a.chartCode} ${a.ratio?.a?.percent}:${a.ratio?.b?.percent}`);
    const newTitle = generateTitle(a.chartCode, a.summary || '');
    sql += `update posts set `;
    sql += `analysis = '${esc(JSON.stringify(a))}'::jsonb, `;
    sql += `fault_ratio_a = ${a.ratio?.a?.percent ?? 50}, `;
    sql += `fault_ratio_b = ${a.ratio?.b?.percent ?? 50}, `;
    sql += `chart_code = ${a.chartCode ? `'${esc(a.chartCode)}'` : 'null'}, `;
    sql += `summary = '${esc(a.summary || '')}', `;
    sql += `title = '${esc(newTitle)}' `;
    sql += `where id = '${p.id}';\n`;
  }
  sql += `\ncommit;\n`;
  fs.writeFileSync('scripts/retry-updates.sql', sql);
  console.log(`\n✓ SQL: scripts/retry-updates.sql`);
})();
