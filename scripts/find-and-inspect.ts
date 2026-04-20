import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  // 1) "교통사고 처벌 문의" 게시물 찾기
  console.log('━━ 이미지 삭제 대상 검색 ━━');
  const { data: hits } = await supabase
    .from('posts')
    .select('id, title, description, media_url, thumbnail_url, photo_urls, media_items')
    .ilike('title', '%교통사고 처벌 문의%');
  for (const p of hits || []) {
    console.log(`\n  id: ${p.id}`);
    console.log(`  title: ${p.title}`);
    console.log(`  desc: ${(p.description || '').slice(0, 60)}`);
    console.log(`  media_url: ${p.media_url}`);
    console.log(`  thumbnail_url: ${p.thumbnail_url}`);
    console.log(`  photo_urls: ${p.photo_urls ? (p.photo_urls as any).length + '장' : 'null'}`);
    console.log(`  media_items: ${p.media_items ? JSON.stringify(p.media_items).slice(0, 120) : 'null'}`);
  }

  // 2) 분석 결과가 비어있는 게시물 현황
  console.log('\n━━ 분석 결과 현황 ━━');
  const { data: all } = await supabase
    .from('posts')
    .select('id, title, analysis, fault_ratio_a, fault_ratio_b, chart_code');

  let withRatio = 0, noRatio = 0, withLaws = 0, noLaws = 0, withCases = 0, noCases = 0;
  const samplesNoLaws: { id: string; title: string }[] = [];

  for (const p of (all || []) as any[]) {
    const a = p.analysis || {};
    if (a.ratio) withRatio++; else noRatio++;
    if (a.laws && a.laws.length > 0) withLaws++; else { noLaws++; if (samplesNoLaws.length < 5) samplesNoLaws.push({ id: p.id, title: p.title }); }
    if (a.cases && a.cases.length > 0) withCases++; else noCases++;
  }
  console.log(`\n총 ${all?.length}개 게시물`);
  console.log(`  ratio 있음: ${withRatio} / 없음: ${noRatio}`);
  console.log(`  laws 있음: ${withLaws} / 없음/빈배열: ${noLaws}`);
  console.log(`  cases 있음: ${withCases} / 없음/빈배열: ${noCases}`);
  if (samplesNoLaws.length > 0) {
    console.log(`\n  laws 없는 샘플:`);
    samplesNoLaws.forEach(s => console.log(`    ${s.id.slice(0, 8)}  ${s.title}`));
  }
})();
