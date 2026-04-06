import { useRef, useEffect, useState } from 'react';

// ─── 차량 SVG 컴포넌트 ───

function CarSVG({ color = '#3182F6', label = 'A', x = 0, y = 0, angle = 0 }: {
  color?: string; label?: string; x?: number; y?: number; angle?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <rect x="-12" y="-20" width="24" height="40" rx="6" fill={color} stroke="#fff" strokeWidth="1.5" />
      <path d="M-8,-14 L8,-14 L7,-6 L-7,-6 Z" fill="rgba(135,206,250,0.5)" />
      <path d="M-7,8 L7,8 L8,14 L-8,14 Z" fill="rgba(135,206,250,0.4)" />
      <rect x="-14" y="-15" width="3" height="7" rx="1.5" fill="#333" />
      <rect x="11" y="-15" width="3" height="7" rx="1.5" fill="#333" />
      <rect x="-14" y="8" width="3" height="7" rx="1.5" fill="#333" />
      <rect x="11" y="8" width="3" height="7" rx="1.5" fill="#333" />
      <circle cx="-6" cy="-19" r="1.5" fill="rgba(255,255,200,0.8)" />
      <circle cx="6" cy="-19" r="1.5" fill="rgba(255,255,200,0.8)" />
      <text y="32" textAnchor="middle" fill={color} fontSize="11" fontWeight="800">{label}</text>
    </g>
  );
}

function MotorcycleSVG({ color = '#F04452', label = 'B', x = 0, y = 0, angle = 0 }: {
  color?: string; label?: string; x?: number; y?: number; angle?: number;
}) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <ellipse rx="4.5" ry="12" fill={color} stroke="#fff" strokeWidth="1.5" />
      <line x1="-7" y1="-7" x2="7" y2="-7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <ellipse cy="-13" rx="2.5" ry="3.5" fill="#333" stroke="#555" strokeWidth="0.8" />
      <ellipse cy="13" rx="2.5" ry="3.5" fill="#333" stroke="#555" strokeWidth="0.8" />
      <text y="26" textAnchor="middle" fill={color} fontSize="11" fontWeight="800">{label}</text>
    </g>
  );
}

function PersonSVG({ color = '#10B981', label = 'B', x = 0, y = 0 }: {
  color?: string; label?: string; x?: number; y?: number;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="5" cy="-8" fill={color} stroke="#fff" strokeWidth="1.5" />
      <line x1="0" y1="-3" x2="0" y2="6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="-5" y1="1" x2="5" y2="1" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="6" x2="-4" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="6" x2="4" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <text y="26" textAnchor="middle" fill={color} fontSize="11" fontWeight="800">{label}</text>
    </g>
  );
}

function VehicleSVG({ type, ...props }: { type: string; color?: string; label?: string; x?: number; y?: number; angle?: number }) {
  if (type === 'motorcycle' || type === '오토바이') return <MotorcycleSVG {...props} />;
  if (type === 'person' || type === '보행자') return <PersonSVG {...props} />;
  return <CarSVG {...props} />;
}

// ─── 도로 SVG ───

function IntersectionRoad() {
  return (
    <g>
      <rect x="0" y="130" width="400" height="140" fill="#454545" />
      <rect x="130" y="0" width="140" height="400" fill="#454545" />
      {/* 중앙선 */}
      {Array.from({ length: 5 }, (_, i) => <line key={`hc${i}`} x1={20 + i * 30} y1="200" x2={35 + i * 30} y2="200" stroke="#EAB308" strokeWidth="2" opacity="0.6" />)}
      {Array.from({ length: 5 }, (_, i) => <line key={`hc2${i}`} x1={265 + i * 30} y1="200" x2={280 + i * 30} y2="200" stroke="#EAB308" strokeWidth="2" opacity="0.6" />)}
      {Array.from({ length: 5 }, (_, i) => <line key={`vc${i}`} x1="200" y1={20 + i * 30} x2="200" y2={35 + i * 30} stroke="#EAB308" strokeWidth="2" opacity="0.6" />)}
      {Array.from({ length: 5 }, (_, i) => <line key={`vc2${i}`} x1="200" y1={265 + i * 30} x2="200" y2={280 + i * 30} stroke="#EAB308" strokeWidth="2" opacity="0.6" />)}
      {/* 정지선 */}
      <line x1="135" y1="132" x2="195" y2="132" stroke="#fff" strokeWidth="2.5" />
      <line x1="205" y1="268" x2="265" y2="268" stroke="#fff" strokeWidth="2.5" />
      <line x1="132" y1="205" x2="132" y2="265" stroke="#fff" strokeWidth="2.5" />
      <line x1="268" y1="135" x2="268" y2="195" stroke="#fff" strokeWidth="2.5" />
      {/* 가장자리 */}
      <line x1="130" y1="130" x2="0" y2="130" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <line x1="130" y1="270" x2="0" y2="270" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <line x1="270" y1="130" x2="400" y2="130" stroke="#fff" strokeWidth="1" opacity="0.4" />
      <line x1="270" y1="270" x2="400" y2="270" stroke="#fff" strokeWidth="1" opacity="0.4" />
    </g>
  );
}

