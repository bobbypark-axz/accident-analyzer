// 기존 게시물 title을 chartCode 기반 사고 요약 제목으로 일괄 업데이트
// 실행: npm run fix-titles

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { generateTitle } from '../src/lib/chart-titles';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE 환경변수 없음');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, chart_code, summary, title');

  if (error || !posts) {
    console.error('❌ 조회 실패:', error?.message);
    process.exit(1);
  }

  console.log(`📋 대상 게시물 ${posts.length}건\n`);

  let updated = 0;
  let skipped = 0;

  for (const p of posts) {
    const newTitle = generateTitle(p.chart_code, p.summary || '');
    if (newTitle === p.title) {
      skipped++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('posts')
      .update({ title: newTitle })
      .eq('id', p.id);

    if (upErr) {
      console.error(`  ❌ ${p.chart_code}: ${upErr.message}`);
      continue;
    }

    console.log(`  ✅ ${p.chart_code || '-'}: "${p.title}" → "${newTitle}"`);
    updated++;
  }

  console.log(`\n🎉 완료: 업데이트 ${updated}건, 동일 ${skipped}건`);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
