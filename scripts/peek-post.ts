import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  const { data } = await supabase
    .from('posts')
    .select('id, title, chart_code, description, nickname')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('최근 게시물 3건:');
  (data || []).forEach((p: any) => {
    console.log(`\n  id: ${p.id.slice(0,8)}`);
    console.log(`  chart: ${p.chart_code}`);
    console.log(`  title: ${p.title}`);
    console.log(`  desc: ${(p.description || '').slice(0, 60)}...`);
  });
})();
