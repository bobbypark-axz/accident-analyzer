// 기존 댓글을 모두 지우고 3가지 말투 (디시/펨코/카페아저씨) 섞어 재시딩
// 실행: npm run seed-comments

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE 환경변수 없음');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 톤별 닉네임 풀 ───
const DC_NICK = ['갤러', 'ㅇㅇ(119.xxx)', 'ㅇㅇ(223.xxx)', '차갤러', '운전갤러', 'ㅁㅁ(175.xxx)', '익명', '닉네임123'];
const PEMCO_NICK = ['펨붕이', '차붕이', '불벅', '리겜붕이', '운전붕이', '자갤러', '차갤붕이'];
const CAFE_NICK = ['조심운전 50대', '가장의책임감', '안전운행15년차', '소심한아빠', '베테랑드라이버', '서울김부장', '경기이과장', '신중한운전자', '20년무사고'];

const randName = (pool: string[]) => `${pool[Math.floor(Math.random() * pool.length)]} #${1000 + Math.floor(Math.random() * 9000)}`;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── 톤 1: 디시 (거칠고 짧게, 반말) ───
const DC_공통 = [
  'ㅋㅋㅋ 블박 없이 싸우는거 ㄹㅇ 자살임 이기야',
  '신호위반 박제당한거면 상대 100임 걱정 ㄴㄴ',
  '이런걸로 5:5 우기는 상대 보험사 ㅄ이노',
  '그냥 분쟁심의위 찌르셈 ㄱㄱ',
  '블박 있는데 왜 고민함 ㅋㅋㅋ 그냥 들이받아',
  '과실비율 글 개많네 요즘 ㅋㅋ',
  '이기야 팩트는 블박이 전부다',
  '아이고 ㄷㄷ 크게 안 다쳤으면 다행이지',
  'ㄹㅇ 한국 운전자들 수준 하;;',
  '이거 물면 블박 원본 꼭 들고 가라',
  '합의 서두르는놈이 호구됨 ㅇㅇ',
  '상대 보험사 애들 개소리 걸러듣셈',
  '왜 글 올리는지 앎? 여기서 물어봐도 걍 보험사 찌르는게 답이야',
  '진짜 이런거 매번 봐도 한심함 ㅋㅋ',
  '블박 2채널 필수 이기야 ㄹㅇ',
  '우겨봤자 블박 이기는 방법 없음 ㅇㅇ',
];
const DC_신호 = [
  '신호위반 팩트체크 가능하면 100:0 박제 ㄱㄱ',
  '교차로 CCTV 떼오셈 무조건 이김',
  '양쪽 초록이면 선진입 입증 게임 ㅇㅇ 블박각 잘 잡아라',
];
const DC_추돌 = [
  '뒤에서 박으면 무조건 100 이기야 끝',
  '추돌은 그냥 ㅈㅂ하고 보험 올리셈',
  '급브레이크 잡혔으면 좀 빠지긴 함 ㅇㅇ',
  '추돌 피해자면 렌트비 꼭 챙겨 이기야',
];
const DC_차로 = [
  '깜빡이 안 키고 들어오는놈들 ㄹㅇ 다 신고해야됨',
  '실선구간이면 상대 과실 확정임',
  '2채널 블박이면 이 게임 이김 ㄱㄱ',
];
const DC_보행자 = [
  '12대중과실 ㄷㄷ 형사합의 돈 많이 깨짐',
  '보행자 사고는 걍 답없음 ㅠㅠ',
  '무단횡단이면 그나마 빠지는데 그래도 운전자 과실 큼 ㅇㅇ',
];
const DC_유턴 = [
  '유턴 금지구간 유턴은 100 각 ㅋㅋ',
  '유턴 표지 없으면 중앙선침범 ㅇㅇ 끝임',
];
const DC_주차장 = [
  '주차장은 5:5 기본 ㅇㅇ 싸우지마셈',
  'CCTV 관리사무소 가서 떼오셈',
];
const DC_좌회전 = [
  '좌회전이 기본 과실 더 큼 팩트',
  '비보호 좌회전하다 사고났으면 그냥 납득해라 ㅇㅇ',
];
const DC_우회전 = [
  '우회전 일시정지 의무 강화된거 모르는놈 ㄹㅇ 많네',
  '우회전 사고 요즘 진짜 많음 ㄷㄷ',
];

