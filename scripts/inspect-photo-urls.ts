import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  const { data } = await supabase
    .from('posts')
    .select('id, title, photo_urls, media_items, media_type')
    .eq('media_type', 'video');

  for (const p of (data || []) as any[]) {
    const photos = p.photo_urls || [];
    if (photos.length === 0) continue;
    console.log(`\n${p.id.slice(0, 8)} ${p.title?.slice(0, 40)}`);
    photos.forEach((url: string, i: number) => {
      const isThumbWebp = url.includes('.thumb.webp');
      const isFmkorea = url.includes('fmkorea');
      const isBobae = url.includes('bobaedream');
      const tag = isThumbWebp ? ' ⚠️ VIDEO-THUMB' : '';
      console.log(`  ${i + 1}. ${isFmkorea ? 'fm' : isBobae ? 'bb' : '??'} ${url.slice(0, 100)}${tag}`);
    });
  }
})();
