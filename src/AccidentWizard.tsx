import { useState } from 'react';

function Icon({ name, className = '', filled = false, style }: { name: string; className?: string; filled?: boolean; style?: React.CSSProperties }) {
  return (
    <span className={`material-symbols-rounded ${filled ? 'icon-filled' : ''} ${className}`} aria-hidden="true" style={style}>
      {name}
    </span>
  );
}

// ─── 질문 단계 정의 ───

interface Option {
  label: string;
  value: string;
  icon?: string;
}

interface Step {
  key: string;
  question: string;
  subtitle?: string;
  options: Option[];
  multiSelect?: boolean;
}

const STEPS: Step[] = [
  {
    key: 'road',
    question: '어디서 사고가 났나요?',
    subtitle: '도로 유형을 선택해주세요',
    options: [
      { label: '교차로', value: '교차로', icon: 'signpost' },
      { label: '직선도로', value: '직선도로', icon: 'straight' },
      { label: '커브길', value: '커브길', icon: 'turn_right' },
      { label: '주차장', value: '주차장', icon: 'local_parking' },
      { label: '골목/이면도로', value: '골목/이면도로', icon: 'holiday_village' },
      { label: '고속도로', value: '고속도로', icon: 'speed' },
    ],
  },
  {
    key: 'signal',
    question: '신호등이 있었나요?',
    subtitle: '사고 당시 신호 상태를 선택해주세요',
    options: [
      { label: '초록 (직진 가능)', value: '초록불 직진 가능', icon: 'traffic' },
      { label: '빨강', value: '빨간불', icon: 'do_not_disturb_on' },
      { label: '노랑', value: '노란불', icon: 'warning' },
      { label: '비보호 좌회전', value: '비보호 좌회전', icon: 'turn_left' },
      { label: '신호등 없음', value: '신호등 없음', icon: 'block' },
      { label: '모르겠음', value: '신호 확인 불가', icon: 'help' },
    ],
  },
  {
    key: 'myVehicle',
    question: '본인 차량은요?',
    subtitle: '차종을 선택해주세요',
    options: [
      { label: '승용차', value: '승용차', icon: 'directions_car' },
      { label: '오토바이', value: '오토바이', icon: 'two_wheeler' },
      { label: 'SUV', value: 'SUV', icon: 'directions_car' },
      { label: '트럭/화물차', value: '트럭', icon: 'local_shipping' },
      { label: '버스', value: '버스', icon: 'directions_bus' },
      { label: '자전거', value: '자전거', icon: 'pedal_bike' },
      { label: '보행자', value: '보행자', icon: 'directions_walk' },
    ],
  },
  {
    key: 'myAction',
    question: '본인은 어떻게 진행 중이었나요?',
    options: [
      { label: '직진', value: '직진', icon: 'arrow_upward' },
      { label: '좌회전', value: '좌회전', icon: 'turn_left' },
      { label: '우회전', value: '우회전', icon: 'turn_right' },
      { label: '유턴', value: '유턴', icon: 'u_turn_left' },
      { label: '차선 변경', value: '차선 변경', icon: 'swap_horiz' },
      { label: '정차/정지', value: '정차 중', icon: 'pause_circle' },
      { label: '후진', value: '후진', icon: 'arrow_downward' },
      { label: '횡단보도 보행', value: '횡단보도 보행 중', icon: 'directions_walk' },
    ],
  },
  {
    key: 'otherVehicle',
    question: '상대방은요?',
    subtitle: '상대 차종을 선택해주세요',
    options: [
      { label: '승용차', value: '승용차', icon: 'directions_car' },
      { label: '오토바이', value: '오토바이', icon: 'two_wheeler' },
      { label: 'SUV', value: 'SUV', icon: 'directions_car' },
      { label: '트럭/화물차', value: '트럭', icon: 'local_shipping' },
      { label: '버스', value: '버스', icon: 'directions_bus' },
      { label: '자전거', value: '자전거', icon: 'pedal_bike' },
      { label: '보행자', value: '보행자', icon: 'directions_walk' },
    ],
  },
  {
    key: 'otherAction',
    question: '상대방은 어떻게 진행 중이었나요?',
    options: [
      { label: '직진', value: '직진', icon: 'arrow_upward' },
      { label: '좌회전', value: '좌회전', icon: 'turn_left' },
      { label: '우회전', value: '우회전', icon: 'turn_right' },
      { label: '차선 변경 (끼어들기)', value: '차선 변경/끼어들기', icon: 'swap_horiz' },
      { label: '급정거', value: '급정거', icon: 'warning' },
      { label: '후진', value: '후진', icon: 'arrow_downward' },
      { label: '신호 위반', value: '신호 위반 진입', icon: 'do_not_disturb_on' },
      { label: '역주행', value: '역주행', icon: 'wrong_location' },
    ],
  },
  {
    key: 'collision',
    question: '어디가 부딪혔나요?',
    subtitle: '내 차량 기준 충돌 부위',
    options: [
      { label: '앞범퍼', value: '앞범퍼', icon: 'arrow_upward' },
      { label: '뒷범퍼', value: '뒷범퍼', icon: 'arrow_downward' },
      { label: '좌측 측면', value: '좌측 측면', icon: 'arrow_back' },
      { label: '우측 측면', value: '우측 측면', icon: 'arrow_forward' },
      { label: '우측 앞', value: '우측 앞모서리', icon: 'north_east' },
      { label: '좌측 앞', value: '좌측 앞모서리', icon: 'north_west' },
      { label: '전면 전체', value: '전면 전체', icon: 'unfold_more' },
      { label: '모르겠음', value: '충돌 부위 불명', icon: 'help' },
    ],
  },
];

