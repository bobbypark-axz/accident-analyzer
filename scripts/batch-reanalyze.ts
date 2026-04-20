import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generateTitle } from '../src/lib/chart-titles';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const API_BASE = 'https://whosefault-ai.vercel.app';
const CONCURRENCY = 5;
const OUT_SQL = 'scripts/reanalyze-updates.sql';

// App.tsx 의 SYSTEM_PROMPT 복사본 (원본 수정되면 여기도 동기화)
const SYSTEM_PROMPT = `당신은 교통사고 분석 전문가입니다. 반드시 아래 JSON만 출력하세요.
코드블록(\`\`\`)이나 설명 텍스트 없이 순수 JSON만 출력하세요.
키 이름을 절대 변경하지 마세요. 아래 키 이름을 정확히 사용하세요.

중요: ratio.a는 반드시 "본인 차량(입력자)"의 과실, ratio.b는 반드시 "상대방 차량"의 과실입니다.
- ratio.a.label은 "본인 차량 (○○)" 형태로 작성 (예: "본인 차량 (직진)")
- ratio.b.label은 "상대 차량 (○○)" 형태로 작성 (예: "상대 차량 (좌회전)")

{"summary":"사고 개요 2~3문장","chartCode":"차X-X","chartName":"도표 유형명","ratio":{"a":{"label":"본인 차량 (행동)","percent":30},"b":{"label":"상대 차량 (행동)","percent":70},"reason":"핵심 근거 2~3문장"},"laws":[{"name":"도로교통법 제X조(조항명)","content":"조문 요약","relevance":"관련성","effect":"법적 효과"}],"cases":[{"title":"사례 제목","facts":"사실관계","ruling":"과실비율","reason":"판단 근거"}],"notes":["참고사항"],"needed":["필요한 정보"]}

chartCode (아래 목록에서만 선택):
[신호교차로] 차1-1~2, 차2-1~6, 차3-1~8, 차4-1~2, 차5-1~2, 차6-1, 차7-1~2, 차8-1~3, 차9-1~2
[비신호교차로] 차10-1, 차11-1~6, 차12-1~2, 차13-1~4, 차14-1, 차15-1, 차16-1~5, 차17-1~2, 차18-1~2, 차19-1, 차20-1~2, 차21-1
[도로외] 차31-1~4, 차32-1, 차33-1~2
[동일방향] 차41-1(후행추돌/전방주시태만), 차42-1(선행사고 정차 추돌), 차42-2~3(진로변경), 차43-1~7, 차44-1(주차장), 차45-1~6(고속도로), 차46-1(터널), 차47-1~3(버스), 차48-1(긴급차)
[보행자] 차51-1~2, 차52-1(보도), 차53-1, 차54-1~5, 차55-1~7
[이륜차] 차61-1~3

매칭 원칙: 후행추돌=반드시 차41-1. 신호위반=차1-2 또는 차3-1. 선행사고·고장 정차차 추돌=차42-1.

과실비율 기준:
- 추돌(뒤에서 들이받음): 추돌한 차량 100%, 피추돌 차량 0%. 신호대기·정차 중이면 피해차량 0.
- 예외 차42-1(선행사고/고장 정차 추돌): 일반도로 A 80 : B 20, 고속도로 A 60 : B 40.
- 신호위반: 신호위반 차량 100%.
- 중앙선 침범: 침범 차량 100%.

규칙: laws 2~3개, cases 1~2개. ratio.a.percent + ratio.b.percent = 정확히 100. 한국어. A=본인, B=상대방.`;

interface Analysis {
  summary: string;
  chartCode?: string;
  chartName?: string;
  ratio: { a: { label: string; percent: number }; b: { label: string; percent: number }; reason: string };
  laws: any[];
  cases: any[];
  notes?: string[];
  needed?: string[];
}

