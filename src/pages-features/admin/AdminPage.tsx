import { useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  deleteComment,
  deletePost,
  fetchCommunity,
  isAdminLoggedIn,
  loginAdmin,
  logoutAdmin,
} from './api/community';
import type { CommunityComment, CommunityPost } from './model/types';
import { PostCard } from './ui/PostCard';

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAdmin(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">관리자 로그인</h1>
        </div>
        <label
          htmlFor="admin-password"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          관리자 비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </main>
  );
}

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(() => isAdminLoggedIn());
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCommunity();
      setPosts(data.posts);
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) {
      void reload();
    }
  }, [authed]);

  const commentsByPostId = useMemo(() => {
    const map = new Map<string, CommunityComment[]>();
    for (const c of comments) {
      const key = String(c.post_id ?? '');
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [comments]);

  const handleDeletePost = async (id: string | number) => {
    if (!confirm(`게시글 #${id} 을(를) 삭제하시겠습니까? 댓글과 좋아요도 함께 삭제됩니다.`)) {
      return;
    }
    try {
      await deletePost(id);
      setPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setComments((prev) =>
        prev.filter((c) => String(c.post_id ?? '') !== String(id)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const handleDeleteComment = async (id: string | number) => {
    if (!confirm(`댓글 #${id} 을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => String(c.id) !== String(id)));
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setAuthed(false);
    setPosts([]);
    setComments([]);
  };

  if (!authed) {
    return <LoginGate onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">커뮤니티 관리</h1>
            <span className="text-sm text-gray-500">
              · 게시글 {posts.length}개
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              새로고침
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && posts.length === 0 && (
          <p className="text-center text-gray-500 py-12">불러오는 중...</p>
        )}

        {!loading && posts.length === 0 && !error && (
          <p className="text-center text-gray-500 py-12">
            게시글이 없습니다.
          </p>
        )}

        {posts.map((post) => (
          <PostCard
            key={String(post.id)}
            post={post}
            comments={commentsByPostId.get(String(post.id)) ?? []}
            onDeletePost={handleDeletePost}
            onDeleteComment={handleDeleteComment}
          />
        ))}
      </div>
    </main>
  );
}
