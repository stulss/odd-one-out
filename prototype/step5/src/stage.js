// STEP 4에서 확장 — 차이 축 1종(회전) → 10종, 도형 4종 추가.
//
// STEP 3까지는 "회전"만 썼다. 10판만 해도 "또 회전이네"가 되어 반복으로 느껴진다.
// 축을 늘리면 같은 격자라도 매번 다른 종류의 관찰을 요구하게 된다.

import { stageRng } from './rng.js';

export const GRIDS = [
  { c:2, r:3 }, { c:2, r:3 }, { c:3, r:3 }, { c:3, r:4 }, { c:3, r:4 },
  { c:4, r:4 }, { c:4, r:4 }, { c:4, r:5 }, { c:4, r:5 }, { c:4, r:6 },
];
export const MAX_CELLS = 24;

// 각 축의 min은 "지각 임계값" — 이보다 차이가 작으면 사람이 찾을 수 없다.
// 이 값이 없으면 후반에 delta가 계속 줄어들다가 "아무도 못 푸는 판"이 나온다.
// easy에서 시작해 hard로 좁히되, 절대 min 아래로는 내려가지 않는다.
export const AXES = {
  hue:     { label:'색조',   easy:40,  hard:6,   min:5,   css:d => `filter:hue-rotate(${d.toFixed(1)}deg)` },
  light:   { label:'밝기',   easy:24,  hard:5,   min:4,   css:d => `filter:brightness(${(100+d).toFixed(0)}%)` },
  size:    { label:'크기',   easy:18,  hard:3.5, min:3,   css:d => `scale:${(1+d/100).toFixed(3)}` },
  rotate:  { label:'회전',   easy:20,  hard:3,   min:2.5, css:d => `rotate:${d.toFixed(2)}deg` },
  radius:  { label:'모서리', easy:38,  hard:8,   min:6,   css:d => `border-radius:${Math.max(0,40-d).toFixed(0)}%` },
  opacity: { label:'투명도', easy:26,  hard:7,   min:6,   css:d => `opacity:${(1-d/100).toFixed(3)}` },
  offset:  { label:'위치',   easy:9,   hard:2,   min:1.5, css:d => `translate:${d.toFixed(2)}px 0` },
  skew:    { label:'기울기', easy:12,  hard:2.5, min:2,   css:d => `transform:skewX(${d.toFixed(2)}deg)` },
  sat:     { label:'채도',   easy:60,  hard:14,  min:12,  css:d => `filter:saturate(${Math.max(0,100-d).toFixed(0)}%)` },
  inset:   { label:'두께',   easy:10,  hard:2,   min:1.5, css:d => `box-shadow:inset 0 0 0 ${d.toFixed(1)}px #0E1116` },
};
export const AXIS_IDS = Object.keys(AXES);

export const SHAPES = ['square', 'circle', 'diamond', 'hexagon'];

const SPAN = 25;
export const TUNE_T = 4.4;

export function makeStage(rootKey, n, prevAnswer){
  const rnd  = stageRng(rootKey, n);
  const t    = Math.min((n - 1) / SPAN, 1);
  const ease = t * t * (3 - 2 * t);

  const g = GRIDS[Math.min(n - 1, GRIDS.length - 1)];
  const total = g.c * g.r;

  // 난수 소비 순서를 바꾸면 기존 시드의 문제가 전부 달라진다.
  // 축 → delta → 도형 → 색 → 정답 순서를 고정한다.
  const axis = AXIS_IDS[Math.floor(rnd() * AXIS_IDS.length)];
  const spec = AXES[axis];

  let delta = (spec.easy - ease * (spec.easy - spec.hard)) * (0.85 + rnd() * 0.3);
  delta = Math.max(delta, spec.min);

  const shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
  const hue   = Math.floor(rnd() * 360);

  const timeLimit = Math.max(1.6, 6.0 - ease * TUNE_T) + (total > 16 ? 0.5 : 0);

  let answer = Math.floor(rnd() * total);
  if (answer === prevAnswer && total > 1) answer = (answer + 1) % total;

  const stage = { n, cols:g.c, rows:g.r, total, answer, axis, delta, shape, hue, timeLimit };
  return validate(stage) ? stage : repair(stage);
}

// 공정성 검증 — 통과하지 못한 판은 플레이어에게 내보내지 않는다.
export function validate(s){
  if (!AXES[s.axis]) return false;
  if (!(s.delta >= AXES[s.axis].min)) return false;
  if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= s.total) return false;
  if (!(s.timeLimit > 0)) return false;
  return true;
}

function repair(s){
  const axis = AXES[s.axis] ? s.axis : 'rotate';
  return { ...s, axis, delta: AXES[axis].easy,
           answer: Math.min(Math.max(s.answer | 0, 0), s.total - 1),
           timeLimit: Math.max(1.6, s.timeLimit || 4) };
}

export function scoreOf(stage, elapsed, combo){
  const gridBonus = stage.total / 12;
  const speed     = Math.max(0.1, 1 - elapsed / stage.timeLimit);
  const comboMul  = 1 + Math.min(combo, 10) * 0.1;
  return Math.round(100 * gridBonus * (0.4 + speed * 0.6) * comboMul);
}
