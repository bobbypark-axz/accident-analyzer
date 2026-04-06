import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { generateEmbedding } from './lib/embeddings';

import AccidentWizard from './AccidentWizard';
import { searchDocuments } from './lib/supabase';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>
      {name}
    </span>
  );
}

interface AnalysisData {
  summary: string;
  chartCode?: string;
  chartName?: string;
  ratio: { a: { label: string; percent: number }; b: { label: string; percent: number }; reason: string };
  laws: { name: string; content: string; relevance: string; effect: string }[];
  cases: { title: string; facts: string; ruling: string; reason: string }[];
  notes: string[];
  needed: string[];
}

interface FrameData {
  resultImage: string;
  time: number;
  vehicleCount: number;
  personCount: number;
  collisionCount: number;
  laneCount: number;
  rolloverCount: number;
}

interface PredictionResult {
  output?: string;              // 원본 텍스트 (fallback)
  analysis?: AnalysisData;      // 구조화된 분석 결과
  resultImage?: string;
  thumbnail?: string;
  vehicleCount?: number;
  personCount?: number;
  collisionCount?: number;
  laneCount?: number;
  keyFrameTime?: number;
  frames?: FrameData[];
  keyFrameIndex?: number;
}

const FLASK_API = import.meta.env.VITE_FLASK_API || 'http://localhost:5000';


const SYSTEM_PROMPT = `당신은 교통사고 분석 전문가이자 법률 해설가입니다.
사용자의 사고 상황을 분석하여 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 절대 포함하지 마세요.

{
  "summary": "사고 개요를 2~4문장으로 명료하게 정리.",
  "chartCode": "가장 유사한 손보협 도표번호 (아래 목록에서 선택)",
  "chartName": "해당 도표의 사고 유형명",
  "ratio": {
    "a": { "label": "A의 정의", "percent": 70 },
    "b": { "label": "B의 정의", "percent": 30 },
    "reason": "이 비율의 핵심 근거 2~3문장"
  },
  "laws": [
    { "name": "도로교통법 제XX조(조항명)", "content": "조문 요약", "relevance": "관련성", "effect": "법적 효과" }
  ],
  "cases": [
    { "title": "사례 제목", "facts": "사실관계", "ruling": "과실비율", "reason": "판단 근거" }
  ],
  "notes": ["참고사항"],
  "needed": ["필요한 정보"]
}

## 손보협 도표번호 목록 (chartCode에 사용)
- 차1-1: 신호 교차로 직진 vs 직진 (쌍방 신호)
- 차1-2: 신호 교차로 직진 vs 직진 (일방 신호위반)
- 차2-1: 신호 교차로 직진 vs 우회전
- 차2-2: 신호 교차로 우회전 vs 직진
- 차3-1: 신호 교차로 직진 vs 좌회전 (좌회전 신호)
- 차3-2: 신호 교차로 직진 vs 좌회전 (비보호)
- 차4-1: 신호 교차로 좌회전 vs 좌회전
- 차4-2: 신호 교차로 좌회전 vs 유턴
- 차5-1: 교차로 우회전 vs 직진 (보행자 포함)
- 차10-1: 비신호 교차로 직진 vs 직진
- 차11-1: 비신호 교차로 직진 vs 우회전
- 차11-2: 비신호 교차로 우회전 vs 직진
- 차12-1: 비신호 교차로 직진 vs 좌회전 (A좌회전)
- 차13-1: 비신호 교차로 직진 vs 좌회전 (B좌회전)
- 차14-1: 비신호 교차로 우회전 vs 직진
- 차15-1: T자 교차로 직진 vs 진입
- 차16-1: 교차로 직진 vs 좌회전 (비보호)
- 차16-2: 교차로 직진 vs 좌회전 (좌회전 신호)
- 차17-1: 교차로 유턴 vs 직진
- 차20-1: 대향 직진 vs 중앙선 침범
- 차21-1: 동일 방향 차선변경 (동일 차선 내)
- 차31-1: 교행 중 충돌
- 차31-2: 교행 중 충돌 (좁은 도로)
- 차41-1: 직선도로 추돌 (후방 추돌)
- 차42-1: 주정차 차량 추돌
- 차42-2: 갓길 주정차 추돌
- 차42-3: 주정차 후 문 열기
- 차43-1: 동일 방향 진행 중 차선변경 충돌
- 차43-2: 후행 직진 vs 선행 진로변경
- 차43-3: 동시 차선변경
- 차43-4: 끼어들기
- 차44-1: 고속도로 추돌
- 차51-1: 주차장 통로 vs 출차
- 차51-2: 주차장 내 후진 충돌

규칙:
- chartCode는 반드시 위 목록에서 가장 유사한 것을 선택. 정확히 일치하지 않아도 가장 가까운 것 선택.
- 모든 답변은 실제 도로교통법과 판례 기반. 허위 조항 금지.
- laws는 2~5개, cases는 1~3개.
- 정보가 부족해도 가능한 범위에서 분석 먼저 시도.
- ratio.a.percent + ratio.b.percent = 100.
- 한국어. 정중하고 논리적인 전문가 어투.`;

