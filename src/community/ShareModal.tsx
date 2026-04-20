import { useState, useRef } from 'react';
import { createPost, getNickname } from '../lib/community';
import { trackEvent } from '../lib/analytics';

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
  const [generateImage, setGenerateImage] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const nickname = getNickname();

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setPhotos(prev => [...prev, ...imageFiles].slice(0, 5));
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleAddVideos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    setVideos(prev => [...prev, ...videoFiles].slice(0, 3));
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const removeVideo = (idx: number) => {
    setVideos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleShare = async () => {
    setSharing(true);
    // 메인 미디어: 분석에 사용한 파일 > 첫 번째 추가 영상 > 첫 번째 사진 순
    let uploadFile: File | undefined;
    let extraVideos = videos;
    let extraPhotos = photos;
    if (includeMedia && mediaFile) {
      uploadFile = mediaFile;
    } else if (videos.length > 0) {
      uploadFile = videos[0];
      extraVideos = videos.slice(1);
    } else if (photos.length > 0) {
      uploadFile = photos[0];
      extraPhotos = photos.slice(1);
    }

    const post = await createPost({
      analysis,
      description: description.trim() || undefined,
      mediaFile: uploadFile,
      videos: extraVideos.length > 0 ? extraVideos : undefined,
      photos: extraPhotos.length > 0 ? extraPhotos : undefined,
      generateThumbnail: generateImage && !uploadFile,
    });
    setSharing(false);
    if (post) {
      trackEvent('community_share_complete', { post_id: post.id });
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
        style={{ maxHeight: '80vh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
        onClick={e => e.stopPropagation()}>

        {done ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#ECFDF5' }}>
              <Icon name="check_circle" className="text-[36px]" style={{ color: '#00B894' }} filled />
            </div>
            <p className="text-[17px] font-bold mb-1" style={{ color: '#191F28' }}>게시 완료!</p>
            <p className="text-[13px]" style={{ color: '#8B95A1' }}>커뮤니티에서 다른 분들의 의견을 확인해보세요</p>
          </div>
        ) : (
          <>
            {/* 핸들 */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full" style={{ background: '#E5E8EB' }} />
            </div>

            <h3 className="text-[18px] font-bold mb-1" style={{ color: '#191F28' }}>내 사고 분석 공유하기</h3>
            <p className="text-[13px] mb-4" style={{ color: '#8B95A1' }}>비슷한 경험을 가진 분들과 의견을 나눠보세요</p>

            {/* 미리보기 */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: '#F8FAFC' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1E3A5F, #2563EB)' }}>
                  <Icon name="car_crash" className="text-[14px]" style={{ color: 'rgba(255,255,255,0.8)' }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#191F28' }}>
                    과실비율 {analysis?.ratio?.a?.percent ?? 50} : {analysis?.ratio?.b?.percent ?? 50}
                  </p>
                  <p className="text-[11px]" style={{ color: '#ADB5BD' }}>{nickname}</p>
                </div>
              </div>
              <p className="text-[13px] leading-[1.7]" style={{ color: '#4E5968' }}>
                {analysis?.summary?.slice(0, 100)}{(analysis?.summary?.length || 0) > 100 ? '...' : ''}
              </p>
            </div>

            {/* 한마디 입력 */}
            <div className="mb-4">
              <label className="text-[13px] font-semibold mb-2 block" style={{ color: '#333D4B' }}>
                한마디 남기기 <span style={{ color: '#ADB5BD', fontWeight: 400 }}>(선택)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="예: 보험사에서는 50:50이라는데 억울합니다..."
                maxLength={200}
                className="w-full px-3.5 py-3 rounded-xl text-[13px] resize-none outline-none"
                style={{ background: '#F2F4F6', border: '1.5px solid transparent', color: '#333D4B', minHeight: 72 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3182F6'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#F2F4F6'; }}
              />
              {description.length > 0 && (
                <p className="text-right text-[11px] mt-1" style={{ color: '#ADB5BD' }}>{description.length}/200</p>
              )}
            </div>

            {/* 사진 첨부 */}
            <div className="mb-3">
              <label className="text-[13px] font-semibold mb-2 block" style={{ color: '#333D4B' }}>
                사고 사진 첨부 <span style={{ color: '#ADB5BD', fontWeight: 400 }}>(선택, 최대 5장)</span>
              </label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddPhotos}
                className="hidden"
              />
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden">
                    <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer' }}>
                      <Icon name="close" className="text-[12px]" style={{ color: '#fff' }} />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-20 h-20 flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                    style={{ background: '#F2F4F6', border: '1.5px dashed #D1D5DB', cursor: 'pointer' }}>
                    <Icon name="add_photo_alternate" className="text-[22px]" style={{ color: '#ADB5BD' }} />
                    <span className="text-[10px]" style={{ color: '#ADB5BD' }}>{photos.length}/5</span>
                  </button>
                )}
              </div>
            </div>

            {/* 영상 추가 첨부 */}
            <div className="mb-3">
              <label className="text-[13px] font-semibold mb-2 block" style={{ color: '#333D4B' }}>
                영상 추가 <span style={{ color: '#ADB5BD', fontWeight: 400 }}>(선택, 최대 3개)</span>
              </label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleAddVideos}
                className="hidden"
              />
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {videos.map((video, i) => (
                  <div key={i} className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: '#191F28' }}>
                    <Icon name="play_circle" className="text-[28px]" style={{ color: 'rgba(255,255,255,0.85)' }} filled />
                    <button
                      onClick={() => removeVideo(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer' }}>
                      <Icon name="close" className="text-[12px]" style={{ color: '#fff' }} />
                    </button>
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] font-semibold truncate px-1" style={{ color: '#fff' }}>{video.name}</span>
                  </div>
                ))}
                {videos.length < 3 && (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-20 h-20 flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                    style={{ background: '#F2F4F6', border: '1.5px dashed #D1D5DB', cursor: 'pointer' }}>
                    <Icon name="video_call" className="text-[22px]" style={{ color: '#ADB5BD' }} />
                    <span className="text-[10px]" style={{ color: '#ADB5BD' }}>{videos.length}/3</span>
                  </button>
                )}
              </div>
            </div>

            {/* 분석에 사용된 미디어 첨부 */}
            {mediaFile && (
              <button
                onClick={() => setIncludeMedia(!includeMedia)}
                className="w-full flex items-center gap-3 p-3 rounded-xl mb-3 active:scale-[0.98] transition-all"
                style={{ background: includeMedia ? '#EBF4FF' : '#F2F4F6', border: 'none', cursor: 'pointer' }}
              >
                <Icon name={includeMedia ? 'check_box' : 'check_box_outline_blank'}
                  className="text-[20px]" style={{ color: includeMedia ? '#3182F6' : '#ADB5BD' }} />
                <div className="text-left">
                  <p className="text-[13px] font-semibold" style={{ color: '#333D4B' }}>
                    분석에 사용한 {mediaFile.type.startsWith('video/') ? '영상' : '사진'}도 함께 올리기
                  </p>
                  <p className="text-[11px]" style={{ color: '#8B95A1' }}>{mediaFile.name}</p>
                </div>
              </button>
            )}

            {/* AI 이미지 생성 옵션 — 품질 개선 전까지 숨김 */}

            {/* 안내 */}
            <div className="flex items-start gap-2 mb-5 px-1">
              <Icon name="shield" className="text-[14px] mt-0.5 flex-shrink-0" style={{ color: '#ADB5BD' }} />
              <p className="text-[11px] leading-[1.6]" style={{ color: '#ADB5BD' }}>
                모든 게시물은 익명으로 공유됩니다. 번호판 등 개인정보가 포함된 사진은 주의해주세요.
              </p>
            </div>

            {/* 버튼 */}
            <button onClick={handleShare} disabled={sharing}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl active:scale-[0.97] transition-all"
              style={{ background: sharing ? '#ADB5BD' : '#3182F6', border: 'none', cursor: sharing ? 'not-allowed' : 'pointer' }}>
              {sharing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="edit_note" className="text-[18px]" style={{ color: '#fff' }} />
              )}
              <span className="text-[15px] font-bold" style={{ color: '#fff' }}>
                {sharing ? '게시 중...' : '게시하기'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
