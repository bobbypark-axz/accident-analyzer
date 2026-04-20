import { useState, useEffect, useCallback } from 'react';
import { fetchPosts, fetchPost, timeAgo, toggleLike, getSessionToken, getMediaItems, type CommunityPost } from '../lib/community';
import CommunityDetail from './CommunityDetail';
import { trackEvent } from '../lib/analytics';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>{name}</span>;
}


export default function CommunityPage({ onHideTabBar }: { initialPostId?: string | null; onHideTabBar?: (hide: boolean) => void }) {
  // URL에서 직접 ?post= 파라미터 읽기 (공유 텍스트가 붙을 수 있으므로 UUID만 추출)
  const [deepLinkPostId] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('post');
    if (!raw) return null;
    const match = raw.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match ? match[0] : null;
  });
  const [posts, setPosts] = useState<(CommunityPost & { like_count: number; comment_count: number })[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likesSynced, setLikesSynced] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [deepLinkLoading, setDeepLinkLoading] = useState(!!deepLinkPostId);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // 딥링크: ?post=<id> 로 진입 시 해당 게시물 바로 열기
  useEffect(() => {
    if (!deepLinkPostId) return;
    console.log('[딥링크] 게시물 로드 시도:', deepLinkPostId);
    fetchPost(deepLinkPostId).then(post => {
      console.log('[딥링크] 결과:', post ? '성공' : '실패 (null)');
      if (post) {
        setSelectedPost(post);
      }
      setDeepLinkLoading(false);
    }).catch(err => {
      console.error('[딥링크] 에러:', err);
      setDeepLinkLoading(false);
    });
  }, [deepLinkPostId]);

  useEffect(() => {
    loadPosts();
  }, [page]);

  // 내가 좋아요한 게시물 확인 — 세션당 최초 1회만 동기화해서 사용자의 로컬 토글 상태가 덮이지 않도록 함
  useEffect(() => {
    if (posts.length === 0 || likesSynced) return;
    const token = getSessionToken();
    import('../lib/supabase').then(({ supabase }) => {
      if (!supabase) { setLikesSynced(true); return; }
      supabase.from('likes').select('post_id').eq('session_token', token).then(({ data }) => {
        if (data) {
          setLikedPosts(prev => {
            const next = new Set(prev);
            data.forEach(d => next.add(d.post_id));
            return next;
          });
        }
        setLikesSynced(true);
      });
    });
  }, [posts.length, likesSynced]);

  const loadPosts = async () => {
    setLoading(true);
    const result = await fetchPosts(page);
    setPosts(prev => page === 1 ? result.posts : [...prev, ...result.posts]);
    setTotal(result.total);
    setLoading(false);
  };

  const handleLike = useCallback(async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const result = await toggleLike(postId);
    if (!result) return;
    setLikedPosts(prev => {
      const next = new Set(prev);
      result.liked ? next.add(postId) : next.delete(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: result.count } : p
    ));
  }, []);

  if (deepLinkLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#F4F4F4' }}>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-3" />
        <p className="text-[13px]" style={{ color: '#ADB5BD' }}>게시물 불러오는 중...</p>
      </div>
    );
  }

  if (selectedPost) {
    return <CommunityDetail post={selectedPost} onBack={() => { setSelectedPost(null); setPage(1); loadPosts(); }} onHideTabBar={onHideTabBar} />;
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F4F4F4' }}>
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <header className="pt-6 pb-5">
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Icon name="forum" className="text-[22px]" style={{ color: '#fff' }} filled />
                </div>
                <h1 className="text-[20px] font-bold text-white">커뮤니티</h1>
              </div>
              <p className="text-[13px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                다른 분들의 사고 분석 결과를 확인하고 의견을 나눠보세요
              </p>
            </div>
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
            <div className="space-y-3">
              {posts.map(post => {
                const isLiked = likedPosts.has(post.id);
                return (
                  <div
                    key={post.id}
                    onClick={() => { trackEvent('community_post_click', { post_id: post.id }); setSelectedPost(post); window.scrollTo(0, 0); }}
                    className="w-full text-left bg-white rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                    style={{ cursor: 'pointer' }}
                  >
                    {/* 프로필 헤더 */}
                    <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
                        style={{ background: '#8B95A1' }}>
                        {post.nickname.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: '#191F28' }}>{post.nickname}</p>
                        <p className="text-[11px]" style={{ color: '#ADB5BD' }}>{timeAgo(post.created_at)}</p>
                      </div>
                      {post.chart_code && (
                        <span className="text-[10px] px-2 py-1 rounded-lg font-semibold flex-shrink-0" style={{ background: '#EBF4FF', color: '#3182F6' }}>{post.chart_code}</span>
                      )}
                    </div>

                    {/* 제목 + 본문 + 이미지 */}
                    <div className="px-4 pb-3">
                      {post.title && (
                        <h3 className="text-[16px] font-bold mb-1.5 leading-[1.4]" style={{ color: '#191F28' }}>{post.title}</h3>
                      )}
                      {post.description && (
                        <p className="text-[14px] leading-[1.7] mb-2.5" style={{
                          color: '#4E5968',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>{post.description}</p>
                      )}
                      {(() => {
                        const items = getMediaItems(post);
                        if (!post.thumbnail_url && items.length === 0) return null;
                        const main = items[0];
                        const videoCount = items.filter(m => m.type === 'video').length;
                        const extraCount = items.length - 1;
                        const isVideoMain = main?.type === 'video';
                        return (
                          <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9', borderRadius: 12, border: '1px solid #E5E8EB', background: '#191F28' }}>
                            {isVideoMain ? (
                              <video
                                src={main.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full"
                                style={{ objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                              />
                            ) : (
                              <img src={post.thumbnail_url || main?.thumbnail || main?.url} alt="" className="w-full h-full" style={{ objectFit: 'cover', display: 'block' }} />
                            )}
                            {isVideoMain && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                                  <Icon name="play_arrow" className="text-[32px] ml-0.5" style={{ color: '#fff' }} filled />
                                </div>
                              </div>
                            )}
                            {videoCount > 1 && (
                              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                <Icon name="video_library" className="text-[12px]" style={{ color: '#fff' }} />
                                <span className="text-[11px] font-semibold" style={{ color: '#fff' }}>{videoCount}</span>
                              </div>
                            )}
                            {extraCount > 0 && (
                              <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                <Icon name="photo_library" className="text-[12px]" style={{ color: '#fff' }} />
                                <span className="text-[11px] font-semibold" style={{ color: '#fff' }}>+{extraCount}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 과실비율 */}
                    <div className="px-4 py-3">
                      <div className="rounded-xl p-3" style={{ background: '#F8FAFC' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold" style={{ color: '#8B95A1' }}>예상 과실비율</span>
                          <span className="text-[15px] font-black" style={{ color: '#191F28' }}>
                            {post.fault_ratio_a}<span style={{ color: '#ADB5BD', margin: '0 2px' }}>:</span>{post.fault_ratio_b}
                          </span>
                        </div>
                        <div className="flex rounded-full overflow-hidden h-2.5" style={{ background: '#E5E8EB' }}>
                          <div className="rounded-l-full" style={{ width: `${post.fault_ratio_a}%`, background: '#60A5FA' }} />
                          <div className="rounded-r-full" style={{ width: `${post.fault_ratio_b}%`, background: '#FB7185' }} />
                        </div>
                      </div>
                    </div>

                    {/* 반응 바 */}
                    <div className="px-4 py-3 flex items-center gap-5" style={{ borderTop: '1px solid #F2F4F6' }}>
                      <button
                        onClick={(e) => handleLike(e, post.id)}
                        className="flex items-center gap-1.5 active:scale-90 transition-all"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Icon name="thumb_up" className="text-[18px]" style={{ color: isLiked ? '#3182F6' : '#ADB5BD' }} filled={isLiked} />
                        <span className="text-[12px] font-semibold" style={{ color: isLiked ? '#3182F6' : '#ADB5BD' }}>{post.like_count || 0}</span>
                      </button>
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#ADB5BD' }}>
                        <Icon name="chat_bubble_outline" className="text-[18px]" style={{ color: '#ADB5BD' }} />
                        {post.comment_count || 0}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px]" style={{ color: '#ADB5BD' }}>
                        <Icon name="visibility" className="text-[18px]" style={{ color: '#ADB5BD' }} />
                        {post.view_count || 0}
                      </span>
                      <div className="relative">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/share/${post.id}`;
                            try {
                              await navigator.clipboard.writeText(url);
                            } catch {
                              const ta = document.createElement('textarea');
                              ta.value = url;
                              ta.style.cssText = 'position:fixed;opacity:0';
                              document.body.appendChild(ta);
                              ta.select();
                              document.execCommand('copy');
                              document.body.removeChild(ta);
                            }
                            setCopiedPostId(post.id);
                            setTimeout(() => setCopiedPostId(prev => (prev === post.id ? null : prev)), 2000);
                            trackEvent('community_share', { post_id: post.id });
                          }}
                          className="flex items-center gap-1.5 active:scale-90 transition-all"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <Icon name="share" className="text-[18px]" style={{ color: '#ADB5BD' }} />
                        </button>
                        {copiedPostId === post.id && (
                          <div
                            className="absolute flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg pointer-events-none whitespace-nowrap"
                            style={{
                              bottom: 'calc(100% + 8px)',
                              right: -4,
                              background: 'rgba(25, 31, 40, 0.95)',
                              animation: 'shareToastIn 180ms ease-out',
                            }}
                          >
                            <Icon name="check_circle" className="text-[14px]" style={{ color: '#22C55E' }} filled />
                            <span className="text-[12px] font-semibold" style={{ color: '#fff' }}>링크 복사됨</span>
                            <span
                              aria-hidden
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 10,
                                width: 0,
                                height: 0,
                                borderLeft: '5px solid transparent',
                                borderRight: '5px solid transparent',
                                borderTop: '5px solid rgba(25, 31, 40, 0.95)',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

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

      <style>{`
        @keyframes shareToastIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