const accidentTemplates = [
  { label: '교차로 사고', icon: 'signpost', text: '[사고 장소] 신호등이 있는 사거리 교차로\n[내 차량] 직진 차로에서 초록불에 직진 중\n[상대 차량] 맞은편에서 비보호 좌회전 시도\n[충돌 부위] 내 차량 우측 앞범퍼 / 상대 차량 좌측 측면' },
  { label: '추돌 사고', icon: 'car_crash', text: '[사고 장소] 편도 3차로 일반도로\n[내 차량] 2차로에서 정상 주행 중\n[상대 차량] 앞에서 갑자기 급정거\n[충돌 부위] 내 차량 앞범퍼 / 상대 차량 뒷범퍼' },
  { label: '차선 변경', icon: 'swap_horiz', text: '[사고 장소] 편도 2차로 도로\n[내 차량] 1차로에서 직진 중\n[상대 차량] 2차로에서 갑자기 1차로로 차선 변경\n[충돌 부위] 내 차량 좌측 측면 / 상대 차량 우측 앞쪽' },
  { label: '주차장 사고', icon: 'local_parking', text: '[사고 장소] 지하 주차장 통로\n[내 차량] 주차 구역에서 후진으로 출차 중\n[상대 차량] 통로에서 직진 주행 중\n[충돌 부위] 내 차량 뒷범퍼 / 상대 차량 측면' },
  { label: '보행자 사고', icon: 'directions_walk', text: '[사고 장소] 횡단보도가 있는 교차로\n[내 차량] 우회전 중\n[보행자] 횡단보도를 건너는 중\n[충돌 부위] 차량 앞범퍼 우측' },
];

const loadingSteps = [
  { icon: 'directions_car', color: '#3182F6', text: '사고 상황 분석 중...' },
  { icon: 'gpp_maybe', color: '#F59E0B', text: '과실 요인 확인 중...' },
  { icon: 'traffic', color: '#F97316', text: '교통 법규 검토 중...' },
  { icon: 'balance', color: '#8B5CF6', text: '과실비율 산출 중...' },
  { icon: 'verified', color: '#06B6D4', text: '결과 정리 중...' },
];

const faqItems = [
  { question: '과실비율 예측은 어떻게 이루어지나요?', answer: 'AI 모델이 입력하신 사고 상황을 분석하여 유사 판례와 보험사 기준을 토대로 예측합니다.' },
  { question: '예측 결과는 법적 효력이 있나요?', answer: '본 서비스의 예측 결과는 참고용이며, 법적 구속력은 없습니다. 정확한 과실비율은 보험사 합의 또는 법원 판결을 통해 최종 결정됩니다.' },
  { question: '어떤 종류의 교통사고를 분석할 수 있나요?', answer: '차대차 사고, 보행자 사고, 이륜차 사고 등 다양한 유형의 교통사고를 분석할 수 있습니다. 사고 상황을 자세히 설명해주시면 더 정확한 예측이 가능합니다.' },
  { question: '개인정보는 안전한가요?', answer: '입력하신 사고 상황 정보는 과실비율 예측에만 사용되며, 별도로 저장되지 않습니다.' },
];

