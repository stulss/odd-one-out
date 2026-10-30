import { beforeEach, describe, expect, it } from 'vitest';
import * as Save from './save';
import {
  CASES, TOTAL_CASES, addCodex, campaignTier, caseCoins, clearedCount, codexFound, currentCase, enforceUnlocks,
  heroTier, isCaseUnlocked, isUnlocked, priceOf, rateCase, readCodex, setStars, starsOf, unlock, totalStars,
} from './campaign';
import { OBJECT_COUNT } from './objects';

describe('campaign', () => {
  let store: Save.Store;
  beforeEach(() => { localStorage.clear(); store = Save.load(); });

  it('사건 18개, 구역마다 마지막 사건이 보스(라운드 7)다', () => {
    expect(TOTAL_CASES).toBe(18);
    expect(CASES.filter(c => c.finale).map(c => c.id)).toEqual([3, 6, 9, 12, 15, 18]);
    for (const c of CASES) expect(c.rounds).toBe(c.finale ? 7 : 5);
    expect(CASES[0].startN).toBe(1);
    expect(CASES.at(-1)!.startN + CASES.at(-1)!.rounds - 1).toBeLessThanOrEqual(45); // 난이도 곡선 범위 안
  });

  it('앞 사건을 클리어해야 다음 사건이 열린다', () => {
    expect(isCaseUnlocked(store, 0)).toBe(true);
    expect(isCaseUnlocked(store, 1)).toBe(false);
    setStars(store, 0, 1);
    expect(isCaseUnlocked(store, 1)).toBe(true);
    expect(currentCase(store)).toBe(1);
  });

  it('별은 올라가기만 하고 내려가지 않는다', () => {
    setStars(store, 4, 3);
    setStars(store, 4, 1);
    expect(starsOf(store, 4)).toBe(3);
    expect(clearedCount(store)).toBe(1);
    expect(totalStars(store)).toBe(3);
  });

  it('손상된 별 문자열도 안전하게 읽는다', () => {
    store.campaign.stars = 'x9-1';
    expect(starsOf(store, 0)).toBe(0);
    expect(starsOf(store, 1)).toBe(3); // 상한 3
    expect(starsOf(store, 99)).toBe(0);
  });

  it('별 평가: 오답 없이 빠르면 3, 오답 1회 이하 2, 그 외 1', () => {
    expect(rateCase(0, 0.4)).toBe(3);
    expect(rateCase(0, 0.8)).toBe(2);
    expect(rateCase(1, 0.2)).toBe(2);
    expect(rateCase(3, 0.2)).toBe(1);
  });

  it('코인: 첫 클리어와 새로 얻은 별에 보너스, 재도전은 기본만', () => {
    expect(caseCoins(3, true, 3)).toBe(8 + 12 + 10 + 15);
    expect(caseCoins(3, false, 0)).toBe(8 + 12);
    expect(caseCoins(2, false, 1)).toBe(8 + 8 + 5);
  });

  it('해금: 복장은 코인으로 못 사고, 소품·옷색은 가격이 있다', () => {
    expect(isUnlocked(store, 'job', 'rookie')).toBe(true);
    expect(isUnlocked(store, 'job', 'field')).toBe(false);
    expect(priceOf('job', 'field')).toBeNull();
    expect(isUnlocked(store, 'acc', 'lens')).toBe(true);
    expect(isUnlocked(store, 'acc', 'torch')).toBe(false);
    expect(priceOf('acc', 'torch')).toBe(30);
    expect(isUnlocked(store, 'outfit', 2)).toBe(true);
    expect(isUnlocked(store, 'outfit', 5)).toBe(false);
    unlock(store, 'acc', 'torch');
    expect(isUnlocked(store, 'acc', 'torch')).toBe(true);
  });

  it('해금 안 된 캐릭터 값은 무료 기본값으로 되돌린다', () => {
    const h = enforceUnlocks(store, { job: 'street' as const, acc: 'torch', outfit: 6 });
    expect(h).toEqual({ job: 'rookie', acc: 'none', outfit: 0 });
    unlock(store, 'job', 'street');
    expect(enforceUnlocks(store, { job: 'street' as const, acc: 'lens', outfit: 1 }).job).toBe('street');
  });

  it('도감: 10·50·200번째에 보상 코인', () => {
    let coins = 0;
    for (let i = 0; i < 10; i++) coins += addCodex(store, 2);
    expect(coins).toBe(20);
    for (let i = 0; i < 40; i++) coins += addCodex(store, 2);
    expect(coins).toBe(70);
    expect(readCodex(store)).toHaveLength(OBJECT_COUNT);
    expect(readCodex(store)[2]).toBe(50);
    expect(codexFound(store)).toBe(1);
  });

  it('캐릭터 진화 단계는 구역을 마칠 때마다 오르고, 무한 모드 기록과 큰 쪽을 쓴다', () => {
    expect(campaignTier(store)).toBe(0);
    [0, 1, 2].forEach(i => setStars(store, i, 1));
    expect(campaignTier(store)).toBe(1);
    expect(heroTier(store)).toBe(1);
    store.best.stages = 22; // 수석
    expect(heroTier(store)).toBe(4);
  });
});

import { BOSSES, bossOf } from './bosses';

describe('bosses', () => {
  it('구역 마지막 사건마다 보스가 한 명씩 있다', () => {
    expect(BOSSES.map(b => b.caseId)).toEqual(CASES.filter(c => c.finale).map(c => c.id));
    for (const c of CASES) expect(!!bossOf(c.id)).toBe(c.finale);
  });

  it('보스 데이터가 유효하다 (물건 종류·컷신 대사·도발)', () => {
    for (const b of BOSSES) {
      expect(b.kind).toBeGreaterThanOrEqual(0);
      expect(b.kind).toBeLessThan(OBJECT_COUNT);
      expect(b.taunts.length).toBeGreaterThanOrEqual(3);
      expect(b.low.length).toBeGreaterThan(0);
      for (const l of [...b.intro, ...b.defeat]) {
        expect(['npc', 'hero', 'boss', 'sys']).toContain(l.who);
        expect(l.text.length).toBeGreaterThan(0);
      }
      expect(b.intro.some(l => l.who === 'boss')).toBe(true); // 보스가 먼저 말을 건다
      expect(b.defeat.some(l => l.who === 'boss')).toBe(true);
    }
  });

  it('보스마다 쓰는 물건이 다르다', () => {
    expect(new Set(BOSSES.map(b => b.kind)).size).toBe(BOSSES.length);
  });
});

import { migrateUnlocked } from './campaign';
import { normalizeHero } from './heroData';

describe('이전 판타지 직업 → 세계관 복장 이전', () => {
  it('저장된 해금 목록과 캐릭터를 새 이름으로 옮긴다', () => {
    expect(migrateUnlocked('job:mage,acc:staff,outfit:3').split(',').sort()).toEqual(['acc:torch', 'job:disguise', 'outfit:3']);
    expect(migrateUnlocked('job:detective,job:mage').split(',')).toEqual(['job:field', 'job:disguise']);
    expect(normalizeHero({ name: 'a', job: 'ninja' as never, acc: 'flower' as never })).toMatchObject({ job: 'street', acc: 'notebook' });
    expect(migrateUnlocked('')).toBe('');
  });
});
