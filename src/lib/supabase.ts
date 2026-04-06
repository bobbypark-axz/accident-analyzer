import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function searchLaws(queryEmbedding: number[], limit: number = 5) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('match_laws', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
    });
    if (error) {
      if (error.code === 'PGRST202') return [];
      console.error('법규 검색 오류:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function searchDocuments(queryEmbedding: number[], limit: number = 5) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: limit,
    });
    if (error) {
      if (error.code === 'PGRST202') return [];
      console.error('판례 검색 오류:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}
