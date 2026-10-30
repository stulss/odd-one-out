// 캐릭터 선택지 — 몸 모양 4종 × 색 8종 × 액세서리 4종.
import type { HeroAcc, HeroShape } from './save';

export const HERO_SHAPES: [HeroShape, string][] = [['circle', '동글'], ['square', '네모'], ['diamond', '마름모'], ['hexagon', '육각']];
export const HERO_HUES = [160, 215, 280, 40, 330, 195, 10, 100];
export const HERO_ACCS: [HeroAcc, string][] = [['none', '없음'], ['antenna', '안테나'], ['hat', '탐정모'], ['lens', '돋보기']];
export const NAME_MAX = 8;
// 등급(0~5)별 진화: 0 기본 · 1 배지 · 2 스카프 · 3 망토 · 4 오라 · 5 날개+후광  (story.ts의 RANKS와 같은 순서)
export const TIER_LABELS = ['수습', '3급', '2급', '1급', '수석', '전설'];

/** 이름은 화면에 텍스트로만 넣지만, 제어문자·꺾쇠는 저장 전에 걸러 둔다. */
export function sanitizeName(s: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}