// ─── 톤 2: 펨코 (가볍고 반말, "~임/~셈") ───
const PEMCO_공통 = [
  '블박 있으면 100% 이기는거 팩트임',
  '그냥 분쟁심의위 넣으셈 편함 무료고',
  '이건 무조건 상대 7 이상 나오는거임 걱정 ㄴㄴ',
  '요즘 이런 얌체 ㄹㅇ 많음 짜증',
  '경험상 5:5 나올 거 같은데',
  '손해사정사 한번 상담 받아보셈 첫 상담은 보통 무료임',
  '몸이 우선이니까 병원부터 가시고 ㄱㄱ',
  '상대 보험사 말만 듣지말고 본인쪽 담당자한테도 확인 필수임',
  '저도 비슷한 거 당했는데 결국 7:3 조정됐음',
  '합의 절대 서두르지 마셈 진단서부터 받으삼',
  '이런건 블박 편집 없이 원본 그대로 들고 가는거임',
  '아 진짜 남일 같지 않네여',
  '과실 인정 안하면 분심위 바로 찌르셈',
  '블박 2채널 추천함 진짜 후방까지 찍혀야 안 억울함',
  '요즘 보험사 대응 점점 영리해져서 본인도 공부 좀 해야 됨',
  '형사까지 갈 일 아니면 보험으로 빨리 끝내는게 이득임',
];
const PEMCO_신호 = [
  '신호 케이스는 교차로 CCTV가 진리임',
  '선진입 증명 되면 이기는데 그게 힘든거임 ㅠ',
];
const PEMCO_추돌 = [
  '추돌은 걍 후방차 100 ㄱㄱ',
  '피추돌이면 렌트비까지 챙겨서 받으셈',
  '급정거였으면 피추돌도 일부 들어감 ㅇㅇ',
];
const PEMCO_차로 = [
  '차로변경 사고는 깜빡이 3초 원칙 모르는놈이 태반임',
  '실선에서 차로변경이면 상대 과실 더 올라감',
];
const PEMCO_보행자 = [
  '보행자 사고는 12대 중과실 조심해야됨 형사 따로임',
  '변호사 한번 상담 받아보시는게 맞음',
  '상대 과실 넣는거 진짜 힘듬 각오하셈',
];
const PEMCO_유턴 = [
  '유턴 사고는 유턴차 과실이 기본 7~8할임',
  '표지 없으면 중앙선침범으로 잡혀서 과실 더 커짐',
];
const PEMCO_주차장 = [
  '주차장 기본 5:5임 주차돼 있는 차 박았으면 진행차 100',
  '주차장 사진 꼼꼼히 찍어두셈 나중에 분쟁 많음',
];
const PEMCO_좌회전 = [
  '비보호 좌회전은 직진 무조건 우선임',
  '좌회전차 기본 과실이 더 큰게 팩트임',
];
const PEMCO_우회전 = [
  '우회전 일시정지 의무 강화된지 좀 됐는데 아직 모르는 사람 많음',
  '우회전은 횡단보도 사람 여부가 진짜 변수임',
];

