import { beforeEach, describe, expect, it } from 'vitest';
import { decodeSeed, encodeSeed, stageRng } from './rng';
import { AXIS_IDS, DIFF_AXES, makeStage } from './stage';
import { OBJECTS, OBJECT_COUNT } from './objects';
import * as Save from './save';
import { evaluate } from './achieve';
import { rankOf, tierOf, zoneOf } from './story';
import { sanitizeName, normalizeHero, HAIR_COLORS } from './heroData';

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

  it('모든 판이 유효하다: 물건 종류·지각 임계값·정답 위치 (1~40단계 × 시드 200개)', () => {
    for (let k = 0; k < 200; k++) {
      for (let n = 1; n <= 40; n++) {
        const s = makeStage('c:V' + k, n, 4.4, null);
        expect(s.kind).toBeGreaterThanOrEqual(0);
        expect(s.kind).toBeLessThan(OBJECT_COUNT);
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

describe('objects', () => {
  it('물건 8종은 모두 이름과 그림 레이어를 가진다', () => {
    expect(OBJECTS).toHaveLength(OBJECT_COUNT);
    for (const o of OBJECTS) {
      expect(o.name.length).toBeGreaterThan(0);
      expect(o.layers.length).toBeGreaterThan(1);
      for (const l of o.layers) expect(l.d).toMatch(/^M[\d. -]+/);
    }
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
    s.hero = { name: '민지', job: 'engineer', hairColor: 3, skin: 2, outfit: 4, acc: 'torch' };
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

  it('예전 버전/손상된 캐릭터 값은 현재 선택지 안으로 보정된다', () => {
    const old = { name: '민지', shape: 'diamond', hue: 330, acc: 'antenna' } as never; // 진화 이전 버전의 저장 형태
    expect(normalizeHero(old)).toMatchObject({ name: '민지', job: 'rookie', acc: 'none' }); // 복장이 없던 아주 옛 저장 → 수습 제복, 모르는 소품 → 없음;
    const bad = normalizeHero({ name: 'x', job: 'nope' as never, hairColor: 99, skin: -3, outfit: 1.7, acc: 'torch' });
    expect(bad.job).toBe('rookie');
    expect(bad.hairColor).toBeLessThan(HAIR_COLORS.length);
    expect(bad.skin).toBe(0);
    expect(bad.acc).toBe('torch');
  });

  it('이름은 제어문자·꺾쇠를 걸러내고 8자로 자른다', () => {
    expect(sanitizeName('<b>민지</b>abcdefghij')).toBe('b민지/babc');
    expect(sanitizeName('  ')).toBe('');
  });
});
