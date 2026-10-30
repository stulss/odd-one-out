// 플레이 기록 — 과제 카드 3(감이 아니라 데이터로 난이도 조정)용.
// 로컬 전용, 개인정보 미수집. 저장되는 건 숫자와 실패 원인 분류뿐이다.

const KEY = 'ooo.log.v1';
const MAX = 200;

export const FAIL_REASONS = {
  timeout: '시간 초과',
  wrong_streak: '오답 누적',
  quit: '중도 이탈',
} as const;
export type FailReason = keyof typeof FAIL_REASONS;

interface Row { t: number; stages: number; survivedMs: number; points: number; reason: FailReason; at: number }

const isRow = (r: unknown): r is Row => {
  const o = r as Row;
  return !!o && typeof o === 'object' && Number.isFinite(o.t) && Number.isFinite(o.stages) && Number.isFinite(o.survivedMs);
};

export function read(): Row[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(isRow) : [];
  } catch { return []; }
}

export function add(row: { tuneT: number; stages: number; survivedMs: number; points: number; reason: string }): Row[] {
  const rows = read();
  rows.push({
    t: +row.tuneT.toFixed(2),
    stages: row.stages | 0,
    survivedMs: row.survivedMs | 0,
    points: row.points | 0,
    reason: row.reason in FAIL_REASONS ? (row.reason as FailReason) : 'timeout',
    at: Date.now(),
  });
  while (rows.length > MAX) rows.shift();
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* 저장 실패는 게임을 막지 않는다 */ }
  return rows;
}

export function clear(): void {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

export function toCSV(): string {
  const rows = read();
  const head = '회차,난이도T,도달단계,생존시간초,점수,실패원인';
  const body = rows.map((r, i) =>
    [i + 1, r.t, r.stages, (r.survivedMs / 1000).toFixed(1), r.points, FAIL_REASONS[r.reason]].join(','));
  return [head, ...body].join('\n');
}

export interface LogGroup { tuneT: number; n: number; medianStages: number; medianSurvivalSec: number }

/** 난이도 값별로 묶어 중앙값을 낸다 — 전·후 비교의 근거 */
export function summary(): LogGroup[] {
  const groups = new Map<number, Row[]>();
  for (const r of read()) {
    if (!groups.has(r.t)) groups.set(r.t, []);
    groups.get(r.t)!.push(r);
  }
  return [...groups.entries()]
    .map(([t, rows]) => ({
      tuneT: t,
      n: rows.length,
      medianStages: median(rows.map(r => r.stages)),
      medianSurvivalSec: +(median(rows.map(r => r.survivedMs)) / 1000).toFixed(1),
    }))
    .sort((a, b) => a.tuneT - b.tuneT);
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