function StraightRoad() {
  return (
    <g>
      <rect x="0" y="130" width="400" height="140" fill="#454545" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={10 + i * 35} y1="200" x2={25 + i * 35} y2="200" stroke="#EAB308" strokeWidth="2" opacity="0.6" />)}
      <line x1="0" y1="130" x2="400" y2="130" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
      <line x1="0" y1="270" x2="400" y2="270" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
    </g>
  );
}

// ─── 충돌 이펙트 ───

function CollisionEffect({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  if (!visible) return null;
  return (
    <g>
      <circle cx={x} cy={y} r="5" fill="none" stroke="#FF4444" strokeWidth="2.5">
        <animate attributeName="r" values="5;25;5" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="3" fill="none" stroke="#FFAA00" strokeWidth="2">
        <animate attributeName="r" values="3;18;3" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
      </circle>
      <text x={x} y={y + 4} textAnchor="middle" fontSize="16" fontWeight="900" fill="#FF4444">
        <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite" />
        💥
      </text>
    </g>
  );
}

// ─── 애니메이션 차량 ───

interface AnimVehicle {
  type: string;
  label: string;
  color: string;
  path: [number, number][]; // 이동 경로 포인트
  angleAtEnd: number;
}

function AnimatedVehicle({ vehicle, duration, cycle, timeOffset }: {
  vehicle: AnimVehicle; duration: number; cycle: number; timeOffset: number;
}) {
  const [pos, setPos] = useState({ x: vehicle.path[0][0], y: vehicle.path[0][1], angle: 0 });
  const startTime = useRef(Date.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startTime.current = Date.now();
    const animate = () => {
      const elapsed = ((Date.now() - startTime.current) / 1000 - timeOffset);
      const t = Math.max(0, elapsed % cycle);
      const moveTime = Math.min(t / duration, 1);
      // ease-in-out
      const eased = moveTime < 0.5 ? 2 * moveTime * moveTime : 1 - Math.pow(-2 * moveTime + 2, 2) / 2;

      const path = vehicle.path;
      const totalSegments = path.length - 1;
      const rawIdx = eased * totalSegments;
      const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
      const segT = rawIdx - segIdx;

      const x = path[segIdx][0] + (path[segIdx + 1][0] - path[segIdx][0]) * segT;
      const y = path[segIdx][1] + (path[segIdx + 1][1] - path[segIdx][1]) * segT;

      // 이동 방향으로 회전
      let angle = vehicle.angleAtEnd;
      if (segIdx < totalSegments) {
        const dx = path[segIdx + 1][0] - path[segIdx][0];
        const dy = path[segIdx + 1][1] - path[segIdx][1];
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          angle = Math.atan2(dx, -dy) * (180 / Math.PI);
        }
      }

      setPos({ x, y, angle });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [vehicle, duration, cycle, timeOffset]);

  return <VehicleSVG type={vehicle.type} color={vehicle.color} label={vehicle.label} x={pos.x} y={pos.y} angle={pos.angle} />;
}

// ─── 사고 유형 템플릿 정의 ───

interface AccidentTemplate {
  id: string;
  road: 'intersection' | 'straight';
  vehicleA: AnimVehicle;
  vehicleB: AnimVehicle;
  collisionPoint: [number, number];
  collisionDelay: number; // 초
}

function createTemplates(myVehicle: string, otherVehicle: string): Record<string, AccidentTemplate> {
  const aColor = '#3182F6';
  const bColor = '#F04452';
  const aLabel = 'A(본인)';
  const bLabel = 'B(상대)';

  return {
    // ── 교차로 ──
    '교차로_직진_좌회전': {
      id: '교차로_직진_좌회전', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 200]], angleAtEnd: 0 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[380, 235], [270, 235], [200, 235], [175, 200]], angleAtEnd: -90 },
      collisionPoint: [175, 200], collisionDelay: 2,
    },
    '교차로_직진_직진': {
      id: '교차로_직진_직진', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 195]], angleAtEnd: 0 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[380, 235], [270, 235], [195, 235]], angleAtEnd: -90 },
      collisionPoint: [180, 210], collisionDelay: 2,
    },
    '교차로_직진_우회전': {
      id: '교차로_직진_우회전', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 210]], angleAtEnd: 0 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[235, 20], [235, 130], [235, 200], [270, 235]], angleAtEnd: 90 },
      collisionPoint: [210, 220], collisionDelay: 2,
    },
    '교차로_좌회전_직진': {
      id: '교차로_좌회전_직진', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 210], [200, 175]], angleAtEnd: 90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[235, 20], [235, 130], [235, 195]], angleAtEnd: 180 },
      collisionPoint: [210, 190], collisionDelay: 2,
    },
    '교차로_우회전_직진': {
      id: '교차로_우회전_직진', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 230], [135, 235]], angleAtEnd: -90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[20, 165], [130, 165], [165, 165]], angleAtEnd: 90 },
      collisionPoint: [150, 210], collisionDelay: 2,
    },
    '교차로_직진_신호위반': {
      id: '교차로_직진_신호위반', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 260], [165, 195]], angleAtEnd: 0 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[20, 235], [130, 235], [195, 235]], angleAtEnd: 90 },
      collisionPoint: [180, 215], collisionDelay: 2,
    },

    // ── 직선도로 ──
    '직선_직진_급정거': {
      id: '직선_직진_급정거', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [140, 170], [210, 170]], angleAtEnd: 90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[300, 170], [260, 170], [240, 170]], angleAtEnd: 90 },
      collisionPoint: [225, 170], collisionDelay: 2,
    },
    '직선_직진_차선변경': {
      id: '직선_직진_차선변경', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [140, 170], [220, 170]], angleAtEnd: 90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[120, 230], [180, 230], [210, 200], [225, 175]], angleAtEnd: 60 },
      collisionPoint: [222, 175], collisionDelay: 2.2,
    },
    '직선_직진_역주행': {
      id: '직선_직진_역주행', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [140, 170], [200, 170]], angleAtEnd: 90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[380, 170], [300, 170], [230, 170]], angleAtEnd: -90 },
      collisionPoint: [215, 170], collisionDelay: 2,
    },
    '직선_직진_후진': {
      id: '직선_직진_후진', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [140, 170], [200, 170]], angleAtEnd: 90 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[320, 170], [280, 170], [230, 170]], angleAtEnd: 90 },
      collisionPoint: [215, 170], collisionDelay: 2,
    },
    '직선_차선변경_직진': {
      id: '직선_차선변경_직진', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [120, 170], [160, 190], [180, 220]], angleAtEnd: 120 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[80, 230], [160, 230], [190, 230]], angleAtEnd: 90 },
      collisionPoint: [180, 225], collisionDelay: 2.2,
    },

    // ── 보행자 ──
    '교차로_우회전_보행자': {
      id: '교차로_우회전_보행자', road: 'intersection',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[165, 380], [165, 270], [165, 240], [140, 238]], angleAtEnd: -90 },
      vehicleB: { type: 'person', label: bLabel, color: bColor, path: [[110, 280], [120, 270], [135, 250]], angleAtEnd: 0 },
      collisionPoint: [140, 248], collisionDelay: 2.3,
    },
    '직선_직진_보행자': {
      id: '직선_직진_보행자', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[50, 170], [140, 170], [200, 170]], angleAtEnd: 90 },
      vehicleB: { type: 'person', label: bLabel, color: bColor, path: [[210, 130], [210, 155], [210, 170]], angleAtEnd: 0 },
      collisionPoint: [205, 170], collisionDelay: 2,
    },

    // ── 주차장 ──
    '주차장_후진_직진': {
      id: '주차장_후진_직진', road: 'straight',
      vehicleA: { type: myVehicle, label: aLabel, color: aColor, path: [[200, 120], [200, 150], [200, 180]], angleAtEnd: 180 },
      vehicleB: { type: otherVehicle, label: bLabel, color: bColor, path: [[80, 220], [150, 220], [200, 220]], angleAtEnd: 90 },
      collisionPoint: [200, 200], collisionDelay: 2,
    },
  };
}

