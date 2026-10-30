// 보스 — 구역 마지막 사건(finale)마다 한 명. 복제품 물건 하나가 '두목'이 되어 나타난다.
// 컷신(등장·격파·에필로그)과 전투 중 도발 대사를 데이터로 둔다. 화면·저장소를 모르는 순수 데이터다.
import type { DialogLine } from './story';

export interface BossFace { x: number; y: number; s: number } // 물건 그림(100×100) 위에 얹을 표정 위치·크기

export interface BossDef {
  caseId: number; // 이 보스가 나오는 사건 번호 (finale)
  name: string;
  kind: number; // objects.ts의 물건 종류
  hue: number;
  face: BossFace;
  taunts: string[]; // 오답일 때 놀리는 말
  low: string; // 체력이 1칸 남았을 때
  intro: DialogLine[]; // 등장 컷신
  defeat: DialogLine[]; // 격파 컷신
}

export const BOSSES: BossDef[] = [
  {
    caseId: 3, name: '버섯 감독관', kind: 0, hue: 8, face: { x: 50, y: 33, s: 1 },
    taunts: ['그걸 못 찾겠지?', '느려, 느려~', '후후, 틀렸구나!'], low: '크윽… 내 복제품들이…!',
    intro: [
      { who: 'boss', text: '허허, 신입이 졸업시험을 보러 왔구나?' },
      { who: 'npc', text: '조심해요, {n}! 쌍둥이 버섯 군단을 거느리고 있어요.' },
      { who: 'hero', text: '눈 하나는 자신 있다니까요.' },
    ],
    defeat: [
      { who: 'boss', text: '크윽… 내 복제품이 이렇게 쉽게 들통나다니…' },
      { who: 'npc', text: '졸업이에요, {n}! 이제 어엿한 감별사예요.' },
    ],
  },
  {
    caseId: 6, name: '주전자 공장장', kind: 2, hue: 215, face: { x: 48, y: 62, s: 1.1 },
    taunts: ['라인은 멈추지 않는다!', '불량은 너야, 불량!', '하하, 한참 모자라군!'], low: '라인이… 멈춘다고?!',
    intro: [
      { who: 'boss', text: '내 공장에서 불량품을 찾겠다고? 컨베이어, 풀가동!' },
      { who: 'npc', text: '속도가 엄청나요. 침착하게 하나씩 봐요!' },
      { who: 'hero', text: '빨리 흘러가도, 다른 점은 남아 있어요.' },
    ],
    defeat: [
      { who: 'boss', text: '펄펄 끓던 라인이… 식어 간다…' },
      { who: 'npc', text: '공장이 멈췄어요! 첫 대형 사건 해결이에요.' },
    ],
  },
  {
    caseId: 9, name: '거울 속 그림자', kind: 5, hue: 280, face: { x: 50, y: 42, s: 1 },
    taunts: ['거울 속의 나는 더 영리하지.', '어느 쪽이 진짜일까~', '눈을 속이는 건 쉬워.'], low: '거울에 금이 간다…!',
    intro: [
      { who: 'boss', text: '거울 속의 나는 너보다 한 수 위란다.' },
      { who: 'npc', text: '차이가 정말 미묘해요. 전체를 훑어봐요!' },
      { who: 'hero', text: '진짜는 하나뿐이에요. 반드시 찾겠어요.' },
    ],
    defeat: [
      { who: 'boss', text: '내 거울이… 깨져 간다…' },
      { who: 'npc', text: '해냈어요! 거울 미로를 빠져나왔어요.' },
    ],
  },
  {
    caseId: 12, name: '금서의 사서', kind: 7, hue: 40, face: { x: 50, y: 50, s: 1 },
    taunts: ['쉿, 조용히 읽으렴.', '그 책이 아니란다.', '서고는 깊고 넌 얕구나.'], low: '책장이… 무너진다…!',
    intro: [
      { who: 'boss', text: '이 서고에서 진짜 책을 찾겠다니, 웃기는군.' },
      { who: 'npc', text: '안개가 짙어요. 색에만 속지 말아요!' },
      { who: 'hero', text: '책도 사람도, 다른 점은 숨길 수 없어요.' },
    ],
    defeat: [
      { who: 'boss', text: '내 비밀 서가가… 들켜 버렸군.' },
      { who: 'npc', text: '금서 목록이 모두 돌아왔어요!' },
    ],
  },
  {
    caseId: 15, name: '야시장 회장', kind: 3, hue: 330, face: { x: 44, y: 52, s: 1.1 },
    taunts: ['내 가짜는 완벽해!', '눈이 부시지? 아하하!', '사지 않으면 손해야~'], low: '장사… 망했다…!',
    intro: [
      { who: 'boss', text: '내 가짜 상품은 완벽해! 눈이 부시지?' },
      { who: 'npc', text: '번쩍이는 불빛에 속지 말아요, {n}!' },
      { who: 'hero', text: '반짝이는 건 다 가짜는 아니에요. 하나만 가려내면 돼요.' },
    ],
    defeat: [
      { who: 'boss', text: '내 가게가… 불이 꺼진다…' },
      { who: 'npc', text: '야시장이 평화를 되찾았어요!' },
    ],
  },
  {
    caseId: 18, name: '마스터 키', kind: 1, hue: 195, face: { x: 50, y: 24, s: 0.7 },
    taunts: ['나는 모든 복제의 근원이다.', '원본을 가려낼 수 있겠나?', '네 눈도 곧 흐려질 것이다.'], low: '내가… 복제였다고…?',
    intro: [
      { who: 'boss', text: '나는 모든 복제의 근원. 원본이 누구인지 가려낼 수 있겠나?' },
      { who: 'npc', text: '마지막이에요, {n}. 이제까지 배운 모든 걸 보여 줘요.' },
      { who: 'hero', text: '원본은 단 하나. 다른 점도 단 하나예요.' },
    ],
    defeat: [
      { who: 'boss', text: '나조차… 복제였다니… 원본은 처음부터…' },
      { who: 'npc', text: '복제가 멈췄어요! 도시의 모든 물건이 제자리로 돌아와요.' },
      { who: 'hero', text: '찾아낸 건 물건의 다른 점이 아니라, 제 눈이었나 봐요.' },
      { who: 'npc', text: '맞아요. 당신은 이제 전설의 감별사예요, {n}!' },
    ],
  },
];

export const bossOf = (caseId: number): BossDef | undefined => BOSSES.find(b => b.caseId === caseId);
