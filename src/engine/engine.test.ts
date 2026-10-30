import { beforeEach, describe, expect, it } from 'vitest';
import { decodeSeed, encodeSeed, stageRng } from './rng';
import { AXIS_IDS, DIFF_AXES, isVisible, makeStage } from './stage';
import * as Save from './save';
import { evaluate } from './achieve';
import { rankOf, tierOf, zoneOf } from './story';
import { sanitizeName } from './heroData';

describe('rng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = stageRng('c:ABC234', 3), b = stageRng('c:ABC234', 3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('도전장 코드는 왕복한다', () => {
    for (const seed of [0, 1, 123456789, 0xffffffff]) {
      const code = encodeSeed(seed);
      expect(code).toHaveLength(6);
      expect(encodeSeed(decodeSeed(code)!)).toBe(code); // 코드 → 시드 → 코드
    }
    expect(decodeSeed('abc')).toBeNull();
    expect(decodeSeed('IIIIII')).toBeNull(); // 혼동 문자 제외
  });
});

describe('stage', () => {
  it('같은 시드·단계는 같은 문제다', () => {
    expect(makeStage('c:T', 7, 4.4, null)).toEqual(makeStage('c:T', 7, 4.4, null));
  });

  it('화면에 안 그려지는 모양×차이 조합이 없다 (1~40단계 × 시드 200개)', () => {
    for (let k = 0; k < 200; k++) {
      for (let n = 1; n <= 40; n++) {
        const s = makeStage('c:V' + k, n, 4.4, null);
        expect(isVisible(s.shape, s.axis)).toBe(true);
        expect(s.delta).toBeGreaterThanOrEqual(DIFF_AXES[s.axis].min);
        expect(s.answer).toBeGreaterThanOrEqual(0);
        expect(s.answer).toBeLessThan(s.total);
      }
    }
  });

  it('초반(1단계)은 같은 축의 기존 easy 값 이상으로 크다', () => {
    for (let k = 0; k < 100; k++) {
      const s = makeStage('c:E' + k, 1, 4.4, null);
      expect(s.delta).toBeGreaterThanOrEqual(DIFF_AXES[s.axis].easy * 0.85 - 1e-9);
      if (s.axis === 'sat') expect(s.delta).toBeLessThanOrEqual(90);
    }
  });

  it('연습 모드: 축을 고정해도 정답 위치는 변하지 않는다', () => {
    const free = makeStage('c:F', 4, 4.4, null);
    const forced = makeStage('c:F', 4, 4.4, null, 'rotate');
    expect(forced.axis).toBe('rotate');
    expect(forced.answer).toBe(free.answer);
    expect(AXIS_IDS).toContain(forced.axis);
  });
});

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('손상된 값이 들어와도 기본값으로 실행된다', () => {
    for (const bad of ['abc', '{', 'null', '[]', '{"best":"x"}', '{"settings":{"tuneT":"no"}}']) {
      localStorage.setItem('ooo.v1', bad);
      const s = Save.load();
      expect(s.settings.tuneT).toBe(4.4);
      expect(s.best.stages).toBe(0);
    }
  });

  it('저장 후 다시 읽으면 같다', () => {
    const s = Save.load();
    s.best.stages = 12;
    s.hero = { name: '민지', shape: 'hexagon', hue: 40, acc: 'hat' };
    Save.save(s);
    const r = Save.load();
    expect(r.best.stages).toBe(12);
    expect(r.hero.name).toBe('민지');
  });

  it('연속 출석', () => {
    const s = Save.load();
    Save.bumpStreak(s, '20261029');
    Save.bumpStreak(s, '20261030');
    expect(s.streak.count).toBe(2);
    Save.bumpStreak(s, '20261101'); // 하루 건너뜀
    expect(s.streak.count).toBe(1);
  });
});

describe('story · achieve · hero', () => {
  it('등급과 구역은 5단계마다 바뀐다', () => {
    expect(tierOf(0)).toBe(0);
    expect(tierOf(5)).toBe(1);
    expect(tierOf(30)).toBe(5);
    expect(rankOf(12)).toBe('2급 감별사');
    expect(zoneOf(5).idx).toBe(0);
    expect(zoneOf(6)).toMatchObject({ idx: 1, first: true });
    expect(zoneOf(100).name).toContain('끝없는');
  });

  it('업적은 한 번만 달성된다', () => {
    const store = Save.load();
    store.stats.played = 1;
    const ctx = { store, mode: 'normal' as const, stages: 10, maxCombo: 3, wrongs: 0, bestReaction: 0.5, challengeType: 'free' as const };
    const first = evaluate(ctx).map(a => a.id);
    expect(first).toEqual(expect.arrayContaining(['first', 's10', 'fast', 'clean']));
    expect(evaluate(ctx)).toHaveLength(0);
  });

  it('이름은 제어문자·꺾쇠를 걸러내고 8자로 자른다', () => {
    expect(sanitizeName('<b>민지</b>abcdefghij')).toBe('b민지/babc');
    expect(sanitizeName('  ')).toBe('');
  });
});
