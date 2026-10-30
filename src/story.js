// 시나리오 — 순수 데이터와 조회 함수만 둔다. DOM·저장소를 건드리지 않는다.
// 세계관: 도시의 모든 것이 복제되고 있다. 복제품에는 반드시 '딱 하나' 다른 점이 남는다.
// 플레이어는 이상 감별국의 신입 감별사, 안내 로봇 '렌즈'가 길을 알려준다.
// 대사의 {n}은 캐릭터 이름으로 바뀐다.

export const ZONE_LEN = 5;                 // 5단계마다 구역이 바뀐다

export const NPC_NAME = '렌즈';

export const PROLOGUE = [
  { who:'npc',  text:'어서 와요, {n}. 저는 이상 감별국 안내 로봇 \'렌즈\'예요.' },
  { who:'npc',  text:'요즘 도시 곳곳에서 물건이 끝없이 복제되고 있어요. 원본과 똑같이 생겼죠.' },
  { who:'npc',  text:'하지만 복제품에는 반드시 딱 하나, 어딘가 다른 곳이 남아요. 그걸 찾는 게 감별사의 일!' },
  { who:'hero', text:'…좋아요. 눈 하나는 자신 있어요.' },
];

export const ZONES = [
  { name:'수습 훈련실',  hue:160, lines:[
    '기본기부터 익혀요. 차이가 크게 보이는 동안이 연습 시간이에요.',
    '틀려도 괜찮아요. 시간이 1초 깎일 뿐이에요.' ] },
  { name:'복제 공장',    hue:215, lines:[
    '여긴 복제 공장이에요. 컨베이어 위로 똑같은 것들이 쏟아져 나와요.',
    '속도가 붙었어요. 오답은 1초씩 깎이는 거, 잊지 마세요.' ] },
  { name:'거울 미로',    hue:280, lines:[
    '거울 속의 거울… 비슷한 모양에 속지 마세요. 차이가 점점 미묘해져요.',
    '{n}, 눈을 한 번 비비고 가요!' ] },
  { name:'안개 도서관',  hue:40,  lines:[
    '책장 사이로 안개가 자욱해요. 색이 바랜 것처럼 보일 거예요.',
    '밝기와 채도에 너무 매달리지 말고, 전체를 훑어봐요.' ] },
  { name:'네온 시장',    hue:330, lines:[
    '번쩍이는 간판 때문에 눈이 아프죠? 그래도 하나는 분명히 달라요.',
    '여기까지 온 감별사는 많지 않아요. 자신감을 가져요, {n}!' ] },
  { name:'심연 격납고',  hue:195, lines:[
    '복제의 근원이 가까워요. 이제 차이는 거의 보이지 않을 거예요.',
    '숨을 고르고… 보세요.' ] },
];

const ENDLESS_LINES = [
  '더는 지도에 없는 구역이에요. 여기부턴 {n}의 기록이 곧 지도예요.',
  '믿기지 않지만… 아직도 더 있어요. 계속 가요!',
];

export const RANKS = [
  { min:0,  name:'수습생' },
  { min:5,  name:'3급 감별사' },
  { min:10, name:'2급 감별사' },
  { min:15, name:'1급 감별사' },
  { min:20, name:'수석 감별사' },
  { min:30, name:'전설의 감별사' },
];

/** 단계 → 구역 정보. first = 이 단계가 구역의 첫 단계인가. */
export function zoneOf(n){
  const idx = Math.max(0, Math.floor((Math.max(1, n) - 1) / ZONE_LEN));
  const def = ZONES[idx];
  if (def) return { idx, ...def, first: (n - 1) % ZONE_LEN === 0 };
  return {
    idx, name:`끝없는 복제 구역 ${idx - ZONES.length + 1}`, hue:(idx * 47) % 360,
    lines: ENDLESS_LINES, first: (n - 1) % ZONE_LEN === 0,
  };
}

export function rankOf(stages){
  let r = RANKS[0];
  for (const x of RANKS) if (stages >= x.min) r = x;
  return r.name;
}

/** 결과 화면에서 렌즈가 하는 말 */
export function closingLine(stages, isBest, reason){
  if (isBest && stages >= 10) return '신기록이에요! 국장님께 보고해야겠어요.';
  if (isBest)                 return '기록 갱신! 눈이 점점 좋아지고 있어요.';
  if (reason === 'wrong_streak') return '연달아 틀렸어요. 서두르지 말고 한 템포만 쉬어요.';
  if (stages < 5)  return '괜찮아요. 눈은 훈련할수록 좋아져요. 한 번 더?';
  if (stages < 15) return '꽤 잘했어요! 다음 구역도 보고 싶지 않아요?';
  return '정말 대단해요. 복제범들이 벌벌 떨고 있을 거예요.';
}

export const fill = (text, name) => text.replaceAll('{n}', name || '감별사');
