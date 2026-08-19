// 스테이지 생성 + 공정성 검증
import { stageRng } from './rng.js';

// ── Q-6 수정 ────────────────────────────────────────────────
// 그리드는 스테이지 번호로만 결정한다. 화면 크기에 의존하면 같은 시드라도
// 기기마다 다른 문제가 나와 오늘의 문제/도전장이 성립하지 않는다.
// 칸 수 상한 4x6=24는 360px 기기에서도 44px 터치 타깃이 보장되는 최대치다.
// 난이도는 칸 수가 아니라 delta(차이의 미묘함)로 올린다.
const GRIDS = [
  { c:2, r:3 }, { c:2, r:3 }, { c:3, r:3 }, { c:3, r:4 }, { c:3, r:4 },
  { c:4, r:4 }, { c:4, r:4 }, { c:4, r:5 }, { c:4, r:5 }, { c:4, r:6 },
];

export const SHAPES = ['square', 'circle', 'diamond', 'hexagon'];

// 차이 축 10종. easy → hard 로 delta가 줄어들수록 어려워진다.
export const DIFF_AXES = {
  hue:     { label:'색조',   easy:40,  hard:6,   min:5,   css:d => `filter:hue-rotate(${d}deg)` },
  light:   { label:'밝기',   easy:24,  hard:5,   min:4,   css:d => `filter:brightness(${100 + d}%)` },
  size:    { label:'크기',   easy:18,  hard:3.5, min:3,   css:d => `scale:${(1 + d / 100).toFixed(3)}` },
  rotate:  { label:'회전',   easy:20,  hard:3,   min:2.5, css:d => `rotate:${d.toFixed(2)}deg` },
  radius:  { label:'모서리', easy:38,  hard:8,   min:6,   css:d => `border-radius:${Math.max(0, 40 - d)}%` },
  opacity: { label:'투명도', easy:26,  hard:7,   min:6,   css:d => `opacity:${(1 - d / 100).toFixed(3)}` },
  offset:  { label:'위치',   easy:9,   hard:2,   min:1.5, css:d => `translate:${d.toFixed(2)}px 0` },
  skew:    { label:'기울기', easy:12,  hard:2.5, min:2,   css:d => `transform:skewX(${d.toFixed(2)}deg)` },
  sat:     { label:'채도',   easy:60,  hard:14,  min:12,  css:d => `filter:saturate(${100 - d}%)` },
  inset:   { label:'두께',   easy:10,  hard:2,   min:1.5, css:d => `box-shadow:inset 0 0 0 ${d.toFixed(1)}px #0E1116` },
};
const AXIS_IDS = Object.keys(DIFF_AXES);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;

// 난이도 상수의 기준값. T = T_BASE 이면 기존과 같은 속도로 좁혀진다.
export const T_BASE = 4.4;

/**
 * @param rootKey 시드 문자열 (오늘의 문제 키 / 도전장 코드 / 자유 플레이 시드)
 * @param n       스테이지 번호 (1부터)
 * @param tuneT   난이도 상수 — 이 값 하나만 조정한다 (과제 카드 3)
 * @param prev    직전 스테이지 (정답 위치 연속 중복 방지)
 */
export function makeStage(rootKey, n, tuneT, prev){
  const rnd  = stageRng(rootKey, n);
  const t    = Math.min((n - 1) / 40, 1);
  const ease = t * t * (3 - 2 * t);                 // 초반 완만, 후반 급격

  const g     = GRIDS[Math.min(n - 1, GRIDS.length - 1)];
  const total = g.c * g.r;

  const axis = AXIS_IDS[Math.floor(rnd() * AXIS_IDS.length)];
  const spec = DIFF_AXES[axis];

  // ── 난이도 손잡이를 '차이 곡선'에 건다 ────────────────────────
  // 이전에는 T가 제한 시간만 줄였는데, 자동 플레이 30판으로 재보니
  // 시간이 부족해지는 시점(30단계)이 판이 끝나는 시점(20~25단계)보다 늦어서
  // T를 50% 바꿔도 도달 단계가 1.5단계밖에 안 움직였다.
  // 판을 실제로 끝내는 것은 '차이가 좁아져 못 찾는 것'이므로 거기에 건다.
  const dEase = clamp(ease * (tuneT / T_BASE), 0, 1);

  // delta: easy → hard 로 좁혀지되 ±15% 흔들어 패턴 학습을 막는다
  let delta = lerp(spec.easy, spec.hard, dEase) * (0.85 + rnd() * 0.3);
  delta = Math.max(delta, spec.min);                // 공정성: 지각 임계값 아래로 내려가지 않는다

  // 제한 시간은 고정 계수를 쓴다. 손잡이는 위의 차이 곡선 하나뿐이다.
  const timeLimit = Math.max(1.6, 6.0 - ease * T_BASE) + (total > 16 ? 0.5 : 0);

  let answer = Math.floor(rnd() * total);
  if (prev && total > 1 && answer === prev.answer) answer = (answer + 1 + Math.floor(rnd() * (total - 1))) % total;

  const stage = {
    n, cols: g.c, rows: g.r, total, answer, axis, delta,
    timeLimit,
    shape: SHAPES[Math.floor(rnd() * SHAPES.length)],
    hue: Math.floor(rnd() * 360),
  };

  return validate(stage) ? stage : relax(stage);
}

// 공정성 검증 — 이게 없으면 "억울한 실패"가 생기고 플레이어는 돌아오지 않는다
export function validate(s){
  if (!DIFF_AXES[s.axis]) return false;
  if (!(s.delta >= DIFF_AXES[s.axis].min)) return false;   // ① 지각 임계값
  if (!Number.isInteger(s.answer) || s.answer < 0 || s.answer >= s.total) return false;  // ② 정답이 판 안에
  if (!(s.timeLimit > 0)) return false;
  return true;                                              // ③ 정답 1개는 구조상 보장 (answer 인덱스 단 하나)
}

function relax(s){
  const spec = DIFF_AXES[s.axis] || DIFF_AXES.rotate;
  return { ...s, axis: DIFF_AXES[s.axis] ? s.axis : 'rotate',
           delta: spec.easy,
           answer: clamp(s.answer | 0, 0, s.total - 1),
           timeLimit: Math.max(1.6, s.timeLimit || 4) };
}

export function axisLabel(id){ return DIFF_AXES[id]?.label ?? id; }
