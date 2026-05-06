import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

// 삭제는 RLS를 우회해야 해서 service_role 키 권장. 없으면 anon으로 폴백.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

const adminPassword = process.env.ADMIN_PASSWORD;

type Action = 'list' | 'delete_post' | 'delete_comment';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ error: '서버에 Supabase 환경 변수가 설정되지 않았습니다.' });
  }
  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: '서버에 ADMIN_PASSWORD가 설정되지 않았습니다.' });
  }

  const { password, action, payload } = (req.body ?? {}) as {
    password?: string;
    action?: Action;
    payload?: { id?: string | number };
  };

  if (password !== adminPassword) {
    return res
      .status(401)
      .json({ error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  try {
    if (action === 'list') {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (postsError) throw postsError;

      const ids = (posts ?? []).map((p: any) => p.id).filter((v) => v != null);
      let comments: any[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .in('post_id', ids)
          .order('created_at', { ascending: true });
        if (error) throw error;
        comments = data ?? [];
      }
      return res.status(200).json({ posts: posts ?? [], comments });
    }

    if (action === 'delete_post') {
      const id = payload?.id;
      if (id == null) {
        return res.status(400).json({ error: 'id가 필요합니다.' });
      }
      // FK가 없을 수 있어 자식부터 직접 정리
      await supabase.from('comments').delete().eq('post_id', id);
      await supabase.from('likes').delete().eq('post_id', id);
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete_comment') {
      const id = payload?.id;
      if (id == null) {
        return res.status(400).json({ error: 'id가 필요합니다.' });
      }
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: '알 수 없는 action 입니다.' });
  } catch (err: any) {
    console.error('admin API 오류:', err);
    return res
      .status(500)
      .json({ error: err?.message || '서버 오류가 발생했습니다.' });
  }
}
