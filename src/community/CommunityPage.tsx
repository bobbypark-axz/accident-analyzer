import { useState, useEffect } from 'react';
import { fetchPosts, timeAgo, type CommunityPost } from '../lib/community';
import CommunityDetail from './CommunityDetail';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>{name}</span>;
}

function getShortTitle(summary?: string): string {
  if (!summary) return '';
  // 첫 문장 추출 (마침표, 쉼표, ~입니다 등으로 끊기)
  const match = summary.match(/^(.+?)[.。]/) || summary.match(/^(.+?(?:입니다|습니다|었습니다|됩니다))/);
  if (match && match[1].length <= 35) return match[1];
  // 없으면 30자 + 자연스러운 끊기
  const cut = summary.slice(0, 30);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 15 ? cut.slice(0, lastSpace) : cut) + '…';
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);

  useEffect(() => {
    loadPosts();
  }, [page]);

  const loadPosts = async () => {
    setLoading(true);
    const result = await fetchPosts(page);
    setPosts(prev => page === 1 ? result.posts : [...prev, ...result.posts]);
    setTotal(result.total);
    setLoading(false);
  };

  if (selectedPost) {
    return <CommunityDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F4F4F4' }}>
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <header className="pt-6 pb-4">
            <h1 className="text-[22px] font-bold mb-1" style={{ color: '#191F28' }}>커뮤니티</h1>
            <p className="text-[14px]" style={{ color: '#8B95A1' }}>다른 사고 분석 결과를 확인해보세요</p>
          </header>

          {/* 피드 */}
          {loading && posts.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-[13px]" style={{ color: '#ADB5BD' }}>불러오는 중...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <Icon name="forum" className="text-[48px] mb-3" style={{ color: '#E5E8EB' }} />
              <p className="text-[15px] font-semibold mb-1" style={{ color: '#6B7684' }}>아직 공유된 분석이 없습니다</p>
              <p className="text-[13px]" style={{ color: '#ADB5BD' }}>첫 번째로 분석 결과를 공유해보세요!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {posts.map(post => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="w-full text-left bg-white rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                  style={{ border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div className="flex">
                    {/* 썸네일 */}
                    {post.thumbnail_url ? (
                      <div className="w-24 h-24 flex-shrink-0 relative">
                        <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        {post.media_type === 'video' && (
                          <div className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            <Icon name="videocam" className="text-[11px]" style={{ color: '#fff' }} />
                            <span className="text-[9px] font-semibold" style={{ color: '#fff' }}>영상</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #1E3A5F, #2563EB)' }}>
                        <Icon name="car_crash" className="text-[28px]" style={{ color: 'rgba(255,255,255,0.5)' }} />
                        {post.media_type === 'video' && (
                          <div className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.4)' }}>
                            <Icon name="videocam" className="text-[11px]" style={{ color: '#fff' }} />
                            <span className="text-[9px] font-semibold" style={{ color: '#fff' }}>영상</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 내용 */}
                    <div className="flex-1 p-3.5 min-w-0">
                      <p className="text-[14px] font-semibold mb-1.5 truncate" style={{ color: '#191F28' }}>
                        {(post as any).title || getShortTitle(post.summary) || '사고 분석'}
                      </p>
                      {/* 과실비율 바 */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 flex rounded-full overflow-hidden h-2" style={{ background: '#E5E8EB' }}>
                          <div style={{ width: `${post.fault_ratio_a}%`, background: '#60A5FA' }} />
                          <div style={{ width: `${post.fault_ratio_b}%`, background: '#FB7185' }} />
                        </div>
                        <span className="text-[12px] font-bold flex-shrink-0" style={{ color: '#4E5968' }}>
                          {post.fault_ratio_a}:{post.fault_ratio_b}
                        </span>
                      </div>
                      {/* 메타 */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: '#ADB5BD' }}>{post.nickname}</span>
                        <span className="text-[11px]" style={{ color: '#D1D5DB' }}>·</span>
                        <span className="text-[11px]" style={{ color: '#ADB5BD' }}>{timeAgo(post.created_at)}</span>
                        {post.chart_code && (
                          <>
                            <span className="text-[11px]" style={{ color: '#D1D5DB' }}>·</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EBF4FF', color: '#3182F6' }}>{post.chart_code}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {/* 더 보기 */}
              {posts.length < total && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.98] transition-all"
                  style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#3182F6' }}
                >
                  {loading ? '불러오는 중...' : '더 보기'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