// ─── 톤 3: 카페 아저씨 (점잖은 존댓말) ───
const CAFE_공통 = [
  '큰 사고 없이 지나가신 것만 해도 천만다행입니다. 몸조리 잘 하시기 바랍니다.',
  '저도 예전에 비슷한 경험이 있었는데요, 블박 영상이 있으시다니 너무 다행입니다.',
  '보험사 담당자의 초동 대응이 중요합니다. 너무 서두르지 마시고 차분히 진행하시기 바랍니다.',
  '글쓴님 마음고생 많으시겠습니다. 순리대로 잘 해결되실 겁니다.',
  '일단 병원 진단서 꼭 떼어두시고, 합의는 충분한 시간을 두고 진행하시기 바랍니다.',
  '손해사정사 상담을 한번 받아보시는 것을 권해드립니다. 첫 상담은 무료인 경우가 대부분입니다.',
  '과실비율분쟁심의위원회를 활용해 보시면 객관적인 판단을 받아보실 수 있습니다.',
  '몸이 가장 우선입니다. 당장은 괜찮으셔도 며칠 지나고 불편한 부위가 생길 수 있으니 유의하세요.',
  '블랙박스 원본은 반드시 별도로 백업해 두시기 바랍니다. 추후 증거로 중요합니다.',
  '저는 25년 무사고 운전 중입니다만, 한번 사고 나면 정말 여러 가지로 힘드시죠. 힘내세요.',
  '상대 보험사 담당자의 말에만 의지하지 마시고, 본인 보험사에도 반드시 확인 받으시기 바랍니다.',
  '금일 진행하시는 모든 대화와 서류는 기록해 두시는 것을 권장드립니다.',
  '글쓴님이 이성적으로 대응하고 계신 것 같아 다행이라고 생각합니다.',
  '사고 처리 과정에서 감정적으로 대응하시면 오히려 손해를 보실 수 있습니다.',
  '변호사 선임까지는 아니더라도, 법률구조공단 상담을 한번 받아보시면 좋습니다.',
  '한국 도로가 점점 혼잡해지면서 이런 사고가 많아지는 것 같아 마음이 무겁습니다.',
];
const CAFE_신호 = [
  '신호 관련 사고는 교차로 CCTV를 확보하시는 것이 관건입니다. 지자체 도로과에 문의 가능합니다.',
  '신호위반은 입증만 되면 상대방 일방과실 인정이 잘 됩니다. 블랙박스 영상 화질이 중요합니다.',
];
const CAFE_추돌 = [
  '후행 추돌은 일반적으로 후행 차량의 과실이 100%로 인정됩니다. 크게 걱정하지 않으셔도 될 것 같습니다.',
  '추돌사고는 피해자의 경우 렌트비 및 시세하락 손해도 청구 가능합니다.',
  '급제동이 있었다면 피해차량에도 일부 과실이 인정될 여지가 있습니다.',
];
const CAFE_차로 = [
  '진로 변경 사고는 방향지시등 작동 여부가 핵심 쟁점입니다. 블박으로 꼭 확인해 보세요.',
  '실선 구간에서의 차로 변경은 명백한 법규 위반으로 상대 과실이 가중됩니다.',
];
const CAFE_보행자 = [
  '보행자 사고의 경우 12대 중과실에 해당될 수 있으니 형사 부분도 반드시 준비하셔야 합니다.',
  '종합보험이 가입되어 있어도 중과실 사고는 형사 면책이 되지 않으니 유의하시기 바랍니다.',
  '보행자의 부상 정도에 따라 합의금 규모가 크게 달라질 수 있습니다. 변호사 상담을 권해드립니다.',
];
const CAFE_유턴 = [
  '유턴 금지 구간에서의 유턴은 중앙선 침범으로 해석되어 일방 과실이 인정됩니다.',
  '유턴 사고는 통상 유턴 차량의 과실이 70~80% 이상 인정되는 경향이 있습니다.',
];
const CAFE_주차장 = [
  '주차장 내 사고는 양방 진행인 경우 5:5가 기본입니다. 주차 중인 차량 충돌은 진행 차량 100%입니다.',
  '주차장 관리사무소에 연락하여 CCTV 확보를 서두르시기 바랍니다. 일정 기간이 지나면 삭제됩니다.',
];
const CAFE_좌회전 = [
  '좌회전 차량은 직진 차량에 비해 높은 주의의무가 요구됩니다. 과실이 더 크게 인정되는 경향이 있습니다.',
  '비보호 좌회전은 직진 차량의 절대 우선권이 인정됩니다. 좌회전 차량이 주된 과실을 부담합니다.',
];
const CAFE_우회전 = [
  '최근 우회전 시 일시정지 의무가 강화되어, 이를 위반한 경우 과실이 크게 잡힙니다.',
  '우회전 사고는 횡단보도 보행자 유무에 따라 처벌 수위가 완전히 달라지니 주의가 필요합니다.',
];