function esc(s: string) { return s.replace(/'/g, "''"); }

async function analyze(description: string): Promise<Analysis | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `다음 교통사고 상황을 분석하여 과실비율을 예측해주세요:\n\n${description}` },
        ],
        max_completion_tokens: 3072,
      }),
    });
    if (!res.ok) { console.error(`  [${((Date.now()-t0)/1000).toFixed(1)}s] HTTP ${res.status}`); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const si = cleaned.indexOf('{');
    if (si === -1) return null;
    let d = 0, ei = si;
    for (let i = si; i < cleaned.length; i++) {
      if (cleaned[i] === '{') d++;
      else if (cleaned[i] === '}') { d--; if (d === 0) { ei = i; break; } }
    }
    const parsed = JSON.parse(cleaned.slice(si, ei + 1)) as Analysis;
    if (!parsed.chartCode && (parsed as any).applicable_chart) parsed.chartCode = (parsed as any).applicable_chart;
    if (!parsed.chartCode && (parsed as any).chart_code) parsed.chartCode = (parsed as any).chart_code;

    // percent 정규화
    if (parsed.ratio?.a && parsed.ratio?.b) {
      parsed.ratio.a.percent = Number(parsed.ratio.a.percent) || 0;
      parsed.ratio.b.percent = Number(parsed.ratio.b.percent) || 0;
      const sum = parsed.ratio.a.percent + parsed.ratio.b.percent;
      if (sum !== 100 && sum > 0) {
        parsed.ratio.a.percent = Math.round((parsed.ratio.a.percent / sum) * 100);
        parsed.ratio.b.percent = 100 - parsed.ratio.a.percent;
      }
    }

    console.log(`  [${((Date.now()-t0)/1000).toFixed(1)}s] ✓ ${parsed.chartCode} ${parsed.ratio?.a?.percent}:${parsed.ratio?.b?.percent}`);
    return parsed;
  } catch (e: any) {
    console.error(`  [${((Date.now()-t0)/1000).toFixed(1)}s] ERROR: ${e.message}`);
    return null;
  }
}

async function main() {
  const { data } = await supabase
    .from('posts')
    .select('id, title, description, analysis')
    .order('created_at', { ascending: false });

  const targets = (data || []).filter((p: any) => !p.analysis?.ratio || !p.analysis?.laws || p.analysis.laws.length === 0);
  console.log(`분석 대상 ${targets.length}개\n`);

  const results: { id: string; analysis: Analysis; newTitle: string }[] = [];
  const failures: string[] = [];

  // 병렬 배치
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    console.log(`━ 배치 ${Math.floor(i / CONCURRENCY) + 1} (${batch.length}건) ━`);
    const out = await Promise.all(batch.map(async (p: any) => {
      console.log(`  → ${p.id.slice(0, 8)} ${p.title?.slice(0, 30)}`);
      const a = await analyze(p.description || '');
      return { post: p, analysis: a };
    }));
    for (const r of out) {
      if (r.analysis) {
        const newTitle = generateTitle(r.analysis.chartCode, r.analysis.summary || '');
        results.push({ id: r.post.id, analysis: r.analysis, newTitle });
      } else {
        failures.push(r.post.id);
      }
    }
  }

  console.log(`\n결과: 성공 ${results.length} / 실패 ${failures.length}`);
  if (failures.length > 0) console.log('실패 ID:', failures.map(f => f.slice(0, 8)).join(', '));

  // SQL 파일 생성
  let sql = `-- 자동 생성: 32개 게시물 재분석 결과 + 문의 게시물 이미지 삭제\n-- 생성 시각: ${new Date().toISOString()}\n\nbegin;\n\n`;

  sql += `-- 1) '교통사고 처벌 문의' 게시물 이미지 삭제\n`;
  sql += `update posts set media_url = null, media_type = null, thumbnail_url = null, photo_urls = null, media_items = null\nwhere id = 'dff2f2ed-3e27-4c37-9924-b0756787882e';\n\n`;

  sql += `-- 2) 재분석 결과 반영 (${results.length}건)\n`;
  for (const r of results) {
    const a = r.analysis;
    sql += `update posts set `;
    sql += `analysis = '${esc(JSON.stringify(a))}'::jsonb, `;
    sql += `fault_ratio_a = ${a.ratio?.a?.percent ?? 50}, `;
    sql += `fault_ratio_b = ${a.ratio?.b?.percent ?? 50}, `;
    sql += `chart_code = ${a.chartCode ? `'${esc(a.chartCode)}'` : 'null'}, `;
    sql += `summary = '${esc(a.summary || '')}', `;
    sql += `title = '${esc(r.newTitle)}' `;
    sql += `where id = '${r.id}';\n`;
  }

  sql += `\ncommit;\n`;
  sql += `-- 실패한 ${failures.length}건: ${failures.join(', ')}\n`;

  fs.writeFileSync(OUT_SQL, sql);
  console.log(`\n✓ SQL 파일 생성: ${OUT_SQL} (${sql.length.toLocaleString()} bytes)`);
  console.log(`  → Supabase SQL Editor 에서 실행하세요`);
}

main().catch(console.error);
