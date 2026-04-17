import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, count } = await supabase
    .from('posts')
    .select('id, chart_code, title', { count: 'exact' })
    .order('created_at', { ascending: false });

  const total = count || 0;
  const noChartCode = (data || []).filter((p: any) => !p.chart_code);
  const badTitle = (data || []).filter((p: any) => !p.title || p.title.length < 5 || (!p.title.includes('(차') && p.chart_code));

  console.log(`📊 전체 게시물: ${total}건`);
  console.log(`   chartCode 있음: ${total - noChartCode.length}건`);
  console.log(`   chartCode 없음: ${noChartCode.length}건`);
  console.log(`   타이틀 이상함: ${badTitle.length}건`);

  if (badTitle.length > 0) {
    console.log('\n⚠️  이상한 타이틀 샘플:');
    badTitle.slice(0, 10).forEach((p: any) => {
      console.log(`   [${p.chart_code || '-'}] "${p.title}"`);
    });
  }

  if (noChartCode.length > 0) {
    console.log('\n📌 chartCode 없는 게시물:');
    noChartCode.slice(0, 5).forEach((p: any) => {
      console.log(`   "${p.title}" (id: ${p.id.slice(0, 8)})`);
    });
  }
}

main();