// ─── 메인 컴포넌트 ───

interface AccidentWizardProps {
  onComplete: (description: string, structured: Record<string, string>) => void;
  onSwitchToText: () => void;
}

export default function AccidentWizard({ onComplete, onSwitchToText }: AccidentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);

  const step = STEPS[currentStep];
  const totalSteps = STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / (totalSteps + 1)) * 100; // +1 for additional step

  const handleSelect = (value: string) => {
    const newAnswers = { ...answers, [step.key]: value };
    setAnswers(newAnswers);

    if (isLastStep) {
      setShowAdditional(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (showAdditional) {
      setShowAdditional(false);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    // 구조화된 데이터를 자연어 문장으로 변환
    const road = answers.road || '도로';
    const signal = answers.signal || '';
    const myV = answers.myVehicle || '차량';
    const myA = answers.myAction || '주행';
    const otherV = answers.otherVehicle || '차량';
    const otherA = answers.otherAction || '주행';
    const collision = answers.collision || '';

    let desc = `${signal ? signal + ' 상태의 ' : ''}${road}에서 사고가 발생했습니다. `;
    desc += `본인은 ${myV}를 운전하며 ${myA} 중이었고, `;
    desc += `상대방은 ${otherV}로 ${otherA} 중이었습니다. `;
    if (collision) desc += `충돌 부위는 내 차량 ${collision}입니다. `;
    if (additionalInfo.trim()) desc += additionalInfo.trim();

    onComplete(desc, answers);
  };

  // 이전 답변 요약 표시
  const answeredSteps = STEPS.slice(0, currentStep);

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* 프로그레스 바 */}
      <div className="h-1 bg-gray-100">
        <div className="h-full transition-all duration-500 ease-out rounded-r-full" style={{
          width: `${showAdditional ? 100 : progress}%`,
          background: 'linear-gradient(90deg, #3182F6, #6366F1)',
        }} />
      </div>

      {/* 헤더 */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(currentStep > 0 || showAdditional) && (
            <button onClick={handleBack}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all"
              style={{ background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>
              <Icon name="arrow_back" className="text-base" style={{ color: '#4E5968' }} />
            </button>
          )}
          <span className="text-[12px] font-semibold" style={{ color: '#ADB5BD' }}>
            {showAdditional ? '마지막' : `${currentStep + 1} / ${totalSteps}`}
          </span>
        </div>
        <button onClick={onSwitchToText}
          className="text-[12px] px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          style={{ color: '#8B95A1', background: '#F7F8F9', border: 'none', cursor: 'pointer' }}>
          직접 입력하기
        </button>
      </div>

      {/* 이전 답변 요약 (칩) */}
      {answeredSteps.length > 0 && !showAdditional && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {answeredSteps.map((s, i) => (
            <button key={i} onClick={() => setCurrentStep(i)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium active:scale-95 transition-all"
              style={{ background: '#EBF4FF', color: '#3182F6', border: 'none', cursor: 'pointer' }}>
              {answers[s.key]}
              <Icon name="edit" className="text-[10px]" style={{ color: '#3182F6' }} />
            </button>
          ))}
        </div>
      )}

      {/* 추가 정보 입력 */}
      {showAdditional ? (
        <div className="px-5 pt-2 pb-5">
          {/* 선택한 내용 요약 */}
          <div className="mb-4 p-4 rounded-xl" style={{ background: '#F8FAFC' }}>
            <p className="text-[13px] font-semibold mb-2" style={{ color: '#191F28' }}>입력한 사고 정보</p>
            <div className="flex flex-wrap gap-1.5">
              {STEPS.map((s) => (
                answers[s.key] && (
                  <span key={s.key} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium"
                    style={{ background: '#EBF4FF', color: '#3182F6' }}>
                    {answers[s.key]}
                  </span>
                )
              ))}
            </div>
          </div>

          <p className="text-[16px] font-bold mb-1" style={{ color: '#191F28' }}>
            추가로 알려줄 내용이 있나요?
          </p>
          <p className="text-[13px] mb-3" style={{ color: '#8B95A1' }}>
            없으면 바로 분석하기를 눌러주세요
          </p>

          <textarea
            className="w-full px-4 py-3 rounded-xl min-h-[100px] text-[14px] resize-none transition-all"
            style={{ background: '#F9FAFB', border: '1.5px solid #E5E8EB', color: '#191F28', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#3182F6'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E8EB'; }}
            placeholder="예: 블랙박스 영상 있음, 제한속도 60km/h, 비 오는 날이었음..."
            value={additionalInfo}
            onChange={e => setAdditionalInfo(e.target.value)}
          />

          <button onClick={handleSubmit}
            className="w-full mt-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ padding: 15, borderRadius: 14, border: 'none', background: '#3182F6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            <Icon name="auto_awesome" className="text-lg" filled />
            분석하기
          </button>
        </div>
      ) : (
        /* 질문 + 선택지 */
        <div className="px-5 pt-2 pb-5">
          <p className="text-[18px] font-bold mb-1" style={{ color: '#191F28' }}>
            {step.question}
          </p>
          {step.subtitle && (
            <p className="text-[13px] mb-4" style={{ color: '#8B95A1' }}>{step.subtitle}</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {step.options.map((opt) => {
              const selected = answers[step.key] === opt.value;
              return (
                <button key={opt.value} onClick={() => handleSelect(opt.value)}
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-left active:scale-[0.97] transition-all"
                  style={{
                    background: selected ? '#3182F6' : '#F7F8F9',
                    color: selected ? '#fff' : '#333D4B',
                    border: selected ? '2px solid #3182F6' : '2px solid transparent',
                    cursor: 'pointer',
                  }}>
                  {opt.icon && (
                    <Icon name={opt.icon} className="text-lg flex-shrink-0"
                      style={{ color: selected ? '#fff' : '#6B7684' }} filled={selected} />
                  )}
                  <span className="text-[14px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
