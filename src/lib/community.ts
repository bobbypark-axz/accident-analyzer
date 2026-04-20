import { supabase } from './supabase';
import { generateTitle } from './chart-titles';

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

export interface MediaItem {
  url: string;
  type: 'video' | 'image';
  thumbnail?: string | null;
}

export interface CommunityPost {
  id: string;
  nickname: string;
  analysis: any;
  title: string | null;
  summary: string;
  description: string | null;
  fault_ratio_a: number;
  fault_ratio_b: number;
  chart_code: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  photo_urls: string[] | null;
  media_items: MediaItem[] | null;
  session_token: string | null;
  view_count: number;
  created_at: string;
}

// 구 필드(media_url/photo_urls)와 신 필드(media_items)를 통합해서 단일 배열로 반환
export function getMediaItems(post: Pick<CommunityPost, 'media_items' | 'media_url' | 'media_type' | 'thumbnail_url' | 'photo_urls'>): MediaItem[] {
  if (post.media_items && post.media_items.length > 0) return post.media_items;
  const items: MediaItem[] = [];
  if (post.media_url) {
    items.push({ url: post.media_url, type: (post.media_type === 'video' ? 'video' : 'image'), thumbnail: post.thumbnail_url });
  }
  if (post.photo_urls) {
    for (const u of post.photo_urls) items.push({ url: u, type: 'image', thumbnail: null });
  }
  return items;
}

export async function createPost(data: {
  analysis: any;
  description?: string;
  mediaFile?: File;
  photos?: File[];
  videos?: File[];
  generateThumbnail?: boolean;
}): Promise<CommunityPost | null> {
  if (!supabase) return null;

  let media_url: string | null = null;
  let media_type: string | null = null;
  let thumbnail_url: string | null = null;
  const photo_urls: string[] = [];
  const media_items: MediaItem[] = [];

  const uploadToBucket = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase!.storage
      .from('community-media')
      .upload(filename, file, { contentType: file.type });
    if (error) return null;
    return supabase!.storage.from('community-media').getPublicUrl(filename).data.publicUrl;
  };

  // 메인 미디어 업로드 (구 필드 호환)
  if (data.mediaFile) {
    const url = await uploadToBucket(data.mediaFile);
    if (url) {
      media_url = url;
      media_type = data.mediaFile.type.startsWith('video/') ? 'video' : 'image';
      if (media_type === 'image') thumbnail_url = url;
      media_items.push({ url, type: media_type as 'video' | 'image', thumbnail: media_type === 'image' ? url : null });
    }
  }

  // 추가 영상 업로드 (신 필드 전용)
  if (data.videos && data.videos.length > 0) {
    for (const video of data.videos) {
      const url = await uploadToBucket(video);
      if (url) media_items.push({ url, type: 'video', thumbnail: null });
    }
  }

  // 추가 사진 업로드 (구 필드 + 신 필드 동시)
  if (data.photos && data.photos.length > 0) {
    for (const photo of data.photos) {
      const url = await uploadToBucket(photo);
      if (url) {
        photo_urls.push(url);
        if (!thumbnail_url) thumbnail_url = url;
        media_items.push({ url, type: 'image', thumbnail: url });
      }
    }
  }

  const analysis = data.analysis;

  // AI 사고 이미지 생성 (사용자가 선택한 경우만)
  if (data.generateThumbnail && !thumbnail_url && analysis.summary) {
    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: analysis.summary }),
      });
      if (resp.ok) {
        const { imageBase64 } = await resp.json();
        if (imageBase64) {
          const byteArray = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
          const blob = new Blob([byteArray], { type: 'image/png' });
          const imgFilename = `${crypto.randomUUID()}.png`;
          const uploadResult = await supabase.storage
            .from('community-media')
            .upload(imgFilename, blob, { contentType: 'image/png' });
          if (!uploadResult.error) {
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
      title: generateTitle(analysis.chartCode, analysis.summary || ''),
      summary: analysis.summary || '',
      description: data.description || null,
      fault_ratio_a: analysis.ratio?.a?.percent ?? 50,
      fault_ratio_b: analysis.ratio?.b?.percent ?? 50,
      chart_code: analysis.chartCode || null,
      media_url,
      media_type,
      thumbnail_url,
      photo_urls: photo_urls.length > 0 ? photo_urls : null,
      media_items: media_items.length > 0 ? media_items : null,
      session_token: getSessionToken(),
    })
    .select()
    .single();

  if (error) { console.error('게시물 생성 실패:', error); return null; }
  return post;
}

export async function fetchPosts(page: number = 1, limit: number = 20): Promise<{ posts: (CommunityPost & { like_count: number; comment_count: number })[]; total: number }> {
  if (!supabase) return { posts: [], total: 0 };

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('posts')
    .select('*, likes(count), comments(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) { console.error('게시물 조회 실패:', error); return { posts: [], total: 0 }; }

  const posts = (data || []).map((p: any) => ({
    ...p,
    like_count: p.likes?.[0]?.count || 0,
    comment_count: p.comments?.[0]?.count || 0,
  }));

  return { posts, total: count || 0 };
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

// ── 조회수 ──

export async function incrementViewCount(postId: string): Promise<number> {
  if (!supabase) return 0;

  // 1차: RPC 시도
  const { error: rpcError } = await supabase.rpc('increment_view_count', { p_id: postId });
  if (!rpcError) {
    const { data } = await supabase.from('posts').select('view_count').eq('id', postId).single();
    return data?.view_count || 0;
  }
  console.warn('increment_view_count RPC 실패:', rpcError.message);

  // 2차: 직접 update
  const { data: current } = await supabase.from('posts').select('view_count').eq('id', postId).single();
  const newCount = (current?.view_count || 0) + 1;
  const { error: updateError } = await supabase.from('posts').update({ view_count: newCount }).eq('id', postId);
  if (updateError) {
    console.warn('view_count update 실패 (RLS 문제일 수 있음):', updateError.message);
  }
  return updateError ? (current?.view_count || 0) : newCount;
}

// ── 좋아요 ──

export async function toggleLike(postId: string): Promise<{ liked: boolean; count: number } | null> {
  if (!supabase) return null;
  const token = getSessionToken();

  // RPC 시도
  const { data, error } = await supabase.rpc('toggle_like', { p_id: postId, s_token: token });
  if (!error && data) return data;

  // fallback: 직접 처리
  const { data: existing } = await supabase.from('likes').select('id').eq('post_id', postId).eq('session_token', token).maybeSingle();
  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
  } else {
    await supabase.from('likes').insert({ post_id: postId, session_token: token });
  }
  const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  return { liked: !existing, count: count || 0 };
}

export async function getLikeStatus(postId: string): Promise<{ liked: boolean; count: number }> {
  if (!supabase) return { liked: false, count: 0 };

  const [{ count }, { data: myLike }] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    supabase.from('likes').select('id').eq('post_id', postId).eq('session_token', getSessionToken()).maybeSingle(),
  ]);

  return { liked: !!myLike, count: count || 0 };
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
