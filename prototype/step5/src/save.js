// STEP 5에서 추가 — localStorage.
//
// 원칙 하나만 지킨다: **현재 판의 값은 저장하지 않는다.**
// 점수·스테이지·타이머를 저장하면 "새 게임에서 초기화하는 코드"를 따로 만들어야 하고,
// 그러면 반드시 빠뜨리는 항목이 생긴다. 저장하지 않는 것이 가장 확실한 초기화다.
//
// 저장하는 것: 최고 기록 / 설정 / 날짜 문자열. 개인정보·식별자는 저장하지 않는다.

const KEY = 'ooo.step5';

export const DEFAULT = {
  v: 1,
  best:   { stages: 0, points: 0 },
  daily:  { lastKey: null, bestStages: 0 },
  streak: { count: 0, lastPlayDate: null },
  settings: { sound: true, reducedMotion: false },
};

let memory = null;          // localStorage를 못 쓰는 환경(프라이빗 모드 등)의 폴백
let memoryOnly = false;

const clone = o => JSON.parse(JSON.stringify(o));

// DEFAULT를 기준으로 타입이 맞는 값만 채택하고 나머지는 기본값으로 채운다.
// 이게 있어야 저장값이 깨져도 게임이 실행된다.
function coerce(src, def){
  const out = clone(def);
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const k of Object.keys(def)){
    const d = def[k], v = src[k];
    if (v === undefined) continue;
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) out[k] = coerce(v, d);
    else if (d === null) out[k] = (typeof v === 'string') ? v : null;
    else if (typeof v === typeof d && (typeof v !== 'number' || isFinite(v))) out[k] = v;
  }
  return out;
}

export function load(){
  if (memoryOnly) return clone(memory);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null || raw === '') return clone(DEFAULT);   // 빈 값
    return coerce(JSON.parse(raw), DEFAULT);                  // "abc" → catch로 간다
  } catch {
    return clone(DEFAULT);                                    // 손상 → 조용히 기본값 (콘솔 오류 0)
  }
}

export function save(state){
  const safe = coerce(state, DEFAULT);
  try {
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    memoryOnly = true;      // 용량 초과 / 프라이빗 모드 → 메모리로 계속 진행한다
    memory = safe;
  }
  return safe;
}

export function reset(){
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
  memory = clone(DEFAULT);
  return clone(DEFAULT);
}

export const isMemoryOnly = () => memoryOnly;

// 연속 출석 — 날짜 문자열(YYYYMMDD)만 쓴다.
export function bumpStreak(state, todayKey){
  const s = state.streak;
  if (s.lastPlayDate === todayKey) return state;
  s.count = (s.lastPlayDate === yesterdayOf(todayKey)) ? s.count + 1 : 1;
  s.lastPlayDate = todayKey;
  return state;
}

function yesterdayOf(key){
  const y = +key.slice(0, 4), m = +key.slice(4, 6), d = +key.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}
