import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, media_url, media_type, photo_urls, media_items')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  let total = 0, backfilled = 0, empty = 0, videoInItems = 0, photoInItems = 0;
  for (const p of data || []) {
    total++;
    const items = (p as any).media_items;
    if (!items) { empty++; continue; }
    if (Array.isArray(items) && items.length > 0) {
      backfilled++;
      for (const m of items) {
        if (m.type === 'video') videoInItems++;
        if (m.type === 'image') photoInItems++;
      }
    } else {
      empty++;
    }
  }
  console.log(`\n총 ${total}개 게시물`);
  console.log(`  - media_items 채워짐: ${backfilled}`);
  console.log(`  - media_items 비었음(null/[]): ${empty}`);
  console.log(`  - items 안 비디오: ${videoInItems}`);
  console.log(`  - items 안 사진: ${photoInItems}`);

  // 샘플 3건
  console.log(`\n샘플 3건:`);
  for (const p of (data || []).filter(p => (p as any).media_items).slice(0, 3)) {
    console.log(`  ${p.id.slice(0, 8)}: ${JSON.stringify((p as any).media_items).slice(0, 180)}`);
  }
})();
