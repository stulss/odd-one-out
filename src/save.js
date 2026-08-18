// localStorage — 손상된 값이 들어와도 게임은 반드시 실행된다.
// 개인정보·식별자는 저장하지 않는다. 점수 / 설정 / 날짜 문자열뿐이다.

const KEY = 'ooo.v1';

export const DEFAULT = {
  v: 1,
  best:   { stages: 0, points: 0, reaction: null },
  daily:  { lastKey: null, bestStages: 0 },
  stats:  { played: 0, totalStages: 0, totalTimeMs: 0 },
  streak: { count: 0, lastPlayDate: null },
  settings: { sound: true, reducedMotion: false, tuneT: 4.4 },
};

let memory = null;          // localStorage를 못 쓰는 환경(프라이빗 모드 등)의 폴백
let usingMemory = false;

// DEFAULT를 기준으로 타입이 맞는 값만 채택한다. 나머지는 기본값으로 채운다.
function coerce(src, def){
  const out = clone(def);
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const k of Object.keys(def)){
    const d = def[k], v = src[k];
    if (v === undefined) continue;
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) out[k] = coerce(v, d);
    else if (d === null) out[k] = (typeof v === 'number' && isFinite(v)) ? v : null;
    else if (typeof v === typeof d && (typeof v !== 'number' || isFinite(v))) out[k] = v;
  }
  return out;
}

const clone = o => JSON.parse(JSON.stringify(o));

export function load(){
  if (usingMemory) return clone(memory);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null || raw === '') return clone(DEFAULT);       // 빈 값
    const parsed = JSON.parse(raw);                               // "abc" → SyntaxError로 catch
    return coerce(parsed, DEFAULT);                               // 필수 항목 누락 → 기본값으로 보충
  } catch {
    return clone(DEFAULT);                                        // 손상 → 조용히 기본값 (콘솔 오류 0)
  }
}

export function save(state){
  const safe = coerce(state, DEFAULT);
  try {
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    usingMemory = true;                 // 용량 초과 / 프라이빗 모드 → 메모리로 계속 진행
    memory = safe;
  }
  return safe;
}

export function reset(){
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
  memory = clone(DEFAULT);
  return clone(DEFAULT);
}

export const isMemoryOnly = () => usingMemory;

// 연속 출석 — 날짜 문자열(YYYYMMDD)만 쓴다
export function bumpStreak(state, todayKey){
  const s = state.streak;
  if (s.lastPlayDate === todayKey) return state;
  const y = yesterdayOf(todayKey);
  s.count = (s.lastPlayDate === y) ? s.count + 1 : 1;
  s.lastPlayDate = todayKey;
  return state;
}

function yesterdayOf(key){
  const y = +key.slice(0, 4), m = +key.slice(4, 6), d = +key.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}
