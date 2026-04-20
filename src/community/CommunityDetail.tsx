import { useState, useEffect, useRef } from 'react';
import { type CommunityPost, type Comment, timeAgo, getSessionToken, deletePost, fetchComments, createComment, deleteComment, incrementViewCount, toggleLike, getLikeStatus, getMediaItems } from '../lib/community';
import { trackEvent } from '../lib/analytics';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>{name}</span>;
}

export default function CommunityDetail({ post, onBack, onHideTabBar }: { post: CommunityPost; onBack: () => void; onHideTabBar?: (hide: boolean) => void }) {
  const a = post.analysis;
  const isOwner = post.session_token === getSessionToken();
  const sessionToken = getSessionToken();

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(post.view_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [sharecopied, setShareCopied] = useState(false);
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
  const [mainPlaying, setMainPlaying] = useState(false);
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchComments(post.id).then(setComments);
    incrementViewCount(post.id).then(count => setViewCount(count));
    getLikeStatus(post.id).then(s => { setLiked(s.liked); setLikeCount(s.count); });
  }, [post.id]);

  // 댓글창 열릴 때 하단 탭바 숨기기
  useEffect(() => {
    onHideTabBar?.(showComments);
    return () => { onHideTabBar?.(false); };
  }, [showComments]);

  const handleToggleLike = async () => {
    const result = await toggleLike(post.id);
    if (result) {
      setLiked(result.liked);
      setLikeCount(result.count);
    }
  };

  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    const comment = await createComment(post.id, text);
    if (comment) {
      trackEvent('comment_submit', { post_id: post.id });
      setComments(prev => [...prev, comment]);
      setCommentText('');
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (id: string) => {
    const ok = await deleteComment(id);
    if (ok) setComments(prev => prev.filter(c => c.id !== id));
  };

  const handleDelete = async () => {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;
    const ok = await deletePost(post.id);
    if (ok) onBack();
    else alert('삭제에 실패했습니다.');
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/${post.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    trackEvent('community_share_copy', { post_id: post.id });
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#F4F4F4' }}>
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <header className="pt-2 pb-4 flex items-center gap-3">
            <button onClick={onBack}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all"
              style={{ background: '#fff', border: 'none', cursor: 'pointer' }}>
              <Icon name="arrow_back" className="text-[20px]" style={{ color: '#333D4B' }} />
            </button>
            <div className="flex-1">
              <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>분석 결과</p>
              <p className="text-[11px]" style={{ color: '#ADB5BD' }}>{post.nickname} · {timeAgo(post.created_at)}</p>
            </div>
            {isOwner && (
              <button onClick={handleDelete}
                className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                style={{ background: '#fff', border: 'none', cursor: 'pointer' }}>
                <Icon name="delete" className="text-[18px]" style={{ color: '#F04452' }} />
              </button>
            )}
          </header>

          {/* 게시물 카드 (글 + 미디어 + 반응) */}
          <section className="bg-white rounded-2xl overflow-hidden mb-3">
            {/* 제목 + 작성자 글 */}
            {(post.title || post.description) && (
              <div className="px-5 pt-4 pb-3">
                {post.title && (
                  <h2 className="text-[18px] font-bold mb-2 leading-[1.4]" style={{ color: '#191F28' }}>{post.title}</h2>
                )}
                {post.description && (
                  <p className="text-[15px] leading-[1.8]" style={{ color: '#4E5968' }}>{post.description}</p>
                )}
              </div>
            )}

            {/* 미디어 캐러셀 — 영상/사진 혼합, 썸네일 클릭 시 메인 스왑 */}
            {(() => {
              const items = getMediaItems(post);
              if (items.length === 0) return null;
              const activeIdx = Math.min(selectedMediaIdx, items.length - 1);
              const main = items[activeIdx];
              return (
                <>
                  <div className="relative w-full overflow-hidden main-player" style={{ aspectRatio: '16 / 9', background: '#000' }}>
                    {main.type === 'video' ? (
                      <>
                        <video
                          key={main.url}
                          ref={mainVideoRef}
                          src={main.url}
                          controls
                          playsInline
                          muted
                          preload="metadata"
                          onPlay={() => setMainPlaying(true)}
                          onPause={() => setMainPlaying(false)}
                          className="absolute inset-0 w-full h-full"
                          style={{ objectFit: 'cover' }}
                        />
                        {!mainPlaying && (
                          <button
                            onClick={() => mainVideoRef.current?.play()}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            aria-label="재생"
                          >
                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                              <Icon name="play_arrow" className="text-[36px] ml-0.5" style={{ color: '#fff' }} filled />
                            </div>
                          </button>
                        )}
                      </>
                    ) : (
                      <img src={main.url} alt="사고 사진" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
                    )}
                  </div>
                  {items.length > 1 && (
                    <div className="px-4 pt-3">
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                        {items.map((item, i) => {
                          if (i === activeIdx) return null;
                          const isVideo = item.type === 'video';
                          return (
                            <button
                              key={i}
                              onClick={() => { setSelectedMediaIdx(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className="relative h-28 w-[156px] rounded-xl overflow-hidden flex-shrink-0 active:scale-95 transition-all"
                              style={{ background: isVideo ? '#191F28' : '#F2F4F6', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              {isVideo ? (
                                <video
                                  src={item.url}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="w-full h-full"
                                  style={{ objectFit: 'cover', pointerEvents: 'none' }}
                                />
                              ) : (
                                <img src={item.url} alt={`사고 사진 ${i + 1}`} className="w-full h-full" style={{ objectFit: 'cover', display: 'block' }} />
                              )}
                              {isVideo && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                                    <Icon name="play_arrow" className="text-[22px] ml-0.5" style={{ color: '#fff' }} filled />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* 반응 바 */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F2F4F6' }}>
              <button onClick={handleToggleLike}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-all"
                style={{ background: liked ? '#EBF4FF' : '#F2F4F6', border: 'none', cursor: 'pointer' }}>
                <Icon name="thumb_up" className="text-[18px]" style={{ color: liked ? '#3182F6' : '#ADB5BD' }} filled={liked} />
                <span className="text-[13px] font-bold" style={{ color: liked ? '#3182F6' : '#6B7684' }}>{likeCount}</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Icon name="visibility" className="text-[16px]" style={{ color: '#ADB5BD' }} />
                  <span className="text-[12px]" style={{ color: '#ADB5BD' }}>{viewCount}</span>
                </div>
                <button onClick={() => setShowComments(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name="chat_bubble_outline" className="text-[16px]" style={{ color: '#ADB5BD' }} />
                  <span className="text-[12px]" style={{ color: '#ADB5BD' }}>{comments.length}</span>
                </button>
                <div className="relative">
                  <button onClick={handleShare}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Icon name="share" className="text-[16px]" style={{ color: '#ADB5BD' }} />
                  </button>
                  {sharecopied && (
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
          </section>

          {/* 과실비율 히어로 */}
          {a?.ratio && (
            <section className="mb-3 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}>
              <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white/70">예상 과실비율</span>
                {a.chartCode && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/15 text-white/80">
                    {a.chartCode}
                  </span>
                )}
              </div>
              <div className="px-5 pb-5">
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-[48px] font-black text-white leading-none">
                    {a.ratio.a.percent}<span className="text-[20px] text-white/50 mx-1">:</span>{a.ratio.b.percent}
                  </span>
                </div>
                <div className="flex rounded-xl overflow-hidden h-3 mb-3 bg-white/10">
                  <div className="rounded-l-xl" style={{ width: `${a.ratio.a.percent}%`, background: '#60A5FA' }} />
                  <div className="rounded-r-xl" style={{ width: `${a.ratio.b.percent}%`, background: '#FB7185' }} />
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#60A5FA' }} />
                    <span className="text-[13px] text-white/80">{a.ratio.a.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-white/80">{a.ratio.b.label}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: '#FB7185' }} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 사고 요약 */}
          {a?.summary && (
            <section className="bg-white rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: '#EBF4FF' }}>📝</div>
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>사고 요약</p>
              </div>
              <p className="text-[15px] leading-[2]" style={{ color: '#4E5968' }}>{a.summary}</p>
            </section>
          )}

          {/* 과실 판단 사유 */}
          {a?.ratio?.reason && (
            <section className="bg-white rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: '#FFF0F0' }}>⚖️</div>
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>과실 판단</p>
              </div>
              <p className="text-[15px] leading-[2]" style={{ color: '#4E5968' }}>{a.ratio.reason}</p>
            </section>
          )}

          {/* 적용 법규 */}
          {a?.laws?.length > 0 && (
            <section className="bg-white rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: '#F0FFF4' }}>📚</div>
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>적용 법규</p>
              </div>
              <div className="space-y-3">
                {a.laws.map((law: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl" style={{ background: '#F8FAFC' }}>
                    <p className="text-[14px] font-bold mb-2" style={{ color: '#191F28' }}>{law.name}</p>
                    <p className="text-[13px] leading-[1.8] mb-1" style={{ color: '#4E5968' }}>{law.content}</p>
                    <p className="text-[13px] leading-[1.8]" style={{ color: '#6B7684' }}><strong style={{ color: '#333D4B' }}>관련성:</strong> {law.relevance}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 유사 판례 */}
          {a?.cases?.length > 0 && (
            <section className="bg-white rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: '#FFF8F0' }}>🔍</div>
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>유사 판례</p>
              </div>
              <div className="space-y-3">
                {a.cases.map((c: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl" style={{ background: '#F8FAFC' }}>
                    <p className="text-[14px] font-bold mb-2" style={{ color: '#191F28' }}>{c.title}</p>
                    <p className="text-[13px] leading-[1.8] mb-1" style={{ color: '#4E5968' }}>{c.facts}</p>
                    <p className="text-[13px] leading-[1.8]" style={{ color: '#6B7684' }}><strong style={{ color: '#333D4B' }}>판단:</strong> {c.ruling}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 참고사항 */}
          {a?.notes?.length > 0 && (
            <section className="bg-white rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm" style={{ background: '#F2EAFA' }}>📌</div>
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>참고사항</p>
              </div>
              <ul className="space-y-2.5">
                {a.notes.map((n: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] leading-[1.9]" style={{ color: '#4E5968' }}>
                    <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3182F6' }} />
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 댓글 미리보기 (유튜브 스타일) */}
          <button
            onClick={() => setShowComments(true)}
            className="w-full text-left bg-white rounded-2xl p-5 mb-3 active:scale-[0.98] transition-all"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>댓글</p>
                <span className="text-[13px] font-semibold" style={{ color: '#3182F6' }}>{comments.length}</span>
              </div>
              <Icon name="expand_more" className="text-[20px]" style={{ color: '#ADB5BD' }} />
            </div>
            {latestComment ? (
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
                  style={{ background: latestComment.session_token === sessionToken ? '#3182F6' : '#8B95A1' }}>
                  {latestComment.nickname.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[12px] font-semibold" style={{ color: '#333D4B' }}>{latestComment.nickname}</span>
                    <span className="text-[11px]" style={{ color: '#ADB5BD' }}>{timeAgo(latestComment.created_at)}</span>
                  </div>
                  <p className="text-[13px] truncate" style={{ color: '#4E5968' }}>{latestComment.content}</p>
                </div>
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: '#ADB5BD' }}>첫 댓글을 남겨보세요</p>
            )}
          </button>

          {/* 면책 */}
          <div className="p-3 rounded-xl flex items-center gap-2 mb-24" style={{ background: '#F9FAFB' }}>
            <Icon name="info" className="text-sm" style={{ color: '#ADB5BD' }} />
            <p className="text-[11px]" style={{ color: '#ADB5BD' }}>AI 생성 결과이며 법적 구속력이 없습니다</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shareToastIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .main-player video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none;
        }
        .main-player video::-webkit-media-controls-overlay-play-button {
          display: none !important;
        }
      `}</style>

      {/* 댓글 바텀시트 */}
      {showComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowComments(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div
            className="relative w-full max-w-xl bg-white rounded-t-3xl flex flex-col"
            style={{ maxHeight: '75vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 시트 헤더 */}
            <div className="px-6 pt-4 pb-3 flex-shrink-0">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full" style={{ background: '#E5E8EB' }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold" style={{ color: '#191F28' }}>댓글 {comments.length}개</p>
                <button onClick={() => setShowComments(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>
                  <Icon name="close" className="text-[18px]" style={{ color: '#6B7684' }} />
                </button>
              </div>
            </div>

            {/* 댓글 목록 (스크롤) */}
            <div className="flex-1 overflow-y-auto px-6 pb-3" style={{ minHeight: 120 }}>
              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                        style={{ background: c.session_token === sessionToken ? '#3182F6' : '#8B95A1' }}>
                        {c.nickname.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[12px] font-semibold" style={{ color: '#333D4B' }}>{c.nickname}</span>
                          <span className="text-[11px]" style={{ color: '#ADB5BD' }}>{timeAgo(c.created_at)}</span>
                          {c.session_token === sessionToken && (
                            <button onClick={() => handleDeleteComment(c.id)}
                              className="ml-auto p-0.5" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Icon name="close" className="text-[14px]" style={{ color: '#ADB5BD' }} />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] leading-[1.7]" style={{ color: '#4E5968' }}>{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10">
                  <Icon name="chat_bubble_outline" className="text-[36px] mb-2" style={{ color: '#E5E8EB' }} />
                  <p className="text-[13px]" style={{ color: '#ADB5BD' }}>아직 댓글이 없습니다</p>
                </div>
              )}
            </div>

            {/* 댓글 입력 (하단 고정) */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3" style={{ borderTop: '1px solid #F2F4F6', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmitComment(); }}
                  placeholder="댓글 추가..."
                  className="flex-1 text-[14px] px-4 py-3 rounded-xl outline-none"
                  style={{ background: '#F2F4F6', border: '1.5px solid transparent', color: '#333D4B' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3182F6'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#F2F4F6'; }}
                  maxLength={300}
                  autoFocus
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  className="px-4 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                  style={{
                    background: commentText.trim() ? '#3182F6' : '#E5E8EB',
                    border: 'none', cursor: commentText.trim() ? 'pointer' : 'default',
                  }}>
                  <Icon name="send" className="text-[18px]" style={{ color: commentText.trim() ? '#fff' : '#ADB5BD' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