// ─── 매칭 로직 ───

function matchTemplate(structured: Record<string, string>): string {
  const road = structured.road || '';
  const myAction = structured.myAction || '';
  const otherAction = structured.otherAction || '';
  const otherVehicle = structured.otherVehicle || '';

  // 보행자 사고
  if (otherVehicle === '보행자' || otherVehicle === 'person') {
    if (road.includes('교차로')) return '교차로_우회전_보행자';
    return '직선_직진_보행자';
  }

  // 주차장
  if (road.includes('주차')) return '주차장_후진_직진';

  // 교차로
  if (road.includes('교차로') || road.includes('골목')) {
    if (myAction.includes('직진') && otherAction.includes('좌회전')) return '교차로_직진_좌회전';
    if (myAction.includes('직진') && otherAction.includes('우회전')) return '교차로_직진_우회전';
    if (myAction.includes('좌회전') && otherAction.includes('직진')) return '교차로_좌회전_직진';
    if (myAction.includes('우회전')) return '교차로_우회전_직진';
    if (otherAction.includes('신호')) return '교차로_직진_신호위반';
    return '교차로_직진_직진';
  }

  // 직선도로 / 고속도로 / 커브
  if (otherAction.includes('급정거')) return '직선_직진_급정거';
  if (otherAction.includes('차선') || otherAction.includes('끼어')) return '직선_직진_차선변경';
  if (otherAction.includes('역주행')) return '직선_직진_역주행';
  if (otherAction.includes('후진')) return '직선_직진_후진';
  if (myAction.includes('차선')) return '직선_차선변경_직진';
  if (myAction.includes('후진')) return '주차장_후진_직진';

  return '직선_직진_급정거'; // fallback
}

