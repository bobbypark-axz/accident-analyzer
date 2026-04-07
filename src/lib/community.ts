import { supabase } from './supabase';

// 익명 닉네임 생성
const ADJECTIVES = ['용감한', '신중한', '침착한', '빠른', '현명한', '든든한', '안전한', '꼼꼼한'];
const NOUNS = ['운전자', '드라이버', '라이더', '탐험가', '여행자', '통근러', '카레이서', '도로왕'];

export function getNickname(): string {
  let nickname = sessionStorage.getItem('community_nickname');
  if (!nickname) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 9000) + 1000;
    nickname = `${adj} ${noun} #${num}`;
    sessionStorage.setItem('community_nickname', nickname);
  }
  return nickname;
}

export function getSessionToken(): string {
  let token = localStorage.getItem('community_session_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('community_session_token', token);
  }
  return token;
}

export interface CommunityPost {
  id: string;
  nickname: string;
  analysis: any;
  title: string | null;
  summary: string;
  fault_ratio_a: number;
  fault_ratio_b: number;
  chart_code: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  session_token: string | null;
  created_at: string;
}

function generateTitle(summary: string): string {
  if (!summary) return '사고 분석';
  const match = summary.match(/^(.+?)[.。]/) || summary.match(/^(.+?(?:입니다|습니다|었습니다|됩니다))/);
  if (match && match[1].length <= 35) return match[1];
  const cut = summary.slice(0, 30);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 15 ? cut.slice(0, lastSpace) : cut;
}

export async function createPost(data: {
  analysis: any;
  mediaFile?: File;
}): Promise<CommunityPost | null> {
  if (!supabase) return null;

  let media_url: string | null = null;
  let media_type: string | null = null;
  let thumbnail_url: string | null = null;

  // 미디어 업로드
  if (data.mediaFile) {
    const ext = data.mediaFile.name.split('.').pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('community-media')
      .upload(filename, data.mediaFile, { contentType: data.mediaFile.type });

    if (!error) {
      const { data: urlData } = supabase.storage.from('community-media').getPublicUrl(filename);
      media_url = urlData.publicUrl;
      media_type = data.mediaFile.type.startsWith('video/') ? 'video' : 'image';
      if (media_type === 'image') thumbnail_url = media_url;
    }
  }

  const analysis = data.analysis;

  // AI 사고 이미지 생성 (썸네일 없을 때)
  if (!thumbnail_url && analysis.summary) {
    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: analysis.summary }),
      });
      if (resp.ok) {
        const { imageBase64 } = await resp.json();
        if (imageBase64) {
          // base64 → blob → Supabase Storage 업로드
          const byteArray = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
          const blob = new Blob([byteArray], { type: 'image/png' });
          const imgFilename = `${crypto.randomUUID()}.png`;
          const uploadResult = await supabase.storage
            .from('community-media')
            .upload(imgFilename, blob, { contentType: 'image/png' });
          const uploadErr = uploadResult.error;
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('community-media').getPublicUrl(imgFilename);
            thumbnail_url = urlData.publicUrl;
          }
        }
      }
    } catch { /* 이미지 생성 실패해도 게시물은 등록 */ }
  }
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      nickname: getNickname(),
      analysis,
      title: generateTitle(analysis.summary || ''),
      summary: analysis.summary || '',
      fault_ratio_a: analysis.ratio?.a?.percent || 50,
      fault_ratio_b: analysis.ratio?.b?.percent || 50,
      chart_code: analysis.chartCode || null,
      media_url,
      media_type,
      thumbnail_url,
      session_token: getSessionToken(),
    })
    .select()
    .single();

  if (error) { console.error('게시물 생성 실패:', error); return null; }
  return post;
}

export async function fetchPosts(page: number = 1, limit: number = 20): Promise<{ posts: CommunityPost[]; total: number }> {
  if (!supabase) return { posts: [], total: 0 };

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) { console.error('게시물 조회 실패:', error); return { posts: [], total: 0 }; }
  return { posts: data || [], total: count || 0 };
}

export async function fetchPost(id: string): Promise<CommunityPost | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

export async function deletePost(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('session_token', getSessionToken());
  return !error;
}

// ── 댓글 ──

export interface Comment {
  id: string;
  post_id: string;
  nickname: string;
  content: string;
  session_token: string | null;
  created_at: string;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) { console.error('댓글 조회 실패:', error); return []; }
  return data || [];
}

export async function createComment(postId: string, content: string): Promise<Comment | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      nickname: getNickname(),
      content,
      session_token: getSessionToken(),
    })
    .select()
    .single();
  if (error) { console.error('댓글 작성 실패:', error); return null; }
  return data;
}

export async function deleteComment(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .eq('session_token', getSessionToken());
  return !error;
}

// 상대 시간 포맷
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return `${Math.floor(day / 30)}달 전`;
}
