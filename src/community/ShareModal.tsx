import { useState } from 'react';
import { createPost, getNickname } from '../lib/community';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>{name}</span>;
}

interface ShareModalProps {
  analysis: any;
  mediaFile?: File | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareModal({ analysis, mediaFile, onClose, onSuccess }: ShareModalProps) {
  const [sharing, setSharing] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(!!mediaFile);
  const [done, setDone] = useState(false);
  const nickname = getNickname();

  const handleShare = async () => {
    setSharing(true);
    const post = await createPost({
      analysis,
      mediaFile: includeMedia && mediaFile ? mediaFile : undefined,
    });
    setSharing(false);
    if (post) {
      setDone(true);
      setTimeout(() => { onSuccess(); }, 1500);
    } else {
      alert('공유에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
      <div className="relative w-full max-w-xl rounded-t-3xl bg-white p-6"
        style={{ maxHeight: '70vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
        onClick={e => e.stopPropagation()}>

        {done ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#ECFDF5' }}>
              <Icon name="check_circle" className="text-[36px]" style={{ color: '#00B894' }} filled />
            </div>
            <p className="text-[17px] font-bold mb-1" style={{ color: '#191F28' }}>공유 완료!</p>
            <p className="text-[13px]" style={{ color: '#8B95A1' }}>커뮤니티에서 확인할 수 있습니다</p>
          </div>
        ) : (
          <>
            {/* 핸들 */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full" style={{ background: '#E5E8EB' }} />
            </div>

            <h3 className="text-[18px] font-bold mb-4" style={{ color: '#191F28' }}>커뮤니티에 공유</h3>

            {/* 미리보기 */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: '#F8FAFC' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1E3A5F, #2563EB)' }}>
                  <Icon name="car_crash" className="text-[14px]" style={{ color: 'rgba(255,255,255,0.8)' }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#191F28' }}>
                    {analysis?.ratio?.a?.percent || 50} : {analysis?.ratio?.b?.percent || 50}
                  </p>
                  <p className="text-[11px]" style={{ color: '#ADB5BD' }}>{nickname}</p>
                </div>
              </div>
              <p className="text-[13px] leading-[1.7]" style={{ color: '#4E5968' }}>
                {analysis?.summary?.slice(0, 100)}{(analysis?.summary?.length || 0) > 100 ? '...' : ''}
              </p>
            </div>

            {/* 미디어 첨부 */}
            {mediaFile && (
              <button
                onClick={() => setIncludeMedia(!includeMedia)}
                className="w-full flex items-center gap-3 p-3 rounded-xl mb-4 active:scale-[0.98] transition-all"
                style={{ background: includeMedia ? '#EBF4FF' : '#F2F4F6', border: 'none', cursor: 'pointer' }}
              >
                <Icon name={includeMedia ? 'check_box' : 'check_box_outline_blank'}
                  className="text-[20px]" style={{ color: includeMedia ? '#3182F6' : '#ADB5BD' }} />
                <div className="text-left">
                  <p className="text-[13px] font-semibold" style={{ color: '#333D4B' }}>
                    {mediaFile.type.startsWith('video/') ? '영상' : '사진'} 함께 공유
                  </p>
                  <p className="text-[11px]" style={{ color: '#8B95A1' }}>{mediaFile.name}</p>
                </div>
              </button>
            )}

            {/* 안내 */}
            <div className="flex items-start gap-2 mb-5 px-1">
              <Icon name="info" className="text-[14px] mt-0.5 flex-shrink-0" style={{ color: '#ADB5BD' }} />
              <p className="text-[11px] leading-[1.6]" style={{ color: '#ADB5BD' }}>
                익명으로 공유되며 개인정보는 포함되지 않습니다. AI 분석 결과만 공유됩니다.
              </p>
            </div>

            {/* 버튼 */}
            <button onClick={handleShare} disabled={sharing}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl active:scale-[0.97] transition-all"
              style={{ background: sharing ? '#ADB5BD' : '#3182F6', border: 'none', cursor: sharing ? 'not-allowed' : 'pointer' }}>
              {sharing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="send" className="text-[18px]" style={{ color: '#fff' }} />
              )}
              <span className="text-[15px] font-bold" style={{ color: '#fff' }}>
                {sharing ? '공유 중...' : '공유하기'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
