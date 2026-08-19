// STEP 6에서 추가 — 플레이 기록.
//
// 목적 하나뿐이다: **난이도를 감이 아니라 데이터로 정하기 위해서.**
// 판마다 (난이도T, 도달단계, 생존시간, 실패원인)을 남기고, 난이도 값별로 중앙값을 낸다.
// 개인정보는 수집하지 않는다. 숫자와 분류값뿐이다.

const KEY = 'ooo.step6.log';
const MAX = 200;

export const REASONS = { timeout:'시간 초과', wrong_streak:'오답 누적', quit:'중도 이탈' };

export function read(){
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a.filter(isRow) : [];
  } catch { return []; }
}

const isRow = r => r && typeof r === 'object'
  && Number.isFinite(r.t) && Number.isFinite(r.stages) && Number.isFinite(r.ms);

export function add(row){
  const rows = read();
  rows.push({
    t: +Number(row.tuneT).toFixed(2),
    stages: row.stages | 0,
    ms: row.survivedMs | 0,
    points: row.points | 0,
    reason: REASONS[row.reason] ? row.reason : 'timeout',
    at: Date.now(),
  });
  while (rows.length > MAX) rows.shift();
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* 무시 */ }
  return rows;
}

export function clear(){ try { localStorage.removeItem(KEY); } catch {} }

export function toCSV(){
  const rows = read();
  const head = '회차,난이도T,도달단계,생존시간초,점수,실패원인';
  return [head, ...rows.map((r,i) =>
    [i+1, r.t, r.stages, (r.ms/1000).toFixed(1), r.points, REASONS[r.reason]].join(','))].join('\n');
}

const median = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x,y) => x-y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
};

// 난이도 값별 묶음. 전·후 비교의 근거가 되는 표다.
export function summary(){
  const g = new Map();
  for (const r of read()){
    if (!g.has(r.t)) g.set(r.t, []);
    g.get(r.t).push(r);
  }
  return [...g.entries()].sort((a,b) => a[0]-b[0]).map(([t, rows]) => ({
    tuneT: t, n: rows.length,
    medianStages: median(rows.map(r => r.stages)),
    medianSec: +(median(rows.map(r => r.ms)) / 1000).toFixed(1),
  }));
}

export function summaryText(){
  const s = summary();
  if (!s.length) return '아직 기록이 없습니다';
  return s.map(g => `T=${g.tuneT}: ${g.n}회 · 중앙값 ${g.medianStages}단계 / ${g.medianSec}초`).join('\n');
}
