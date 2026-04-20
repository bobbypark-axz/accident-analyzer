import 'dotenv/config';

const API_BASE = 'https://whosefault-ai.vercel.app';

const SYSTEM_PROMPT = `당신은 교통사고 분석 전문가입니다. 반드시 아래 JSON만 출력하세요.
코드블록(\`\`\`)이나 설명 텍스트 없이 순수 JSON만 출력하세요.
키 이름을 절대 변경하지 마세요.

중요: ratio.a는 반드시 "본인 차량(입력자)"의 과실, ratio.b는 반드시 "상대방 차량"의 과실입니다.

{"summary":"사고 개요 2~3문장","chartCode":"차X-X","chartName":"도표 유형명","ratio":{"a":{"label":"본인 차량 (행동)","percent":30},"b":{"label":"상대 차량 (행동)","percent":70},"reason":"핵심 근거 2~3문장"},"laws":[{"name":"도로교통법 제X조","content":"조문 요약","relevance":"관련성","effect":"법적 효과"}],"cases":[{"title":"사례 제목","facts":"사실관계","ruling":"과실비율","reason":"판단 근거"}],"notes":["참고사항"],"needed":["필요한 정보"]}

규칙: laws 2~3개, cases 1~2개. ratio.a.percent + ratio.b.percent = 100. 한국어. A=본인, B=상대방.`;

(async () => {
  const testDescription = '후방추돌 사고입니다. 편도 2차로 도로에서 신호 대기 중이었는데 뒤에서 들이받았습니다.';

  console.log('테스트 요청...');
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `다음 교통사고 상황을 분석하여 과실비율을 예측해주세요:\n\n${testDescription}` },
      ],
      max_completion_tokens: 3072,
    }),
  });
  console.log('응답 시간:', ((Date.now() - t0) / 1000).toFixed(1), 's, status:', res.status);

  if (!res.ok) {
    console.error('실패:', await res.text());
    return;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log('\n응답 (앞 500자):');
  console.log(text.slice(0, 500));

  // JSON 파싱
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const si = cleaned.indexOf('{');
  if (si === -1) { console.error('JSON 없음'); return; }
  let d = 0, ei = si;
  for (let i = si; i < cleaned.length; i++) {
    if (cleaned[i] === '{') d++;
    else if (cleaned[i] === '}') { d--; if (d === 0) { ei = i; break; } }
  }
  const parsed = JSON.parse(cleaned.slice(si, ei + 1));
  console.log('\n파싱 성공:');
  console.log('  chartCode:', parsed.chartCode);
  console.log('  ratio:', parsed.ratio?.a?.percent, ':', parsed.ratio?.b?.percent);
  console.log('  laws:', parsed.laws?.length);
  console.log('  cases:', parsed.cases?.length);
})();
