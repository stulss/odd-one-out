// 감별 사건부 — 캠페인 데이터와 규칙. 순수 함수만 둔다 (화면·저장소 접근 없음).
//
// 구조: 6개 구역(story.ts) × 사건 3개 = 18개 사건. 사건마다 여러 '라운드'(= 다른 점 찾기 한 판)를 풀고,
// 시간 안에 끝내면 클리어, 오답과 속도로 별 1~3개를 받는다. 각 구역의 마지막 사건(finale)은 라운드가 많고,
// 클리어하면 새 복장이 해금된다. 코인은 소품·옷색·힌트에, 도감은 물건을 많이 찾을수록 보상을 준다.
import type { Job, Store } from './save';
import { OBJECT_COUNT } from './objects';
import { ZONES, tierOf } from './story';

export const CASES_PER_ZONE = 3;
export const MAX_STARS = 3;

export interface CaseDef {
  id: number; // 1부터
  zone: number; // ZONES 인덱스
  title: string;
  brief: string;
  rounds: number;
  startN: number; // 첫 라운드의 난이도 단계 (stage.ts의 n)
  finale: boolean; // 구역의 마지막 사건 (보스)
}

const TEXT: [string, string][] = [
  ['첫 번째 의뢰', '분실물 보관함에 복제품이 하나 섞여 있어요. 가려내 보세요.'],
  ['쌍둥이 선반', '똑같이 생긴 물건들 틈에 가짜가 있어요. 천천히, 정확하게.'],
  ['수습 졸업 시험', '수습 과정의 마지막 시험이에요. 눈을 크게 뜨세요!'],
  ['컨베이어 오작동', '공장 라인이 멈추지 않아요. 흘러가는 물건 중 불량품을 찾아요.'],
  ['불량품 검수', '검수대에 올라온 물건이 너무 많아요. 서두르면 놓쳐요.'],
  ['공장장의 부탁', '공장장이 직접 의뢰했어요. 이번엔 라운드가 길어요.'],
  ['거울 속의 거울', '거울이 거울을 비추고 있어요. 어디가 진짜일까요?'],
  ['끝없는 복도', '복도마다 같은 물건이 놓여 있어요. 하나만 달라요.'],
  ['거울 마녀의 시험', '마녀가 낸 문제예요. 차이가 아주 미묘해요.'],
  ['금서 목록', '도서관에서 사라진 책의 복제본을 찾아요.'],
  ['안개 속 속삭임', '안개가 짙어요. 색에만 속지 말고 전체를 보세요.'],
  ['사서의 비밀', '사서가 숨겨 둔 마지막 서가예요.'],
  ['야시장 소동', '번쩍이는 간판 아래 가짜가 팔리고 있어요.'],
  ['번쩍이는 가짜', '눈이 부셔도 하나는 분명히 달라요.'],
  ['시장 대결', '시장 상인회와의 대결이에요. 실력을 보여 주세요.'],
  ['봉인 창고', '격납고 깊은 곳, 오래 봉인된 창고예요.'],
  ['마지막 복제기', '모든 복제품을 만들어 낸 기계가 눈앞에 있어요.'],
  ['원본을 찾아서', '이제 진짜 원본을 가려낼 시간이에요.'],
];

export const CASES: CaseDef[] = TEXT.map(([title, brief], i) => {
  const finale = (i + 1) % CASES_PER_ZONE === 0;
  return {
    id: i + 1,
    zone: Math.floor(i / CASES_PER_ZONE),
    title, brief,
    rounds: finale ? 7 : 5,
    startN: i * 2 + 1, // 사건이 진행될수록 단계가 올라간다 (사건 18의 마지막 라운드 ≈ 41단계)
    finale,
  };
});
export const TOTAL_CASES = CASES.length;
export const zoneHue = (zone: number) => ZONES[zone]?.hue ?? 160;
export const zoneName = (zone: number) => ZONES[zone]?.name ?? '';

// ── 진행도 (별 3개까지, 문자열 한 줄로 저장: '3210…') ──────────────────
export const starsOf = (store: Pick<Store, 'campaign'>, idx: number): number =>
  Math.min(MAX_STARS, Math.max(0, Number(store.campaign.stars[idx] ?? 0) || 0));

export function setStars(store: Store, idx: number, stars: number): void {
  const arr = store.campaign.stars.padEnd(TOTAL_CASES, '0').split('');
  arr[idx] = String(Math.max(starsOf(store, idx), Math.min(MAX_STARS, stars)));
  store.campaign.stars = arr.join('');
}

export const clearedCount = (s: Pick<Store, 'campaign'>) => CASES.filter((_, i) => starsOf(s, i) >= 1).length;
export const totalStars = (s: Pick<Store, 'campaign'>) => CASES.reduce((a, _, i) => a + starsOf(s, i), 0);
export const threeStarCount = (s: Pick<Store, 'campaign'>) => CASES.filter((_, i) => starsOf(s, i) >= MAX_STARS).length;
/** 앞 사건을 클리어해야 열린다 */
export const isCaseUnlocked = (s: Pick<Store, 'campaign'>, idx: number) => idx === 0 || starsOf(s, idx - 1) >= 1;
/** 지금 도전할 사건(처음으로 아직 클리어하지 못한 사건). 전부 클리어했으면 마지막 사건 */
export const currentCase = (s: Pick<Store, 'campaign'>) => {
  const i = CASES.findIndex((_, k) => starsOf(s, k) === 0);
  return i < 0 ? TOTAL_CASES - 1 : i;
};

