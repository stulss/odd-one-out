// localStorage — 손상된 값이 들어와도 게임은 반드시 실행된다.
// 개인정보·식별자는 저장하지 않는다. 점수 / 설정 / 날짜 문자열뿐이다.

const KEY = 'ooo.v1';

export type Mode = 'case' | 'normal' | 'practice' | 'blitz';
// 복장은 세계관(이상 감별국)에 맞춘 7종: 수습 제복 · 현장 수사관 · 공장 기술자 · 위장 수사관 · 도서관 감식관 · 야시장 정보원 · 수석 정복
export type Job = 'rookie' | 'field' | 'engineer' | 'disguise' | 'archivist' | 'street' | 'chief';
export type HeroAcc = 'none' | 'lens' | 'torch' | 'notebook';

/** 캐릭터 — 색은 heroData.ts의 팔레트 번호로 저장한다 (색 값 자체를 저장하지 않는다) */
export interface Hero {
  name: string;
  job: Job;
  hairColor: number;
  skin: number;
  outfit: number;
  acc: HeroAcc;
}

export interface Store {
  v: number;
  best: { stages: number; points: number; reaction: number | null };
  daily: { lastKey: string | null; bestStages: number };
  stats: { played: number; totalStages: number; totalTimeMs: number };
  streak: { count: number; lastPlayDate: string | null };
  settings: { sound: boolean; reducedMotion: boolean; tuneT: number; colorSafe: boolean; highContrast: boolean; hero3d: boolean; music: boolean };
  hero: Hero; // name이 비어 있으면 첫 실행
  prologue: boolean; // 프롤로그를 본 적이 있는가
  mode: Mode; // 마지막에 고른 모드
  coins: number; // 감별 코인 (소품·옷색·힌트에 쓴다)
  hints: number; // 보유 힌트 수 (사건에서 정답 칸을 한 번 비춘다)
  clocks: number; // 보유 시계 수 (현재 라운드 시간을 5초 늘린다)
  missions: { date: string; p: string; c: string }; // 오늘의 임무 진행도·수령 여부 (missions.ts)
  login: { date: string; streak: number }; // 출석 보상
  campaign: { stars: string }; // 사건별 별 수를 한 줄로: '3210…' (campaign.ts)
  codex: string; // 물건별 발견 횟수, 쉼표 구분
  unlocked: string; // 해금한 복장·소품·옷색 (예: 'job:mage,acc:staff')
  practiceAxis: string; // 연습 모드에서 고정할 차이 축 ('' = 무작위)
  bestBlitz: number; // 30초 도전 최고 단계
  ach: string; // 달성한 업적 id (쉼표 구분)
}

export const DEFAULT: Store = {
  v: 1,
  best: { stages: 0, points: 0, reaction: null },
  daily: { lastKey: null, bestStages: 0 },
  stats: { played: 0, totalStages: 0, totalTimeMs: 0 },
  streak: { count: 0, lastPlayDate: null },
  settings: { sound: true, reducedMotion: false, tuneT: 4.4, colorSafe: false, highContrast: false, hero3d: true, music: true },
  hero: { name: '', job: 'rookie', hairColor: 1, skin: 1, outfit: 0, acc: 'none' },
  prologue: false,
  mode: 'case',
  coins: 60,
  hints: 3,
  clocks: 2,
  missions: { date: '', p: '', c: '' },
  login: { date: '', streak: 0 },
  campaign: { stars: '' },
  codex: '',
  unlocked: '',
  practiceAxis: '',
  bestBlitz: 0,
  ach: '',
};

let memory: Store | null = null; // localStorage를 못 쓰는 환경(프라이빗 모드 등)의 폴백
let usingMemory = false;

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// DEFAULT를 기준으로 타입이 맞는 값만 채택한다. 나머지는 기본값으로 채운다.
function coerce<T extends object>(src: unknown, def: T): T {
  const out = clone(def) as Record<string, unknown>;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out as T;
  const input = src as Record<string, unknown>;
  const d0 = def as Record<string, unknown>;
  for (const k of Object.keys(d0)) {
    const d = d0[k];
    const v = input[k];
    if (v === undefined) continue;
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) out[k] = coerce(v, d as object);
    else if (d === null) out[k] = typeof v === 'number' && isFinite(v) ? v : null;
    else if (typeof v === typeof d && (typeof v !== 'number' || isFinite(v))) out[k] = v;
  }
  return out as T;
}

export function load(): Store {
  if (usingMemory && memory) return clone(memory);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null || raw === '') return clone(DEFAULT); // 빈 값
    return coerce(JSON.parse(raw), DEFAULT); // "abc" → SyntaxError로 catch / 필수 항목 누락 → 기본값 보충
  } catch {
    return clone(DEFAULT); // 손상 → 조용히 기본값 (콘솔 오류 0)
  }
}

export function save(state: Store): Store {
  const safe = coerce(state, DEFAULT);
  try {
    localStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    usingMemory = true; // 용량 초과 / 프라이빗 모드 → 메모리로 계속 진행
    memory = safe;
  }
  return safe;
}

export function reset(): Store {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
  memory = clone(DEFAULT);
  return clone(DEFAULT);
}

export const isMemoryOnly = () => usingMemory;

// 연속 출석 — 날짜 문자열(YYYYMMDD)만 쓴다
export function bumpStreak(state: Store, todayKey: string): Store {
  const s = state.streak;
  if (s.lastPlayDate === todayKey) return state;
  const y = yesterdayOf(todayKey);
  s.count = s.lastPlayDate === y ? s.count + 1 : 1;
  s.lastPlayDate = todayKey;
  return state;
}

export function yesterdayOf(key: string): string {
  const y = +key.slice(0, 4), m = +key.slice(4, 6), d = +key.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
}
