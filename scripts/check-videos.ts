import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  const { data, error } = await supabase
    .from('posts')
    .select('id, nickname, title, media_url, media_type, thumbnail_url, photo_urls, created_at')
    .eq('media_type', 'video')
    .order('created_at', { ascending: false });

  if (error) { console.error('조회 실패:', error); return; }

  console.log(`비디오 게시물 ${(data || []).length}건\n`);

  for (const p of (data || [])) {
    const url = p.media_url || '';
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || '?';
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  id: ${p.id.slice(0, 8)}  |  ${p.nickname}  |  ${p.created_at?.slice(0, 10)}`);
    console.log(`  title: ${p.title || '(no title)'}`);
    console.log(`  ext: .${ext}`);
    console.log(`  url: ${url}`);
    console.log(`  thumb: ${p.thumbnail_url || '(없음)'}`);
    console.log(`  photos: ${p.photo_urls ? p.photo_urls.length + '장' : '0장'}`);

    // HEAD 요청으로 Content-Type / 크기 확인
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`  HTTP: ${res.status}  content-type: ${res.headers.get('content-type')}  size: ${((Number(res.headers.get('content-length')) || 0) / (1024 * 1024)).toFixed(2)}MB`);
    } catch (e: any) {
      console.log(`  HEAD 실패: ${e.message}`);
    }
  }
})();
