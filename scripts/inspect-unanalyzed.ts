import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

(async () => {
  const { data } = await supabase
    .from('posts')
    .select('id, title, description, analysis, media_url, media_type, media_items')
    .order('created_at', { ascending: false });

  const unanalyzed = (data || []).filter((p: any) => !p.analysis?.ratio || !p.analysis?.laws || p.analysis.laws.length === 0);

  console.log(`분석 안 돌아간 게시물: ${unanalyzed.length}개\n`);

  let textOnly = 0, withVideo = 0, withImage = 0, longText = 0, shortText = 0;
  for (const p of unanalyzed as any[]) {
    const items = p.media_items || [];
    const hasVideo = items.some((m: any) => m.type === 'video') || p.media_type === 'video';
    const hasImage = items.some((m: any) => m.type === 'image') || (p.media_type === 'image' && !hasVideo);
    const len = (p.description || '').length;

    if (hasVideo) withVideo++;
    else if (hasImage) withImage++;
    else textOnly++;

    if (len >= 100) longText++; else shortText++;

    console.log(`  ${p.id.slice(0, 8)}  [${hasVideo ? 'VIDEO' : hasImage ? 'IMAGE' : 'TEXT '}]  desc:${len}자  title: ${(p.title || '').slice(0, 30)}`);
  }
  console.log(`\n분류:`);
  console.log(`  텍스트만: ${textOnly}  |  비디오: ${withVideo}  |  이미지: ${withImage}`);
  console.log(`  설명 100자 이상: ${longText}  |  짧은 것: ${shortText}`);
})();
