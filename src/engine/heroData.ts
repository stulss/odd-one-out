// 캐릭터 선택지 — 복장 7종 × 머리색 8 × 피부 5 × 옷색 8 × 소품 4.
import type { Hero, HeroAcc, Job } from './save';

/** 복장 — 모자와 상의 모양이 완전히 다른 7가지 실루엣. 구역(이야기)마다 한 벌씩 대응한다 */
export const JOBS: [Job, string][] = [
  ['rookie', '수습 제복'], ['field', '현장 수사관'], ['engineer', '공장 기술자'], ['disguise', '위장 수사관'],
  ['archivist', '도서관 감식관'], ['street', '야시장 정보원'], ['chief', '수석 정복'],
];

/** 이전 버전(판타지 직업)의 저장값을 세계관에 맞는 복장으로 옮긴다 */
export const LEGACY_JOB: Record<string, Job> = {
  detective: 'field', mage: 'disguise', ninja: 'street', cleric: 'archivist', nomad: 'engineer', rogue: 'rookie',
};
export const LEGACY_ACC: Record<string, HeroAcc> = { staff: 'torch', flower: 'notebook' };
export const HAIR_COLORS = ['#2A2224', '#5A3822', '#B8651B', '#E7C468', '#C9474E', '#4C77D8', '#8858D6', '#E8EBF2'];
export const SKINS = ['#FFE3CF', '#F7CBA4', '#E3A877', '#B97C50', '#7A4A2E'];
export const OUTFIT_HUES = [215, 160, 10, 280, 40, 330, 195, 100];
export const HERO_ACCS: [HeroAcc, string][] = [
  ['none', '없음'], ['lens', '돋보기'], ['torch', '손전등'], ['notebook', '수첩'],
];
export const NAME_MAX = 8;
// 등급(0~5)별 진화: 0 기본 복장 · 1 브로치 · 2 어깨 망토 · 3 뒷망토+견장 · 4 금장+오라 · 5 날개+후광  (story.ts의 RANKS와 같은 순서)
export const TIER_LABELS = ['수습', '3급', '2급', '1급', '수석', '전설'];

/** 이름은 화면에 텍스트로만 넣지만, 제어문자·꺾쇠는 저장 전에 걸러 둔다. */
export function sanitizeName(s: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}

const clampIdx = (v: unknown, len: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 && n < len ? n : 0;
};

/**
 * 저장값(예전 버전이 남긴 값 포함)을 현재 선택지 안으로 맞춘다.
 * save.ts의 coerce는 타입만 보므로, 열거형 값과 팔레트 번호의 유효성은 여기서 확인한다.
 */
export function normalizeHero(h: Partial<Hero> | undefined): Hero {
  return {
    name: sanitizeName(h?.name),
    job: ((): Job => {
      const j = LEGACY_JOB[h?.job as string] ?? h?.job;
      return JOBS.some(([v]) => v === j) ? (j as Job) : 'rookie';
    })(),
    hairColor: clampIdx(h?.hairColor, HAIR_COLORS.length),
    skin: clampIdx(h?.skin ?? 1, SKINS.length),
    outfit: clampIdx(h?.outfit, OUTFIT_HUES.length),
    acc: ((): HeroAcc => {
      const a = LEGACY_ACC[h?.acc as string] ?? h?.acc;
      return HERO_ACCS.some(([v]) => v === a) ? (a as HeroAcc) : 'none';
    })(),
  };
}

/** 무작위 캐릭터 (이름은 유지) — 연출용 난수라 퍼즐 시드와 무관하다 */
export function randomHero(name: string): Hero {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    name,
    job: JOBS[pick(JOBS.length)][0],
    hairColor: pick(HAIR_COLORS.length),
    skin: pick(SKINS.length),
    outfit: pick(OUTFIT_HUES.length),
    acc: HERO_ACCS[pick(HERO_ACCS.length)][0],
  };
}