// ─── 차트코드 → 카테고리 매핑 ───
function categoryComments(chartCode: string | null, tone: 'dc' | 'pemco' | 'cafe'): string[] {
  if (!chartCode) return [];
  const out: string[] = [];
  const P = tone === 'dc' ? {
    신호: DC_신호, 추돌: DC_추돌, 차로: DC_차로, 보행자: DC_보행자,
    유턴: DC_유턴, 주차장: DC_주차장, 좌회전: DC_좌회전, 우회전: DC_우회전,
  } : tone === 'pemco' ? {
    신호: PEMCO_신호, 추돌: PEMCO_추돌, 차로: PEMCO_차로, 보행자: PEMCO_보행자,
    유턴: PEMCO_유턴, 주차장: PEMCO_주차장, 좌회전: PEMCO_좌회전, 우회전: PEMCO_우회전,
  } : {
    신호: CAFE_신호, 추돌: CAFE_추돌, 차로: CAFE_차로, 보행자: CAFE_보행자,
    유턴: CAFE_유턴, 주차장: CAFE_주차장, 좌회전: CAFE_좌회전, 우회전: CAFE_우회전,
  };

  if (/^차[1-9]-/.test(chartCode) && !/^차10-/.test(chartCode)) out.push(...P.신호);
  if (/^차(1[0-9]|2[01])-/.test(chartCode)) out.push(...P.신호); // 비신호도 신호 카테고리에 통합
  if (chartCode === '차41-1' || chartCode === '차42-1') out.push(...P.추돌);
  if (['차42-2', '차42-3', '차43-1'].includes(chartCode)) out.push(...P.차로);
  if (chartCode === '차5-1' || /^차5[12]-/.test(chartCode)) out.push(...P.보행자);
  if (/^차(16|8)-/.test(chartCode) || chartCode === '차43-4') out.push(...P.유턴);
  if (/^차(31|44)-/.test(chartCode)) out.push(...P.주차장);
  if (/^차(3|4|12|13|15|21)-/.test(chartCode)) out.push(...P.좌회전);
  if (/^차(2|11|14|17)-/.test(chartCode) || chartCode === '차5-1') out.push(...P.우회전);
  return out;
}

// ─── 톤별 댓글 생성 ───
function randomComment(chartCode: string | null): { content: string; nickname: string } {
  // 톤 분포: 카페 45%, 펨코 35%, 디시 20%
  const r = Math.random();
  const tone: 'dc' | 'pemco' | 'cafe' = r < 0.45 ? 'cafe' : r < 0.80 ? 'pemco' : 'dc';

  const 공통 = tone === 'dc' ? DC_공통 : tone === 'pemco' ? PEMCO_공통 : CAFE_공통;
  const 카테 = categoryComments(chartCode, tone);
  const pool = [...공통, ...공통, ...카테, ...카테]; // 카테고리에 가중치
  const nick = tone === 'dc' ? randName(DC_NICK) : tone === 'pemco' ? randName(PEMCO_NICK) : randName(CAFE_NICK);
  return { content: pick(pool), nickname: nick };
}

// ─── 메인 ───
async function main() {
  console.log('🗑️  기존 댓글 전체 삭제 중...');
  const { error: delErr } = await supabase.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('❌ 삭제 실패:', delErr.message);
    process.exit(1);
  }
  console.log('✅ 삭제 완료\n');

  console.log('💬 3가지 말투 섞어 재시딩 시작 (카페 45% / 펨코 35% / 디시 20%)\n');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, chart_code, created_at')
    .order('created_at', { ascending: false });

  if (error || !posts) {
    console.error('❌ 게시물 조회 실패:', error?.message);
    process.exit(1);
  }

  console.log(`📋 대상 게시물 ${posts.length}건\n`);

  let total = 0;
  let failed = 0;

  for (const post of posts) {
    const numComments = rand(5, 10);
    const used = new Set<string>();
    const postCreated = new Date(post.created_at).getTime();
    const now = Date.now();

    const times: number[] = [];
    for (let i = 0; i < numComments; i++) {
      times.push(postCreated + Math.random() * (now - postCreated));
    }
    times.sort((a, b) => a - b);

    let added = 0;
    for (let i = 0; i < numComments; i++) {
      let c = randomComment(post.chart_code);
      let attempts = 0;
      while (used.has(c.content) && attempts < 10) {
        c = randomComment(post.chart_code);
        attempts++;
      }
      if (used.has(c.content)) continue;
      used.add(c.content);

      const { error: cErr } = await supabase.from('comments').insert({
        post_id: post.id,
        nickname: c.nickname,
        content: c.content,
        session_token: crypto.randomUUID(),
        created_at: new Date(times[i]).toISOString(),
      });

      if (cErr) failed++;
      else added++;
    }

    total += added;
    process.stdout.write(`  ${post.chart_code || '?'} 댓글 +${added}개\n`);
  }

  console.log(`\n🎉 완료: 댓글 ${total}개 추가, 실패 ${failed}건`);
}

main().catch((e) => {
  console.error('💥 실패:', e);
  process.exit(1);
});
