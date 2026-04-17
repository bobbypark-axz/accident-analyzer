// chartCode별 사고 유형 요약 제목 매핑
// 예: "차1-2" → "신호위반 직진 충돌 (차1-2)"
// generateTitle()은 클라이언트 createPost, 시드 스크립트, og-preview에서 공통 사용

export const CHART_TITLES: Record<string, string> = {
  // 신호교차로
  '차1-1': '교차로 직진 양측 녹색 충돌',
  '차1-2': '신호위반 직진 충돌',
  '차2-1': '교차로 직진 vs 우회전 충돌',
  '차2-2': '교차로 직진 vs 정상 우회전',
  '차3-1': '좌회전 신호 중 신호위반 직진 충돌',
  '차3-2': '비보호 좌회전 vs 직진 충돌',
  '차4-1': '동시 좌회전 교차 충돌',
  '차4-2': '좌회전 vs 유턴 충돌',
  '차5-1': '우회전 중 횡단보도 보행자 사고',

  // 비신호교차로
  '차10-1': '비신호 교차로 직진 충돌',
  '차11-1': '비신호 교차로 직진 vs 우회전',
  '차11-2': '비신호 교차로 대로 vs 소로 진입',
  '차12-1': '비신호 교차로 직진 vs 좌회전',
  '차13-1': '비신호 교차로 좌회전 vs 직진',
  '차14-1': '비신호 교차로 우회전 vs 좌회전',
  '차15-1': '비신호 교차로 동시 좌회전',
  '차16-1': '유턴 중 직진차 충돌',
  '차16-2': '유턴금지 구간 불법 유턴 사고',
  '차17-1': '비신호 교차로 우회전 후방 추돌',
  '차20-1': 'T자 교차로 직진 vs 좌회전',
  '차21-1': 'T자 교차로 좌회전 vs 직진',

  // 도로 외
  '차31-1': '주차장 진출 vs 본선 직진',
  '차31-2': '주차장 진입 중 후방 추돌',

  // 동일방향
  '차41-1': '전방주시 태만 후행 추돌',
  '차42-1': '선행사고 정차 차량 추돌',
  '차42-2': '급 진로변경 끼어들기 사고',
  '차42-3': '동시 진로변경 교차 충돌',
  '차43-1': '차선변경 중 후방 추돌',
  '차43-2': '도로 후진 중 충돌',
  '차43-3': '회전 후 본선 진입 추돌',
  '차43-4': '유턴 후 진입 중 직진차 추돌',
  '차44-1': '주차장 통로 교차 충돌',

  // 보행자
  '차51-1': '횡단보도 보행자 사고',
  '차51-2': '무단횡단 보행자 사고',
};

/**
 * chartCode + summary 기반으로 제목 생성.
 * chartCode 매핑이 있으면 "○○○ 충돌 (차X-X)" 형태로 리턴.
 * 없으면 summary 첫 문장으로 fallback.
 */
export function generateTitle(chartCode: string | null | undefined, summary: string): string {
  if (chartCode && CHART_TITLES[chartCode]) {
    return `${CHART_TITLES[chartCode]} (${chartCode})`;
  }
  if (!summary) return '사고 분석';
  const match = summary.match(/^(.+?)[.。]/) || summary.match(/^(.+?(?:입니다|습니다|었습니다|됩니다))/);
  if (match && match[1].length <= 35) return match[1];
  const cut = summary.slice(0, 30);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 15 ? cut.slice(0, lastSpace) : cut;
}
