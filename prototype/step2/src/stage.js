// STEP 2에서 추가 — STEP 1의 main.js에 있던 makeStage를 여기로 옮기고,
// 시드 난수와 제한 시간을 붙였다.

import { stageRng } from './rng.js';

// 그리드는 스테이지 번호로만 결정한다.
// 화면 크기에 따라 칸 수가 달라지면 같은 시드라도 기기마다 다른 문제가 나온다.
export const GRIDS = [
  { c:2, r:3 }, { c:2, r:3 }, { c:3, r:3 }, { c:3, r:4 }, { c:3, r:4 },
  { c:4, r:4 }, { c:4, r:4 }, { c:4, r:5 }, { c:4, r:5 }, { c:4, r:6 },
];
export const MAX_CELLS = 24;

// STEP 1의 판단: "12판 동안 3도밖에 안 줄어든다, 너무 완만하다"
// → 40스테이지 기준을 25스테이지로 좁히고, 하한을 3도로 낮췄다.
const SPAN = 25;
const EASY = 20, HARD = 3;

// 난이도 상수. 이 값 하나만 조정한다.
export const TUNE_T = 4.4;

export function makeStage(rootKey, n, prevAnswer){
  const rnd  = stageRng(rootKey, n);
  const t    = Math.min((n - 1) / SPAN, 1);
  const ease = t * t * (3 - 2 * t);              // 초반 완만, 후반 급격

  const g = GRIDS[Math.min(n - 1, GRIDS.length - 1)];
  const total = g.c * g.r;

  // 차이: 20도 → 3도. ±15% 흔들어 패턴 학습을 막는다.
  let delta = (EASY - ease * (EASY - HARD)) * (0.85 + rnd() * 0.3);
  delta = Math.max(delta, 2.5);                   // 지각 임계값 — 이보다 작으면 아무도 못 찾는다

  // 제한 시간: 6.0초 → 1.6초. 칸이 많으면 조금 더 준다.
  const timeLimit = Math.max(1.6, 6.0 - ease * TUNE_T) + (total > 16 ? 0.5 : 0);

  let answer = Math.floor(rnd() * total);
  if (answer === prevAnswer && total > 1) answer = (answer + 1) % total;

  return { n, cols: g.c, rows: g.r, total, answer, delta, timeLimit };
}

// 점수: 큰 격자일수록, 빨리 찾을수록, 콤보가 길수록 높다.
export function scoreOf(stage, elapsed, combo){
  const gridBonus = stage.total / 12;                             // 0.5 ~ 2.0
  const speed     = Math.max(0.1, 1 - elapsed / stage.timeLimit); // 0.1 ~ 1.0
  const comboMul  = 1 + Math.min(combo, 10) * 0.1;                // 1.0 ~ 2.0
  return Math.round(100 * gridBonus * (0.4 + speed * 0.6) * comboMul);
}
