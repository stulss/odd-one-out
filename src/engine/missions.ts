// 오늘의 임무 · 출석 보상 — 매일 돌아올 이유를 만든다. 순수 함수만 둔다 (저장소는 호출하는 쪽이 저장).
//
// 임무 3개는 날짜(KST)로 정해지므로 하루 동안은 같고, 어느 기기에서 열어도 같다.
// 진행도·수령 여부는 쉼표로 이은 문자열 하나씩에 담아 save.ts의 손상값 방어를 그대로 쓴다.
import type { Store } from './save';
import { mulberry32, xmur3 } from './rng';
import { yesterdayOf } from './save';

export type MissionKind = 'finds' | 'combo' | 'cases' | 'star3' | 'rush' | 'golden';

interface Tpl { kind: MissionKind; label: (goal: number) => string; goals: number[]; reward: number; max?: boolean }

const TPL: Tpl[] = [
  { kind: 'finds', label: g => `정답 ${g}번 맞히기`, goals: [25, 40], reward: 15 },
  { kind: 'combo', label: g => `한 판에서 ${g}연속 정답`, goals: [5, 8], reward: 15, max: true },
  { kind: 'cases', label: g => `사건 ${g}개 해결하기`, goals: [1, 2], reward: 20 },
  { kind: 'star3', label: () => '사건을 별 3개로 해결하기', goals: [1], reward: 25 },
  { kind: 'rush', label: g => `번개 판 ${g}번 성공하기`, goals: [2], reward: 20 },
  { kind: 'golden', label: g => `황금 판 ${g}번 성공하기`, goals: [2], reward: 20 },
];
const COUNT = 3;

export interface Mission {
  idx: number; kind: MissionKind; label: string; goal: number; cur: number; reward: number; done: boolean; claimed: boolean;
}

/** 오늘의 임무 3개 (템플릿 번호, 목표) — 날짜만으로 정해진다 */
export function dailyPicks(dateKey: string): { tpl: number; goal: number }[] {
  const rnd = mulberry32(xmur3('mission:' + dateKey)());
  const order = TPL.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { // 피셔-예이츠 섞기
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, COUNT).map(t => ({ tpl: t, goal: TPL[t].goals[Math.floor(rnd() * TPL[t].goals.length)] }));
}

const nums = (s: string) => Array.from({ length: COUNT }, (_, i) => Math.max(0, Math.trunc(Number(s.split(',')[i])) || 0));

/** 날짜가 바뀌었으면 진행도를 새로 시작한다 */
export function ensure(store: Store, today: string): void {
  if (store.missions.date !== today) store.missions = { date: today, p: '0,0,0', c: '0,0,0' };
}

export function list(store: Store, today: string): Mission[] {
  const m = store.missions.date === today ? store.missions : { date: today, p: '', c: '' };
  const p = nums(m.p), c = nums(m.c);
  return dailyPicks(today).map((pick, i) => {
    const t = TPL[pick.tpl];
    return {
      idx: i, kind: t.kind, label: t.label(pick.goal), goal: pick.goal, cur: Math.min(p[i], pick.goal), reward: t.reward,
      done: p[i] >= pick.goal, claimed: c[i] > 0,
    };
  });
}

/** 진행도를 올린다. combo 임무는 '합계'가 아니라 '최고 기록'을 쓴다. */
export function bump(store: Store, today: string, kind: MissionKind, n = 1): void {
  ensure(store, today);
  const picks = dailyPicks(today);
  const p = nums(store.missions.p);
  picks.forEach((pick, i) => {
    const t = TPL[pick.tpl];
    if (t.kind !== kind) return;
    p[i] = t.max ? Math.max(p[i], n) : p[i] + n;
  });
  store.missions.p = p.join(',');
}

/** 보상을 받는다. 받을 수 없으면 0 */
export function claim(store: Store, today: string, idx: number): number {
  const l = list(store, today)[idx];
  if (!l || !l.done || l.claimed) return 0;
  ensure(store, today);
  const c = nums(store.missions.c);
  c[idx] = 1;
  store.missions.c = c.join(',');
  return l.reward;
}

/** 출석 보상: 하루 한 번, 연속 출석일이 길수록 커진다(7일째까지). 이미 받았으면 0 */
export function loginBonus(store: Store, today: string): { coins: number; streak: number } {
  const l = store.login;
  if (l.date === today) return { coins: 0, streak: l.streak };
  const streak = l.date === yesterdayOf(today) ? l.streak + 1 : 1;
  store.login = { date: today, streak };
  return { coins: 10 + 5 * Math.min(streak, 7), streak };
}