export function App() {
  const [accidentDetails, setAccidentDetails] = useState('');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [useDetailedAnalysis, setUseDetailedAnalysis] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confidence, setConfidence] = useState(40);
  const [copied, setCopied] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);
  const [flaskAvailable, setFlaskAvailable] = useState<boolean | null>(null);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'wizard' | 'text'>('wizard');
  const [structuredData, setStructuredData] = useState<Record<string, string> | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);

  const resultRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAnalysis = useRef<string | null>(null);

  // Flask API 상태 확인
  useEffect(() => {
    fetch(`${FLASK_API}/api/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(() => setFlaskAvailable(true))
      .catch(() => setFlaskAvailable(false));
  }, []);

  // AI 분석 결과 기반 2D 재현도 요청
  // 슬롯 좌표 매핑
  // 위자드 완료 후 자동 분석
  useEffect(() => {
    if (pendingAnalysis.current && accidentDetails === pendingAnalysis.current) {
      pendingAnalysis.current = null;
      handlePredict();
    }
  }, [accidentDetails]);

  // 로딩 애니메이션
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => setLoadingStep(p => (p + 1) % loadingSteps.length), 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (loadingProgress > 0) {
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(0), 500);
      }
      return;
    }
    setLoadingProgress(0);
    const interval = setInterval(() => {
      setLoadingProgress(p => p >= 90 ? p : p + Math.random() * 8);
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleCopy = useCallback(async () => {
    if (!prediction?.output) return;
    try {
      await navigator.clipboard.writeText(prediction.output);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = prediction.output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prediction]);

  const handleSaveImage = useCallback(async () => {
    if (!resultRef.current) return;
    try {
      const canvas = await html2canvas(resultRef.current, { backgroundColor: '#fff', scale: 2, useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `과실비율_분석결과_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { alert('이미지 저장에 실패했습니다.'); }
  }, []);

  // 공유용 카드 이미지 생성
  const generateShareImage = useCallback(async (): Promise<Blob | null> => {
    if (!shareCardRef.current) return null;
    try {
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#fff', scale: 2, useCORS: true, logging: false });
      return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
    } catch { return null; }
  }, []);

  // 링크 복사 (결과 데이터를 URL 해시에 인코딩)
  const handleCopyLink = useCallback(async () => {
    const analysis = prediction?.analysis;
    if (!analysis) return;
    try {
      const shareData = {
        r: { a: analysis.ratio.a, b: analysis.ratio.b },
        s: analysis.summary?.slice(0, 200),
        c: analysis.chartCode,
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
      const url = `${window.location.origin}${window.location.pathname}#result=${encoded}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { alert('링크 복사에 실패했습니다.'); }
  }, [prediction]);

  // 네이티브 공유 (Web Share API)
  const handleNativeShare = useCallback(async () => {
    const analysis = prediction?.analysis;
    if (!analysis) return;
    const text = `🚗 교통사고 과실비율 분석 결과\n\n${analysis.ratio.a.label}: ${analysis.ratio.a.percent}% vs ${analysis.ratio.b.label}: ${analysis.ratio.b.percent}%\n\n${analysis.summary || ''}\n\n⚖️ AI 분석 결과이며 법적 구속력이 없습니다.`;

    // 공유 카드 이미지 생성 시도
    setShowShareCard(true);
    await new Promise(r => setTimeout(r, 100)); // DOM 렌더 대기
    const imageBlob = await generateShareImage();
    setShowShareCard(false);

    const sharePayload: ShareData = { title: '교통사고 과실비율 분석', text };

    if (imageBlob && navigator.canShare?.({ files: [new File([imageBlob], 'result.png', { type: 'image/png' })] })) {
      sharePayload.files = [new File([imageBlob], '과실비율_분석결과.png', { type: 'image/png' })];
    }

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        // Web Share API 미지원 시 텍스트 복사 fallback
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        alert('공유에 실패했습니다.');
      }
    }
  }, [prediction, generateShareImage]);

  // 이미지 저장 개선 — 공유 카드 기반
  const handleSaveShareCard = useCallback(async () => {
    setShowShareCard(true);
    await new Promise(r => setTimeout(r, 100));
    if (!shareCardRef.current) { setShowShareCard(false); return; }
    try {
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#fff', scale: 2, useCORS: true, logging: false });
      const link = document.createElement('a');
      link.download = `과실비율_분석결과_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { alert('이미지 저장에 실패했습니다.'); }
    setShowShareCard(false);
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('이미지 또는 영상 파일만 업로드 가능합니다.');
      return;
    }
    setSelectedFile(file);
  };

  const handlePredict = async () => {
    setIsLoading(true);
    setPrediction(null);
    setError(null);
    setShowFullResult(false);

    try {
      // 상세 분석: Flask API (YOLO + AI)
      if (useDetailedAnalysis && selectedFile) {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('description', accidentDetails);
        fd.append('detailed', 'true');
        fd.append('confidence', String(confidence / 100));

        const r = await fetch(`${FLASK_API}/api/analyze`, { method: 'POST', body: fd });
        const d = await r.json();
        if (d.error) throw new Error(d.error);

        const videoResult = {
          resultImage: d.result_image ? `data:image/jpeg;base64,${d.result_image}` : undefined,
          thumbnail: d.thumbnail ? `data:image/jpeg;base64,${d.thumbnail}` : undefined,
          vehicleCount: d.vehicle_count || 0,
          personCount: d.person_count || 0,
          collisionCount: d.collision_count || 0,
          laneCount: d.lane_count || 0,
          keyFrameTime: d.key_frame_time,
          frames: d.frames?.map((f: any) => ({
            resultImage: f.result_image ? `data:image/jpeg;base64,${f.result_image}` : '',
            time: f.time ?? 0,
            vehicleCount: f.vehicle_count || 0,
            personCount: f.person_count || 0,
            collisionCount: f.collision_count || 0,
            laneCount: f.lane_count || 0,
            rolloverCount: f.rollover_count || 0,
          })) as FrameData[] | undefined,
          keyFrameIndex: d.key_frame_index ?? 0,
        };

        // Flask에서 이미 JSON 형식으로 분석 결과를 받음 (Claude 2차 호출 불필요)
        const scenario = d.scenario || '';
        let videoAnalysis: AnalysisData | undefined;
        try {
          const startIdx = scenario.indexOf('{');
          if (startIdx !== -1) {
            let depth = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < scenario.length; i++) {
              if (scenario[i] === '{') depth++;
              else if (scenario[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
            }
            const parsed = JSON.parse(scenario.slice(startIdx, endIdx + 1));
            if (parsed.summary && parsed.ratio) {
              if (parsed.ratio.a) parsed.ratio.a.percent = Number(parsed.ratio.a.percent) || 50;
              if (parsed.ratio.b) parsed.ratio.b.percent = Number(parsed.ratio.b.percent) || 50;
              videoAnalysis = parsed;
            }
          }
        } catch (e) { console.warn('영상 분석 JSON 파싱 실패:', e); }

        setPrediction({ output: scenario, analysis: videoAnalysis, ...videoResult });
        return;
      }

      // 기본 분석: OpenAI API
      const model = (import.meta.env.VITE_MODEL_TO_USE || 'gpt-4o-mini').trim();
      const maxTokens = useDetailedAnalysis ? 16384 : 4096;

      let documentsContext = '';
      const enableSearch = import.meta.env.VITE_ENABLE_SUPABASE_SEARCH === 'true' &&
        import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (enableSearch) {
        try {
          const queryEmbedding = await Promise.race([
            generateEmbedding(accidentDetails),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
          ]);
          const documents = await searchDocuments(queryEmbedding, 3);
          if (documents.length > 0) {
            documentsContext = '\n\n## 관련 과실비율 기준:\n\n' +
              documents.map((doc: any, i: number) =>
                `${i + 1}. **${doc.title || '기준'}**\n   - ${(doc.content || '').substring(0, 300)}`
              ).join('\n\n');
          }
        } catch { /* skip */ }
      }

      const apiBase = import.meta.env.DEV ? '' : '';
      const response = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `다음 교통사고 상황을 분석하여 과실비율을 예측해주세요:\n\n${accidentDetails}${documentsContext}` },
          ],
          max_completion_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || 'API 요청 실패');
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content || '';

      // JSON 파싱 시도
      let analysis: AnalysisData | undefined;
      try {
        const si = generatedText.indexOf('{');
        if (si !== -1) {
          let d = 0, ei = si;
          for (let i = si; i < generatedText.length; i++) {
            if (generatedText[i] === '{') d++;
            else if (generatedText[i] === '}') { d--; if (d === 0) { ei = i; break; } }
          }
          const parsed = JSON.parse(generatedText.slice(si, ei + 1));
          if (parsed.summary && parsed.ratio) {
            // percent를 숫자로 보장
            if (parsed.ratio.a) parsed.ratio.a.percent = Number(parsed.ratio.a.percent) || 50;
            if (parsed.ratio.b) parsed.ratio.b.percent = Number(parsed.ratio.b.percent) || 50;
            analysis = parsed;
          }
        }
      } catch (e) { console.warn('JSON 파싱 실패:', e, generatedText.substring(0, 200)); }

      setPrediction({ output: generatedText, analysis });


    } catch (err) {
      setError(err instanceof Error ? err.message : '예측 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 과실비율 파싱
  const parseRatio = (text: string) => {
    const m = text.match(/([^=\n]{2,40})\s*[:：]\s*([^=\n]{2,40})\s*[=＝]\s*(\d{1,3})\s*[:：]\s*(\d{1,3})/);
    if (!m) return null;
    const [, labelA, labelB, ratioA, ratioB] = m;
    const a = parseInt(ratioA), b = parseInt(ratioB);
    if (a + b < 10 || a + b > 200) return null;
    return { labelA: labelA.replace(/[*()\[\]]/g, '').trim(), labelB: labelB.replace(/[*()\[\]]/g, '').trim(), a, b };
  };

  const parseSummary = (text: string) => {
    const parts = text.split(/#{1,3}\s*\d*\.?\s*📝\s*사고\s*요약/i);
    if (parts.length > 1) return parts[1].split(/\n#{1,3}\s/)[0].trim().replace(/[*#]/g, '').trim();
    return text.substring(0, 300).split('\n').filter(l => l.trim() && !l.startsWith('#')).join('\n');
  };

  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const canSubmit = useDetailedAnalysis ? !!selectedFile : !!accidentDetails.trim();
  const a = prediction?.analysis;

  // 구조화된 데이터 → 캐러셀 섹션
  const sections = useMemo(() => {
    if (!a) return [];
    const result: { key: string; title: string; icon: string; render: () => React.ReactNode }[] = [];

    if (a.summary) result.push({
      key: 'summary', title: '사고 요약', icon: '📝',
      render: () => <p className="text-[14px] leading-[1.9]" style={{ color: '#4E5968' }}>{a.summary}</p>,
    });

    if (a.ratio) result.push({
      key: 'ratio', title: '과실 판단', icon: '⚖️',
      render: () => (
        <div>
          <p className="text-[14px] leading-[1.9]" style={{ color: '#4E5968' }}>{a.ratio.reason}</p>
        </div>
      ),
    });

    if (a.laws?.length) result.push({
      key: 'laws', title: '적용 법규', icon: '📚',
      render: () => (
        <div className="space-y-4">
          {a.laws.map((law, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <p className="text-[13px] font-bold mb-1.5" style={{ color: '#191F28' }}>{law.name}</p>
              <p className="text-[12px] leading-[1.7] mb-1" style={{ color: '#4E5968' }}><strong>조문:</strong> {law.content}</p>
              <p className="text-[12px] leading-[1.7] mb-1" style={{ color: '#4E5968' }}><strong>관련성:</strong> {law.relevance}</p>
              <p className="text-[12px] leading-[1.7]" style={{ color: '#6B7684' }}><strong>효과:</strong> {law.effect}</p>
            </div>
          ))}
        </div>
      ),
    });

    if (a.cases?.length) result.push({
      key: 'cases', title: '유사 판례', icon: '🔍',
      render: () => (
        <div className="space-y-4">
          {a.cases.map((c, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <p className="text-[13px] font-bold mb-1.5" style={{ color: '#191F28' }}>{c.title}</p>
              <p className="text-[12px] leading-[1.7] mb-1" style={{ color: '#4E5968' }}><strong>사실관계:</strong> {c.facts}</p>
              <p className="text-[12px] leading-[1.7] mb-1" style={{ color: '#4E5968' }}><strong>판단:</strong> {c.ruling}</p>
              <p className="text-[12px] leading-[1.7]" style={{ color: '#6B7684' }}><strong>이유:</strong> {c.reason}</p>
            </div>
          ))}
        </div>
      ),
    });

    if (a.notes?.length) result.push({
      key: 'notes', title: '참고사항', icon: '📌',
      render: () => (
        <ul className="space-y-2">
          {a.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.7]" style={{ color: '#4E5968' }}>
              <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3182F6' }} />
              {n}
            </li>
          ))}
        </ul>
      ),
    });

    if (a.needed?.length) result.push({
      key: 'needed', title: '필요한 정보', icon: '⚠️',
      render: () => (
        <ul className="space-y-2">
          {a.needed.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.7]" style={{ color: '#4E5968' }}>
              <span className="mt-0.5 text-[12px]" style={{ color: '#F97316' }}>{i + 1}.</span>
              {n}
            </li>
          ))}
        </ul>
      ),
    });

    return result;
  }, [a]);

  useEffect(() => { setCarouselIndex(0); setFrameIdx(prediction?.keyFrameIndex ?? 0); }, [prediction?.analysis]);

  const goToSlide = (idx: number) => {
    setCarouselIndex(Math.max(0, Math.min(idx, sections.length - 1)));
  };

  return (
    <main className="min-h-screen" style={{ background: '#F4F4F4' }}>
      {/* 이미지 모달 */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setShowImageModal(null)}>
          <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
          <img src={showImageModal} className="max-w-full max-h-full rounded-2xl" alt="확대" />
        </div>
      )}

      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <header className="pt-6 pb-3 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#3182F6' }}>
              <Icon name="directions_car" className="text-[28px] text-white" filled />
            </div>
            <h1 className="text-[22px] font-bold leading-tight mb-1.5" style={{ color: '#191F28' }}>
              교통사고 과실비율 분석
            </h1>
            <p className="text-[14px]" style={{ color: '#8B95A1' }}>
              <span className="inline-flex items-center gap-0.5" style={{ color: '#3182F6' }}>
                <Icon name="auto_awesome" className="text-sm" filled />AI
              </span>
              가 법규와 판례를 기반으로 분석해드려요
            </p>
          </header>

          {/* 상세 분석 토글 */}
          <div className="bg-white rounded-2xl mb-2 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-5 py-4"
              style={{ background: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}
              onClick={() => !isLoading && setUseDetailedAnalysis(!useDetailedAnalysis)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EEF4FF' }}>
                  <Icon name="videocam" className="text-xl" style={{ color: '#3182F6' }} filled />
                </div>
                <div className="text-left">
                  <div className="text-[15px] font-semibold" style={{ color: '#191F28' }}>영상 분석 모드</div>
                  <div className="text-[13px] mt-0.5" style={{ color: '#8B95A1' }}>
                    {useDetailedAnalysis ? '영상/이미지 + YOLO AI 정밀 분석' : '텍스트만으로 빠른 분석'}
                  </div>
                </div>
              </div>
              <div className="relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300"
                style={{ background: useDetailedAnalysis ? '#3182F6' : '#D1D6DB' }}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${useDetailedAnalysis ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </button>

            {/* Flask 서버 상태 */}
            {useDetailedAnalysis && flaskAvailable === false && (
              <div className="mx-5 mb-4 p-3 rounded-xl flex items-start gap-2" style={{ background: '#FFF0F0' }}>
                <Icon name="error" className="text-base flex-shrink-0 mt-0.5" style={{ color: '#F04452' }} filled />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#F04452' }}>분석 서버 미연결</p>
                  <p className="text-[12px] mt-0.5" style={{ color: '#8B95A1' }}>
                    YOLO 영상 분석을 위해 <code className="bg-gray-100 px-1 rounded">python3 app.py</code>를 실행해주세요
                  </p>
                </div>
              </div>
            )}
            {useDetailedAnalysis && flaskAvailable === true && (
              <div className="mx-5 mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#E8F7F0' }}>
                <Icon name="check_circle" className="text-base" style={{ color: '#00B894' }} filled />
                <p className="text-[13px] font-semibold" style={{ color: '#00B894' }}>분석 서버 연결됨</p>
              </div>
            )}
          </div>

          {/* 영상 업로드 (상세 모드) */}
          {useDetailedAnalysis && (
            <section className="bg-white rounded-2xl p-5 mb-2">
              <label className="text-[15px] font-bold mb-3 block" style={{ color: '#334B63' }}>블랙박스 영상 / 사고 이미지</label>
              <div
                className="border-[1.5px] border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-blue-400"
                style={{ borderColor: '#E5E8EB', background: '#F9FAFB' }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3182F6'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#E5E8EB'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#E5E8EB'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              >
                <Icon name="cloud_upload" className="text-[32px] mb-1 block" style={{ color: '#ADB5BD' }} />
                <p className="text-[13px]" style={{ color: '#8B95A1' }}>드래그하거나 <span style={{ color: '#3182F6', fontWeight: 600 }}>클릭</span>하여 업로드</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#ADB5BD' }}>MP4, AVI, MOV, JPG, PNG</p>
              </div>
              <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

              {selectedFile && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mt-3" style={{ background: '#F7F8F9' }}>
                  <span className="text-lg">{selectedFile.type.startsWith('image/') ? '🖼️' : '🎬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: '#191F28' }}>{selectedFile.name}</p>
                    <p className="text-[11px]" style={{ color: '#ADB5BD' }}>
                      {selectedFile.size < 1048576 ? `${(selectedFile.size / 1024).toFixed(1)} KB` : `${(selectedFile.size / 1048576).toFixed(1)} MB`}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-lg leading-none" style={{ color: '#ADB5BD', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
                </div>
              )}
            </section>
          )}

          {/* 사고 입력: 대화형 위자드 또는 텍스트 */}
          {!prediction && !isLoading && (
            inputMode === 'wizard' ? (
              <section className="mb-2">
                <AccidentWizard
                  onComplete={(desc, structured) => {
                    setStructuredData(structured);
                    setAccidentDetails(desc);
                    // accidentDetails state 업데이트 후 분석 시작을 위해 ref 사용
                    pendingAnalysis.current = desc;
                  }}
                  onSwitchToText={() => setInputMode('text')}
                />
              </section>
            ) : (
              <section className="bg-white rounded-2xl p-5 mb-2">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[15px] font-bold" style={{ color: '#334B63' }}>사고 상황 직접 입력</label>
                  <button onClick={() => setInputMode('wizard')}
                    className="text-[12px] px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                    style={{ color: '#3182F6', background: '#EBF4FF', border: 'none', cursor: 'pointer' }}>
                    <Icon name="quiz" className="text-sm" style={{ color: '#3182F6' }} filled />
                    단계별 입력
                  </button>
                </div>
                {!accidentDetails && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {accidentTemplates.map((t, i) => (
                      <button key={i} type="button" onClick={() => setAccidentDetails(t.text)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap active:scale-[0.96] transition-all"
                        style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        <Icon name={t.icon} className="text-[16px]" style={{ color: '#6B7684' }} />
                        <span className="text-[13px] font-medium" style={{ color: '#4E5968' }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  className="w-full px-4 py-3 rounded-xl min-h-[160px] text-[15px] resize-none transition-all"
                  style={{ background: '#F9FAFB', border: '1.5px solid #E5E8EB', color: '#191F28', outline: 'none' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3182F6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(49,130,246,0.12)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E8EB'; e.currentTarget.style.boxShadow = 'none'; }}
                  placeholder="예시: 신호등이 있는 교차로에서 직진 중이었고, 좌회전 차량과 충돌했습니다..."
                  value={accidentDetails}
                  onChange={e => setAccidentDetails(e.target.value)}
                  disabled={isLoading}
                />
                {accidentDetails.length > 0 && (
                  <div className="flex justify-end mt-1 mb-1">
                    <span className="text-xs" style={{ color: '#ADB5BD' }}>{accidentDetails.length}자</span>
                  </div>
                )}
              </section>
            )
          )}

          {/* 에러 */}
          {error && (
            <section className="rounded-2xl p-4 mb-2 flex items-start gap-3" style={{ background: '#FFF0F0' }}>
              <Icon name="error" className="text-xl flex-shrink-0" style={{ color: '#F04452' }} filled />
              <p className="text-sm pt-0.5" style={{ color: '#F04452' }}>{error}</p>
            </section>
          )}

          {/* 로딩 */}
          {isLoading && (
            <section className="bg-white rounded-2xl p-8 mb-2">
              <div className="flex flex-col items-center justify-center">
                <div className="mb-5" style={{ animation: 'float 2s ease-in-out infinite' }}>
                  <Icon name={loadingSteps[loadingStep].icon} className="text-[48px]" style={{ color: loadingSteps[loadingStep].color }} filled />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-6">{loadingSteps[loadingStep].text}</p>
                <div className="w-full max-w-xs">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(loadingProgress, 100)}%`, background: 'linear-gradient(90deg, #3182F6, #6366F1)' }} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ══════ 분석 결과 ══════ */}
          {prediction?.output && (
            <div ref={resultRef}>

              {/* 0. 사고 시각화 */}
              <section className="mb-3">
                {/* 프레임 슬라이드쇼 (영상 분석) */}
                {prediction.frames && prediction.frames.length > 0 ? (
                  <div className="mb-2">
                    {/* 메인 프레임 뷰 */}
                    <div className="rounded-2xl overflow-hidden cursor-pointer relative"
                      onClick={() => setShowImageModal(prediction.frames![frameIdx].resultImage)}>
                      <img src={prediction.frames![frameIdx].resultImage} alt={`프레임 ${frameIdx}`} className="w-full aspect-video object-cover" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.7))' }} />
                      {/* 프레임 정보 오버레이 */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-end justify-between">
                          <div>
                            {frameIdx === (prediction.keyFrameIndex ?? 0) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/80 text-white mb-1 mr-1">
                                <Icon name="warning" className="text-[10px]" filled />사고 순간
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/20 text-white/90 mb-1">
                              <Icon name="videocam" className="text-[10px]" filled />{prediction.frames![frameIdx].time}초
                            </span>
                            <div className="flex gap-2 mt-1.5">
                              {prediction.frames![frameIdx].vehicleCount > 0 && (
                                <span className="text-[11px] text-white/80 flex items-center gap-0.5">
                                  <Icon name="directions_car" className="text-[11px]" />{prediction.frames![frameIdx].vehicleCount}
                                </span>
                              )}
                              {prediction.frames![frameIdx].personCount > 0 && (
                                <span className="text-[11px] text-white/80 flex items-center gap-0.5">
                                  <Icon name="person" className="text-[11px]" />{prediction.frames![frameIdx].personCount}
                                </span>
                              )}
                              {prediction.frames![frameIdx].collisionCount > 0 && (
                                <span className="text-[11px] text-white/80 flex items-center gap-0.5 text-red-300">
                                  <Icon name="car_crash" className="text-[11px]" />{prediction.frames![frameIdx].collisionCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[12px] font-semibold text-white/60">{frameIdx + 1} / {prediction.frames!.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* 프레임 썸네일 스크롤 */}
                    {prediction.frames!.length > 1 && (
                      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 px-0.5" style={{ scrollbarWidth: 'none' }}>
                        {prediction.frames!.map((f, i) => (
                          <button key={i} onClick={() => setFrameIdx(i)}
                            className="flex-shrink-0 rounded-lg overflow-hidden relative transition-all"
                            style={{
                              width: 64, height: 40, border: i === frameIdx ? '2px solid #3182F6' : '2px solid transparent',
                              opacity: i === frameIdx ? 1 : 0.6, cursor: 'pointer', padding: 0, background: 'none',
                            }}>
                            <img src={f.resultImage} alt="" className="w-full h-full object-cover" />
                            {i === (prediction.keyFrameIndex ?? 0) && (
                              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.3)' }}>
                                <Icon name="warning" className="text-[10px] text-white" filled />
                              </div>
                            )}
                            {f.collisionCount > 0 && i !== (prediction.keyFrameIndex ?? 0) && (
                              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-400 m-0.5" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (prediction.thumbnail || prediction.resultImage) ? (
                  /* 기존 단일 이미지 표시 (fallback) */
                  <div className="rounded-2xl overflow-hidden cursor-pointer relative mb-2"
                    onClick={() => setShowImageModal((prediction.thumbnail || prediction.resultImage)!)}>
                    <img src={(prediction.thumbnail || prediction.resultImage)!} alt="사고 순간" className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.7))' }} />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/20 text-white/90 mb-1">
                          <Icon name="videocam" className="text-[10px]" filled />영상에서 추출
                        </span>
                        <p className="text-[15px] font-bold text-white">사고 순간 포착{prediction.keyFrameTime != null ? ` · ${prediction.keyFrameTime}초` : ''}</p>
                      </div>
                      {prediction.resultImage && prediction.thumbnail && (
                        <button onClick={(e) => { e.stopPropagation(); setShowImageModal(prediction.resultImage!); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg backdrop-blur-sm active:scale-95 transition-all"
                          style={{ background: 'rgba(49,130,246,0.8)', border: 'none', cursor: 'pointer' }}>
                          <Icon name="visibility" className="text-xs text-white" />
                          <span className="text-[11px] font-semibold text-white">감지 결과</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* 손보협 사고 재현 영상 + 도표 */}
                {a?.chartCode && (() => {
                  const videoCode = a.chartCode!.replace('차', 'car');
                  const videoUrl = `https://accident.knia.or.kr/video/${videoCode}.mp4`;
                  const imageUrl = `https://accident.knia.or.kr/images/capture/${a.chartCode}.png`;
                  return (
                    <div className="space-y-2">
                      {/* 영상 */}
                      <div className="rounded-2xl overflow-hidden bg-black">
                        <video
                          className="w-full"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          poster={imageUrl}
                          onError={(e) => {
                            // 영상 없으면 도표 이미지로 대체
                            const el = e.currentTarget;
                            el.style.display = 'none';
                            const img = el.parentElement?.querySelector('.fallback-img') as HTMLElement;
                            if (img) img.style.display = 'block';
                          }}
                        >
                          <source src={videoUrl} type="video/mp4" />
                        </video>
                        <img
                          src={imageUrl}
                          alt={a.chartName || '사고 도표'}
                          className="fallback-img w-full hidden"
                        />
                      </div>
                      {/* 도표 정보 */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#EBF4FF', color: '#3182F6' }}>
                            손보협 {a.chartCode}
                          </span>
                          {a.chartName && <span className="text-[12px]" style={{ color: '#6B7684' }}>{a.chartName}</span>}
                        </div>
                        <button
                          onClick={() => setShowImageModal(imageUrl)}
                          className="text-[11px] px-2 py-1 rounded-lg active:scale-95 transition-all"
                          style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer', color: '#4E5968' }}
                        >
                          도표 보기
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </section>


              {/* 1. 과실비율 히어로 카드 */}
              {a?.ratio ? (
                <section className="mb-3 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)' }}>
                  <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-white/70">예상 과실비율</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 bg-white/15 text-white/80">
                      <Icon name="auto_awesome" className="text-[10px]" filled />AI 분석
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <div className="flex items-end gap-3 mb-4">
                      <span className="text-[48px] font-black text-white leading-none">
                        {a.ratio.a.percent}<span className="text-[20px] text-white/50 mx-1">:</span>{a.ratio.b.percent}
                      </span>
                    </div>
                    <div className="flex rounded-xl overflow-hidden h-3 mb-3 bg-white/10">
                      <div className="transition-all duration-700 rounded-l-xl" style={{ width: `${a.ratio.a.percent}%`, background: '#60A5FA' }} />
                      <div className="transition-all duration-700 rounded-r-xl" style={{ width: `${a.ratio.b.percent}%`, background: '#FB7185' }} />
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
              ) : (
                <section className="bg-white rounded-2xl overflow-hidden mb-3 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EBF4FF' }}>
                      <Icon name="balance" className="text-base" style={{ color: '#3182F6' }} filled />
                    </div>
                    <span className="text-[16px] font-bold" style={{ color: '#191F28' }}>분석 결과</span>
                  </div>
                  <span className="text-[12px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: '#F2EAFA', color: '#7C3AED' }}>
                    <Icon name="auto_awesome" className="text-xs" filled />AI 생성
                  </span>
                </section>
              )}

              {/* 2. 캐러셀 */}
              {sections.length > 0 && (
                <section className="mb-3">
                  {/* 탭 */}
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {sections.map((sec, i) => {
                      const active = carouselIndex === i;
                      const label = sec.title.replace(/^[📝⚖️📚🔍📌⚠️\s]+/, '').substring(0, 8);
                      return (
                        <button key={i} onClick={() => goToSlide(i)}
                          className="px-4 py-2 rounded-full whitespace-nowrap transition-all active:scale-[0.95]"
                          style={{
                            background: active ? '#191F28' : '#fff',
                            color: active ? '#fff' : '#6B7684',
                            border: active ? 'none' : '1.5px solid #E5E8EB',
                            cursor: 'pointer', flexShrink: 0, fontSize: 13, fontWeight: active ? 700 : 500,
                            boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                          }}>
                          {sec.icon} {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 카드 슬라이더 */}
                  <div className="relative"
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      const diff = touchStartX.current - e.changedTouches[0].clientX;
                      if (Math.abs(diff) > 50) goToSlide(carouselIndex + (diff > 0 ? 1 : -1));
                    }}>
                    <div className="overflow-hidden rounded-2xl">
                      <div ref={carouselRef} className="flex transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                        {sections.map((sec, i) => (
                          <div key={i} className="w-full flex-shrink-0 px-0.5">
                            <div className="bg-white rounded-2xl shadow-sm flex flex-col" style={{ height: 380 }}>
                              {/* 카드 헤더 - 고정 */}
                              <div className="px-5 pt-5 pb-3 flex items-center gap-3 flex-shrink-0">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                                  style={{ background: ['#EBF4FF','#FFF0F0','#F0FFF4','#FFF8F0','#F2EAFA','#FFF5E6'][i % 6] }}>
                                  {sec.icon}
                                </div>
                                <div className="flex-1">
                                  <p className="text-[15px] font-bold" style={{ color: '#191F28' }}>
                                    {sec.title.replace(/^[📝⚖️📚🔍📌⚠️\s]+/, '')}
                                  </p>
                                  <p className="text-[11px]" style={{ color: '#ADB5BD' }}>{i + 1} / {sections.length}</p>
                                </div>
                              </div>
                              {/* 카드 바디 - 스크롤 */}
                              <div className="px-5 pb-5 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
                                {sec.render()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* 프로그레스 바 인디케이터 */}
                  <div className="mt-4 px-8">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: '#E5E8EB' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{
                        width: `${((carouselIndex + 1) / sections.length) * 100}%`,
                        background: 'linear-gradient(90deg, #3182F6, #6366F1)',
                      }} />
                    </div>
                  </div>
                </section>
              )}

              {/* 3. 액션 바 */}
              <section className="bg-white rounded-2xl overflow-hidden mb-2">
                {/* 공유 버튼 — 메인 */}
                <div className="p-4 pb-2">
                  <button onClick={handleNativeShare}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl active:scale-[0.97] transition-all"
                    style={{ background: '#3182F6', border: 'none', cursor: 'pointer' }}>
                    <Icon name="share" className="text-[18px]" style={{ color: '#fff' }} />
                    <span className="text-[14px] font-bold" style={{ color: '#fff' }}>분석 결과 공유하기</span>
                  </button>
                </div>
                {/* 보조 액션 */}
                <div className="px-4 pb-2 flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.97] transition-all"
                    style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>
                    <Icon name={copied ? 'check' : 'content_copy'} className="text-[14px]" style={{ color: copied ? '#00B894' : '#6B7684' }} />
                    <span className="text-[12px] font-semibold" style={{ color: copied ? '#00B894' : '#6B7684' }}>{copied ? '복사됨' : '텍스트 복사'}</span>
                  </button>
                  <button onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.97] transition-all"
                    style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>
                    <Icon name={linkCopied ? 'check' : 'link'} className="text-[14px]" style={{ color: linkCopied ? '#00B894' : '#6B7684' }} />
                    <span className="text-[12px] font-semibold" style={{ color: linkCopied ? '#00B894' : '#6B7684' }}>{linkCopied ? '복사됨' : '링크 복사'}</span>
                  </button>
                  <button onClick={handleSaveShareCard}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.97] transition-all"
                    style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>
                    <Icon name="download" className="text-[14px]" style={{ color: '#6B7684' }} />
                    <span className="text-[12px] font-semibold" style={{ color: '#6B7684' }}>이미지 저장</span>
                  </button>
                </div>
                <div className="mx-4 mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#F9FAFB' }}>
                  <Icon name="info" className="text-sm" style={{ color: '#ADB5BD' }} />
                  <p className="text-[11px]" style={{ color: '#ADB5BD' }}>AI 생성 결과이며 법적 구속력이 없습니다</p>
                </div>
              </section>
            </div>
          )}

          {/* FAQ */}
          <section className="mt-6">
            <h2 className="text-[15px] font-bold mb-3 px-2" style={{ color: '#333D4B' }}>자주 묻는 질문</h2>
            <div className="bg-white rounded-2xl overflow-hidden">
              {faqItems.map((item, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: 1, background: '#F2F4F6', margin: '0 20px' }} />}
                  <button className="w-full px-5 py-4 text-left flex justify-between items-center"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => setOpenFAQ(openFAQ === i ? null : i)}>
                    <span className="text-[15px] font-medium" style={{ color: '#333D4B' }}>{item.question}</span>
                    <Icon name="expand_more" className={`text-xl transition-transform duration-300 flex-shrink-0 ml-3 ${openFAQ === i ? 'rotate-180' : ''}`} style={{ color: '#ADB5BD' }} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFAQ === i ? 'max-h-40' : 'max-h-0'}`}>
                    <div className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: '#6B7684' }}>{item.answer}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-8 py-6 text-center">
            <p className="text-[11px]" style={{ color: '#ADB5BD' }}>본 서비스는 참고용으로만 사용되어야 하며, 법적 조언을 대체할 수 없습니다.</p>
          </footer>
          <div className="h-24" />
        </div>
      </div>

      {/* 하단 CTA — 위자드 모드에서는 위자드 안에 버튼이 있으므로 숨김 */}
      {(inputMode === 'text' || prediction || isLoading) && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, padding: '8px 24px max(env(safe-area-inset-bottom), 12px)', maxWidth: 672, margin: '0 auto', background: 'linear-gradient(transparent, #F4F4F4 16px)' }}>
          {prediction ? (
            <button onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setPrediction(null); setError(null); setShowFullResult(false);
              setSelectedFile(null); setAccidentDetails(''); setStructuredData(null);
              setInputMode('wizard');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
              className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              style={{ padding: 15, borderRadius: 14, border: 'none', background: '#3182F6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              <Icon name="refresh" className="text-lg" /> 다시 분석하기
            </button>
          ) : (
            <button onClick={handlePredict} disabled={!canSubmit || isLoading}
              className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              style={{ padding: 15, borderRadius: 14, border: 'none', background: !canSubmit || isLoading ? '#E5E8EB' : '#3182F6', color: !canSubmit || isLoading ? '#ADB5BD' : '#fff', fontSize: 16, fontWeight: 700, cursor: !canSubmit || isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? '분석 중...' : useDetailedAnalysis ? '영상 분석하기' : '과실비율 분석하기'}
            </button>
          )}
        </div>
      )}

      {/* ══════ 공유 카드 (화면에 안 보임, 이미지 생성용) ══════ */}
      {showShareCard && a?.ratio && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div ref={shareCardRef} style={{ width: 480, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* 카드 상단 — 사고 사진 or 도표 */}
            {(prediction?.thumbnail || prediction?.resultImage || a.chartCode) && (
              <div style={{ width: 480, height: 260, overflow: 'hidden', position: 'relative', background: '#1a1a2e' }}>
                <img
                  src={prediction?.thumbnail || prediction?.resultImage || `https://accident.knia.or.kr/images/capture/${a.chartCode}.png`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                  crossOrigin="anonymous"
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.7))' }} />
                <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                      AI 분석
                    </span>
                    {a.chartCode && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                        손보협 {a.chartCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 과실비율 */}
            <div style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)', padding: '24px 24px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>예상 과실비율</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 16 }}>
                {a.ratio.a.percent}<span style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', margin: '0 6px' }}>:</span>{a.ratio.b.percent}
              </div>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 10, background: 'rgba(255,255,255,0.1)', marginBottom: 12 }}>
                <div style={{ width: `${a.ratio.a.percent}%`, background: '#60A5FA', borderRadius: '8px 0 0 8px' }} />
                <div style={{ width: `${a.ratio.b.percent}%`, background: '#FB7185', borderRadius: '0 8px 8px 0' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#60A5FA' }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{a.ratio.a.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{a.ratio.b.label}</span>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FB7185' }} />
                </div>
              </div>
            </div>

            {/* 요약 */}
            {a.summary && (
              <div style={{ padding: '20px 24px', background: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333D4B', marginBottom: 8 }}>사고 요약</div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: '#4E5968', margin: 0 }}>
                  {a.summary.length > 150 ? a.summary.slice(0, 150) + '…' : a.summary}
                </p>
              </div>
            )}

            {/* 푸터 */}
            <div style={{ padding: '12px 24px', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#ADB5BD' }}>AI 생성 결과 · 법적 구속력 없음</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3182F6' }}>교통사고 과실비율 분석</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
