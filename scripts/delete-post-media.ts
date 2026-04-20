import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const POST_ID = 'dff2f2ed-3e27-4c37-9924-b0756787882e';

(async () => {
  const { data: before } = await supabase
    .from('posts')
    .select('id, title, media_url, thumbnail_url, photo_urls, media_items, media_type')
    .eq('id', POST_ID)
    .single();

  if (!before) { console.error('게시물 없음'); return; }
  console.log('삭제 전:', { title: before.title, has_media: !!before.media_url, items: (before.media_items as any[] || []).length });

  const { error } = await supabase
    .from('posts')
    .update({
      media_url: null,
      media_type: null,
      thumbnail_url: null,
      photo_urls: null,
      media_items: null,
    })
    .eq('id', POST_ID);

  if (error) { console.error('삭제 실패:', error); return; }

  const { data: after } = await supabase
    .from('posts')
    .select('media_url, media_items')
    .eq('id', POST_ID)
    .single();
  console.log('삭제 후:', after);
  console.log('✓ 이미지 제거 완료 (글·분석은 그대로)');
})();
