import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 카톡·페북·트위터·슬랙·디스코드·검색엔진 크롤러 UA 패턴
const BOT_UA = /facebookexternalhit|facebookcatalog|twitterbot|slackbot|discordbot|linkedinbot|kakaotalk|kakaolink|telegrambot|whatsapp|line-poker|bingbot|googlebot|yandexbot|baiduspider|naverbot|yeti|daumoa|bot\b|crawler|spider|embedly/i;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id as string) || '';
  const uuidMatch = id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'whosefault-ai.vercel.app';
  const origin = `https://${host}`;

  if (!uuidMatch) {
    res.writeHead(302, { Location: `${origin}/` });
    return res.end();
  }
  const postId = uuidMatch[0];
  const fallbackUrl = `${origin}/?post=${postId}`;

  const ua = (req.headers['user-agent'] || '').toString();
  const isBot = BOT_UA.test(ua);

  // 일반 사용자: 바로 SPA로 리다이렉트 (OG 태그 렌더 생략해서 빠르게)
  if (!isBot) {
    res.writeHead(302, { Location: fallbackUrl });
    return res.end();
  }

  // 봇: Supabase에서 게시물 데이터 가져와 OG 태그 포함한 HTML 리턴
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.writeHead(302, { Location: fallbackUrl });
    return res.end();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: post } = await supabase
    .from('posts')
    .select('title, summary, description, thumbnail_url, fault_ratio_a, fault_ratio_b, chart_code')
    .eq('id', postId)
    .single();

  if (!post) {
    res.writeHead(302, { Location: `${origin}/` });
    return res.end();
  }

  const title = post.title || '교통사고 과실비율 분석';
  const ratioStr = `과실비율 ${post.fault_ratio_a}:${post.fault_ratio_b}`;
  const rawDesc = post.description || post.summary || ratioStr;
  const description = `[${ratioStr}] ${rawDesc}`.slice(0, 200);
  const image = post.thumbnail_url || `${origin}/og-image.png?v=4`;

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${esc(title)} | WhoseFault</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="WhoseFault">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(fallbackUrl)}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(fallbackUrl)}">
<link rel="canonical" href="${esc(fallbackUrl)}">
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>
<p><a href="${esc(fallbackUrl)}">분석 결과 보기 →</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Robots-Tag', 'index, follow');
  return res.status(200).send(html);
}