/** 별 평가: 클리어 1★ · 오답 1회 이하 2★ · 오답 없이 빠르면 3★ */
export function rateCase(wrongs: number, avgTimeRatio: number): number {
  if (wrongs === 0 && avgTimeRatio < 0.55) return 3;
  if (wrongs <= 1) return 2;
  return 1;
}

/** 클리어 보상 코인: 기본 + 별 수 + (첫 클리어) + (새로 얻은 별) */
export function caseCoins(stars: number, firstClear: boolean, newStars: number): number {
  return 8 + stars * 4 + (firstClear ? 10 : 0) + newStars * 5;
}

/** 구역 마지막 사건을 클리어하면 받는 복장 (사건 번호 → 직업) */
export const FINALE_JOB: Record<number, Job> = { 3: 'mage', 6: 'ninja', 9: 'cleric', 12: 'nomad', 15: 'rogue' };
export const FINALE_COINS = 100; // 사건 18 보상

// ── 해금 (옷장) ─────────────────────────────────────────────
export type UnlockKind = 'job' | 'acc' | 'outfit';
export const ACC_PRICE: Record<string, number> = { staff: 30, flower: 30 };
export const OUTFIT_FREE = 3; // 옷색 앞 3개는 처음부터 쓸 수 있다
export const OUTFIT_PRICE = 15;
export const HINT_PRICE = 30; // 힌트 3개 묶음
export const HINT_PACK = 3;

const parse = (s: string) => new Set(s.split(',').filter(Boolean));
export const unlockId = (kind: UnlockKind, key: string | number) => `${kind}:${key}`;

export function isUnlocked(store: Pick<Store, 'unlocked'>, kind: UnlockKind, key: string | number): boolean {
  if (kind === 'job' && key === 'detective') return true;
  if (kind === 'acc' && !(String(key) in ACC_PRICE)) return true; // none · lens 는 무료
  if (kind === 'outfit' && Number(key) < OUTFIT_FREE) return true;
  return parse(store.unlocked).has(unlockId(kind, key));
}

export function unlock(store: Store, kind: UnlockKind, key: string | number): void {
  const set = parse(store.unlocked);
  set.add(unlockId(kind, key));
  store.unlocked = [...set].join(',');
}

export function priceOf(kind: UnlockKind, key: string | number): number | null {
  if (kind === 'acc') return ACC_PRICE[String(key)] ?? null;
  if (kind === 'outfit') return OUTFIT_PRICE;
  return null; // 복장은 코인으로 살 수 없다 — 사건을 클리어해야 한다
}

/** 해금 안 된 값을 쓰고 있으면 무료 기본값으로 되돌린다 */
export function enforceUnlocks<T extends { job: Job; acc: string; outfit: number }>(store: Pick<Store, 'unlocked'>, h: T): T {
  return {
    ...h,
    job: isUnlocked(store, 'job', h.job) ? h.job : 'detective',
    acc: isUnlocked(store, 'acc', h.acc) ? h.acc : 'none',
    outfit: isUnlocked(store, 'outfit', h.outfit) ? h.outfit : 0,
  };
}

// ── 도감: 물건별 발견 횟수 ───────────────────────────────────
export const CODEX_MILESTONES = [10, 50, 200];
export const CODEX_REWARDS = [20, 50, 100];

export function readCodex(store: Pick<Store, 'codex'>): number[] {
  const a = store.codex.split(',').map(v => Math.max(0, Math.trunc(Number(v)) || 0));
  return Array.from({ length: OBJECT_COUNT }, (_, i) => a[i] ?? 0);
}
export const codexFound = (s: Pick<Store, 'codex'>) => readCodex(s).filter(n => n > 0).length;

/** 발견 횟수를 올리고, 이번에 넘은 마일스톤의 보상 코인을 돌려준다 */
export function addCodex(store: Store, kind: number): number {
  const a = readCodex(store);
  const before = a[kind];
  a[kind] = before + 1;
  store.codex = a.join(',');
  let coins = 0;
  CODEX_MILESTONES.forEach((m, i) => { if (before < m && a[kind] >= m) coins += CODEX_REWARDS[i]; });
  return coins;
}

/** 캐릭터 진화 단계: 사건부 진행도와 무한 모드 최고 기록 중 높은 쪽 */
export const heroTier = (s: Pick<Store, 'campaign' | 'best'>) => Math.max(tierOf(s.best.stages), campaignTier(s));

/** 진행도에 따른 등급(0~5): 구역을 마칠 때마다 한 단계. 무한 모드의 등급과 큰 쪽을 쓴다. */
export function campaignTier(store: Pick<Store, 'campaign'>): number {
  return Math.min(5, Math.floor(clearedCount(store) / CASES_PER_ZONE));
}