// ─── 메인 컴포넌트 ───

export default function AccidentAnimation({ structured }: { structured: Record<string, string> }) {
  const templateId = matchTemplate(structured);
  const templates = createTemplates(
    structured.myVehicle || '승용차',
    structured.otherVehicle || '승용차',
  );
  const template = templates[templateId];

  if (!template) return null;

  const duration = 2.5; // 이동 시간
  const cycle = 5; // 전체 사이클 (이동 + 대기)
  const [showCollision, setShowCollision] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = (Date.now() / 1000) % cycle;
      setShowCollision(t > template.collisionDelay);
    }, 100);
    return () => clearInterval(interval);
  }, [template.collisionDelay, cycle]);

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#2D3748' }}>
      <svg viewBox="0 0 400 400" className="w-full">
        {/* 배경 */}
        <rect width="400" height="400" fill="#2D3748" rx="16" />

        {/* 도로 */}
        {template.road === 'intersection' ? <IntersectionRoad /> : <StraightRoad />}

        {/* 이동 경로 (점선) */}
        <polyline
          points={template.vehicleA.path.map(p => p.join(',')).join(' ')}
          fill="none" stroke={template.vehicleA.color} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.3"
        />
        <polyline
          points={template.vehicleB.path.map(p => p.join(',')).join(' ')}
          fill="none" stroke={template.vehicleB.color} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.3"
        />

        {/* 차량 애니메이션 */}
        <AnimatedVehicle vehicle={template.vehicleA} duration={duration} cycle={cycle} timeOffset={0} />
        <AnimatedVehicle vehicle={template.vehicleB} duration={duration} cycle={cycle} timeOffset={0.3} />

        {/* 충돌 이펙트 */}
        <CollisionEffect x={template.collisionPoint[0]} y={template.collisionPoint[1]} visible={showCollision} />

        {/* 범례 */}
        <text x="12" y="390" fill="rgba(255,255,255,0.3)" fontSize="9">사고 재현 애니메이션</text>
      </svg>
    </div>
  );
}
