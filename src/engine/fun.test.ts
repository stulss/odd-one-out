import { beforeEach, describe, expect, it } from 'vitest';
import * as Save from './save';
import { MODS, rollModifier } from './modifiers';
import * as Missions from './missions';

describe('modifiers', () => {
  it('1라운드·초반 사건·보스의 중간 라운드에는 붙지 않는다', () => {
    expect(rollModifier('k:5:AAA', 1, 5, false, 5)).toBeNull();
    for (let r = 1; r <= 5; r++) expect(rollModifier('k:1:AAA', r, 5, false, 1)).toBeNull();
    for (let r = 1; r < 7; r++) expect(rollModifier('k:3:AAA', r, 7, true, 3)).toBeNull();
  });

  it('보스의 마지막 일격은 번개 판이다', () => {
    expect(rollModifier('k:3:AAA', 7, 7, true, 3)).toBe('rush');
  });

  it('같은 시드·라운드는 항상 같은 결과를 낸다', () => {
    for (let r = 2; r <= 5; r++) expect(rollModifier('k:9:XYZ', r, 5, false, 9)).toBe(rollModifier('k:9:XYZ', r, 5, false, 9));
  });

  it('대략 30% 라운드에 변주가 붙는다 (번개 18% · 황금 12%)', () => {
    let rush = 0, gold = 0, n = 0;
    for (let k = 0; k < 600; k++) for (let r = 2; r <= 5; r++) {
      const m = rollModifier('k:7:' + k, r, 5, false, 7); n++;
      if (m === 'rush') rush++; else if (m === 'golden') gold++;
    }
    expect(rush / n).toBeGreaterThan(0.13); expect(rush / n).toBeLessThan(0.23);
    expect(gold / n).toBeGreaterThan(0.08); expect(gold / n).toBeLessThan(0.17);
  });

  it('번개 판은 시간이 짧고 보상이 있다', () => {
    expect(MODS.rush.timeMul).toBeLessThan(1);
    expect(MODS.rush.coins).toBeGreaterThan(0);
    expect(MODS.golden.timeMul).toBe(1);
  });
});

describe('missions · 출석', () => {
  let store: Save.Store;
  beforeEach(() => { localStorage.clear(); store = Save.load(); });

  it('날짜가 같으면 임무가 같고, 서로 다른 3개다', () => {
    const a = Missions.dailyPicks('20261030'), b = Missions.dailyPicks('20261030');
    expect(a).toEqual(b);
    expect(new Set(a.map(x => x.tpl)).size).toBe(3);
  });

  it('날짜가 바뀌면 진행도가 초기화된다', () => {
    Missions.bump(store, '20261030', 'finds', 10);
    expect(store.missions.date).toBe('20261030');
    Missions.ensure(store, '20261031');
    expect(store.missions).toEqual({ date: '20261031', p: '0,0,0', c: '0,0,0' });
  });

  it('진행도를 올리고, 달성하면 한 번만 받을 수 있다', () => {
    const day = '20261030';
    const picks = Missions.dailyPicks(day);
    const kinds = Missions.list(store, day).map(m => m.kind);
    for (const kind of kinds) Missions.bump(store, day, kind, 99); // 전부 넘치게
    const l = Missions.list(store, day);
    expect(l.every(m => m.done && m.cur === m.goal)).toBe(true); // 표시는 목표까지만
    expect(Missions.claim(store, day, 0)).toBe(l[0].reward);
    expect(Missions.claim(store, day, 0)).toBe(0); // 두 번 받을 수 없다
    expect(Missions.list(store, day)[0].claimed).toBe(true);
    expect(picks).toHaveLength(3);
  });

  it('콤보 임무는 합계가 아니라 최고 기록을 쓴다', () => {
    // 'combo' 임무가 있는 날짜를 찾는다
    let day = '';
    for (let d = 1; d <= 28 && !day; d++) {
      const key = '202611' + String(d).padStart(2, '0');
      if (Missions.list(Save.load(), key).some(m => m.kind === 'combo')) day = key;
    }
    expect(day).not.toBe('');
    Missions.bump(store, day, 'combo', 3);
    Missions.bump(store, day, 'combo', 2);
    const m = Missions.list(store, day).find(x => x.kind === 'combo')!;
    expect(m.cur).toBe(3);
  });

  it('손상된 진행도 문자열도 안전하다', () => {
    store.missions = { date: '20261030', p: 'x,-5,99999999', c: '' };
    const l = Missions.list(store, '20261030');
    expect(l).toHaveLength(3);
    expect(l[0].cur).toBe(0);
    expect(l[1].cur).toBe(0);
  });

  it('출석 보상: 하루 한 번, 연속일수에 따라 커지고 하루 건너뛰면 1일부터', () => {
    const a = Missions.loginBonus(store, '20261029');
    expect(a).toEqual({ coins: 15, streak: 1 });
    expect(Missions.loginBonus(store, '20261029').coins).toBe(0); // 같은 날 두 번째
    expect(Missions.loginBonus(store, '20261030')).toEqual({ coins: 20, streak: 2 });
    expect(Missions.loginBonus(store, '20261101')).toEqual({ coins: 15, streak: 1 }); // 하루 건너뜀
    for (let d = 2; d <= 12; d++) Missions.loginBonus(store, '202611' + String(d).padStart(2, '0'));
    expect(Missions.loginBonus(store, '20261113').coins).toBe(45); // 7일 상한 (10 + 5*7)
  });
});
