// GameEngine — 게임 규칙과 상태 머신. React를 모른다.
// 상태: HERO(캐릭터 만들기) → STORY(프롤로그) → TITLE → PLAY ⇄ PAUSED → RESULT
//       PLAY 도중 구역이 바뀌면 STORY(구역 소개)를 거쳐 PLAY로 돌아온다 (소개 중에는 타이머가 멈춰 있다)
//
// React와의 접점은 둘뿐이다.
//  1) subscribe/getSnapshot — useSyncExternalStore가 화면을 다시 그릴 때 쓰는 불변 스냅샷
//  2) onTick / onFx         — 매 프레임 게이지·파티클처럼 '리렌더 없이' 처리해야 하는 이벤트
import { makeStage, type Stage } from './stage';
import { ACHIEVEMENTS, evaluate, owned } from './achieve';
import { createTimer, type Timer } from './timer';
import * as Save from './save';
import type { Hero, Mode, Store } from './save';
import * as Log from './logger';
import * as Audio from './audio';
import * as Share from './share';
import { drawCard, toBlob, type CardData } from './card';
import {
  type Challenge, readChallenge, todayKeyKST, shareUrl, challengeLabel, freeChallenge, dailyChallenge,
} from './daily';
import { PROLOGUE, zoneOf, rankOf, tierOf, closingLine, fill, type DialogLine } from './story';
import { JOBS, normalizeHero } from './heroData';
import { bossOf, type BossDef } from './bosses';
import { Music } from './music';
import { MODS, rollModifier, type ModId } from './modifiers';
import * as Missions from './missions';
import type { Mission } from './missions';
import {
  CASES, FINALE_COINS, FINALE_JOB, HINT_PACK, HINT_PRICE, addCodex, campaignTier, caseCoins, enforceUnlocks,
  heroTier, isCaseUnlocked, isUnlocked, migrateUnlocked, priceOf, rateCase, setStars, starsOf, unlock, zoneHue, type UnlockKind,
} from './campaign';

export const MODES: Record<Mode, { label: string; desc: string }> = {
  case:     { label: '사건부',    desc: '사건을 하나씩 해결하며 별·코인·새 복장을 모으는 메인 모드.' },
  normal:   { label: '일반',      desc: '단계마다 제한 시간. 시간이 0이 되면 종료.' },
  blitz:    { label: '30초 도전', desc: '전체 30초 안에 몇 단계까지? 오답은 1초 차감.' },
  practice: { label: '연습',      desc: '시간 제한 없음. 약한 차이 유형만 골라 연습. 기록은 남지 않습니다.' },
};
const BLITZ_SEC = 30;
const LOCK_MS = 120; // 조작 1회 = 결과 1회. 연타·멀티터치로 상태가 꼬이면 안 된다.

export type Screen = 'TITLE' | 'PLAY' | 'PAUSED' | 'RESULT' | 'HERO' | 'STORY' | 'MAP' | 'CASE_RESULT' | 'CODEX';
export type Mood = 'idle' | 'happy' | 'dizzy';
type FailReason = 'timeout' | 'wrong_streak';

interface Run {
  n: number; points: number; combo: number; maxCombo: number;
  reactions: number[]; wrongs: number; wrongStreak: number;
  startedAt: number; stage: Stage | null; prev: Stage | null;
  stageStart: number; pausedAt: number; mode: Mode;
  caseIdx: number; round: number; rootKey: string; ratios: number[]; // 사건부 전용
  mod: ModId | null; bonus: number; // 이번 라운드의 변주 / 변주로 모은 보너스 코인
}

export interface DialogRequest {
  id: number;
  lines: DialogLine[];
  hero: Hero;
  card: { k: string; n: string } | null; // 상단에 띄우는 구역/사건 카드
  hold: number;
  cine: CineInfo | null; // 컷신 연출 (레터박스·배경·보스). null이면 평범한 대사 상자
}

export interface CineInfo {
  hue: number; // 구역 색
  tier: number; // 주인공 진화 단계
  banner?: string; // 'WARNING' 같은 가로지르는 띠
  boss?: BossDef;
  defeated?: boolean; // 보스가 쓰러진 뒤의 장면
}

export interface BossInfo { def: BossDef; hp: number; maxHp: number; hitId: number; taunt: { id: number; text: string } | null }

export interface CaseRunInfo { idx: number; id: number; round: number; rounds: number; title: string; zone: number }

export interface CaseResultInfo {
  idx: number; title: string; success: boolean;
  stars: number; prevStars: number; coins: number; firstClear: boolean;
  wrongs: number; avgReaction: number | null; roundsDone: number; rounds: number;
  unlockText: string; ach: string; hasNext: boolean; tier: number; promoted: boolean; npc: string; bonus: number;
}

export interface ResultInfo {
  stages: number;
  title: string;
  sub: string;
  best: string;
  isBest: boolean;
  rank: string;
  npc: string;
  ach: string;
  tier: number;
  promoted: boolean;
  card: CardData;
}

export interface Snapshot {
  screen: Screen;
  store: Store;
  challenge: Challenge;
  stage: Stage | null;
  stageId: number; // 새 판이 그려질 때마다 증가 (Board가 등장 연출을 다시 거는 기준)
  n: number; points: number; combo: number; mode: Mode;
  mood: Mood;
  themeHue: number;
  dialog: DialogRequest | null;
  result: ResultInfo | null;
  caseRun: CaseRunInfo | null;
  caseResult: CaseResultInfo | null;
  hintIndex: number | null; // 힌트로 비추는 칸
  boss: BossInfo | null; // 보스전 중일 때만
  modifier: ModId | null; // 이번 라운드의 변주 (사건부)
  missions: Mission[]; // 오늘의 임무
  fallback: { visible: boolean; text: string; url: string };
  toast: { id: number; msg: string } | null;
  announce: { id: number; msg: string };
  log: { count: number; lines: string[] };
}

export type FxEvent =
  | { type: 'correct'; index: number; power: number; hue: number; milestone: boolean; gain: number; fast: boolean; combo: number; coins: number }
  | { type: 'modifier'; mod: ModId }
  | { type: 'confetti'; big: boolean }
  | { type: 'wrong'; index: number }
  | { type: 'over' }
  | { type: 'stage' }
  | { type: 'zone'; hue: number }
  | { type: 'bossDown' };

type Listener = () => void;

export function createEngine() {
  let store = Save.load();
  store.hero = normalizeHero(store.hero); // 예전 버전의 캐릭터 값이 남아 있어도 현재 선택지 안으로 맞춘다
  store.unlocked = migrateUnlocked(store.unlocked);
  // 사건부 이전 버전에서 이미 캐릭터를 만든 사람: 지금 쓰고 있는 복장·소품·옷색은 잠그지 않는다
  if (store.hero.name && store.unlocked === '' && store.campaign.stars === '') {
    unlock(store, 'job', store.hero.job);
    unlock(store, 'acc', store.hero.acc);
    unlock(store, 'outfit', store.hero.outfit);
    store = Save.save(store);
  }
  let challenge = readChallenge();
  let screen: Screen = 'TITLE';
  let mood: Mood = 'idle';
  let themeHue = zoneOf(1).hue;
  let dialog: DialogRequest | null = null;
  let dialogDone: (() => void) | null = null;
  let result: ResultInfo | null = null;
  let caseResult: CaseResultInfo | null = null;
  let hintIndex: number | null = null;
  let hintTimer = 0;
  let lastTickSec = -1;
  let bossHp = 0, bossHit = 0, bossTaunt: BossInfo['taunt'] = null, tauntTimer = 0;
  let codexBack: Screen = 'TITLE';
  let cardBlob: Blob | null = null;
  let fallback = { visible: false, text: '', url: '' };
  let toastState: Snapshot['toast'] = null;
  let announceState = { id: 0, msg: '' };
  let stageId = 0;
  let seq = 0;
  let locked = false;
  let moodTimer = 0;

  const freshRun = (): Run => ({
    n: 1, points: 0, combo: 0, maxCombo: 0,
    reactions: [], wrongs: 0, wrongStreak: 0,
    startedAt: 0, stage: null, prev: null, stageStart: 0, pausedAt: 0, mode: 'normal',
    caseIdx: -1, round: 1, rootKey: '', ratios: [], mod: null, bonus: 0,
  });
  let run = freshRun();

  // ── 구독 ────────────────────────────────────────────────
  const listeners = new Set<Listener>();
  const tickListeners = new Set<(left: number, limit: number) => void>();
  const fxListeners = new Set<(e: FxEvent) => void>();
  let snapshot: Snapshot;

  function caseRunInfo(): CaseRunInfo | null {
    if (run.mode !== 'case' || run.caseIdx < 0) return null;
    const d = CASES[run.caseIdx];
    return { idx: run.caseIdx, id: d.id, round: run.round, rounds: d.rounds, title: d.title, zone: d.zone };
  }

  function bossInfo(): BossInfo | null {
    if (run.mode !== 'case' || run.caseIdx < 0) return null;
    if (screen !== 'PLAY' && screen !== 'PAUSED' && screen !== 'STORY') return null; // 결과·지도 화면에는 체력바를 남기지 않는다
    const def = bossOf(CASES[run.caseIdx].id);
    if (!def) return null;
    return { def, hp: bossHp, maxHp: CASES[run.caseIdx].rounds, hitId: bossHit, taunt: bossTaunt };
  }

  function say(text: string, ms = 2200) {
    bossTaunt = { id: ++seq, text };
    window.clearTimeout(tauntTimer);
    tauntTimer = window.setTimeout(() => { bossTaunt = null; emit(); }, ms);
  }

  function build(): Snapshot {
    const logRows = Log.read();
    return {
      screen, store, challenge, stage: run.stage, stageId,
      n: run.n, points: run.points, combo: run.combo, mode: run.mode,
      mood, themeHue, dialog, result, caseRun: caseRunInfo(), caseResult, hintIndex, boss: bossInfo(), modifier: run.mode === 'case' ? run.mod : null, missions: Missions.list(store, todayKeyKST()), fallback, toast: toastState, announce: announceState,
      log: {
        count: logRows.length,
        lines: Log.summary().map(g => `T=${g.tuneT}: ${g.n}회 · 중앙값 ${g.medianStages}단계 / ${g.medianSurvivalSec}초`),
      },
    };
  }
  function emit() {
    syncMusic();
    snapshot = build();
    listeners.forEach(l => l());
  }
  const fx = (e: FxEvent) => fxListeners.forEach(l => l(e));

  const timer: Timer = createTimer({
    onTick: (left, limit) => {
      tickListeners.forEach(l => l(left, limit));
      if (run.mode === 'practice') return;
      // 제한 시간이 줄수록 음악이 긴박해지고, 마지막 3초는 초침 소리가 난다
      const r = left / limit;
      const boss = run.mode === 'case' && run.caseIdx >= 0 && !!bossOf(CASES[run.caseIdx].id);
      Music.setIntensity(Math.max(r < 0.35 ? 1 - r / 0.35 : 0, boss ? 0.3 : 0));
      const sec = Math.ceil(left);
      if (left <= 3 && left > 0 && sec !== lastTickSec) { lastTickSec = sec; Audio.sfx.tick(); }
    },
    onZero: () => gameOver('timeout'),
  });

  // ── 보조 ────────────────────────────────────────────────
  // 도전장·오늘의 문제는 항상 일반 모드다 (같은 규칙이어야 점수 비교가 성립한다)
  // (사건부는 startCase로만 시작하므로, 이 경로로 들어온 '사건부' 선택은 일반 모드로 취급한다)
  const activeMode = (): Mode => (challenge.type === 'free' && store.mode !== 'case' ? store.mode : 'normal');
  const announce = (msg: string) => { announceState = { id: ++seq, msg }; };
  const toast = (msg: string) => { toastState = { id: ++seq, msg }; emit(); };

  function setMood(m: Mood, ms = 650) {
    mood = m;
    clearTimeout(moodTimer);
    if (m !== 'idle') moodTimer = window.setTimeout(() => { mood = 'idle'; emit(); }, ms);
  }

  function show(s: Screen) { screen = s; }

  function applySettings() {
    Audio.setMuted(!store.settings.sound);
  }

  // ── 판 진행 ─────────────────────────────────────────────
  function newGame() {
    run = freshRun(); // ★ 현재 판 값은 전부 초기화 (과제 완료기준 3)
    run.mode = activeMode();
    run.startedAt = performance.now();
    cardBlob = null;
    result = null;
    fallback = { ...fallback, visible: false };
    setMood('idle');
    show('PLAY');
    nextStage();
  }

  function nextStage() {
    const base = makeStage(run.mode === 'case' ? run.rootKey : challenge.rootKey, run.n, store.settings.tuneT, run.prev,
      run.mode === 'practice' ? store.practiceAxis : undefined);
    run.mod = null;
    lastTickSec = -1;
    if (run.mode === 'case') { // 사건부: 일부 라운드에 변주 (시간·보상만 바뀌고 퍼즐은 그대로)
      const def = CASES[run.caseIdx];
      run.mod = rollModifier(run.rootKey, run.round, def.rounds, !!bossOf(def.id), def.id);
    }
    const s: Stage = run.mod ? { ...base, timeLimit: base.timeLimit * MODS[run.mod].timeMul } : base;
    run.stage = s;
    run.prev = s;
    run.stageStart = performance.now();
    stageId++;
    themeHue = run.mode === 'case' ? zoneHue(CASES[run.caseIdx].zone) : zoneOf(run.n).hue;
    hintIndex = null;
    announce(run.mode === 'case' ? `라운드 ${run.round}${run.mod ? ' · ' + MODS[run.mod].label : ''}` : `단계 ${run.n}`);
    fx({ type: 'stage' });
    if (run.mod) { fx({ type: 'modifier', mod: run.mod }); if (run.mod === 'rush') Audio.sfx.rush(); }

    // 일반 모드에서 새 구역에 들어서면 이야기를 먼저 보여 준다. 소개가 끝나야 타이머가 돈다.
    const z = zoneOf(run.n);
    if (run.mode === 'normal' && run.n > 1 && z.first) {
      timer.stop();
      fx({ type: 'zone', hue: z.hue });
      const name = store.hero.name;
      const lines: DialogLine[] = z.lines.map(t => ({ who: 'npc', text: fill(t, name) }));
      const tNow = tierOf(run.n - 1);
      if (tNow > tierOf(run.n - 2)) { // 이 구역에 들어오며 등급이 올랐다
        lines.push({ who: 'sys', tier: tNow, text: `${name}, '${rankOf(run.n - 1)}'(으)로 승급했다!` });
      }
      play(lines, { k: `ZONE ${z.idx + 1}`, n: z.name }, 550, () => { show('PLAY'); startClock(s); emit(); });
      show('STORY');
    } else {
      startClock(s);
    }
    emit();
  }

  function startClock(s: Stage) {
    run.stageStart = performance.now();
    if (run.mode === 'normal' || run.mode === 'case') timer.start(s.timeLimit);
    else if (run.mode === 'blitz' && run.n === 1) timer.start(BLITZ_SEC); // 전체 시계는 한 번만 시작
    else if (run.mode === 'practice') tickListeners.forEach(l => l(1, 1)); // 게이지는 가득 찬 채로
  }

  /** 입력 한 번 = 결과 한 번. 120ms 동안은 연타를 무시한다. */
  function select(i: number) {
    if (screen !== 'PLAY' || locked) return;
    locked = true;
    window.setTimeout(() => { locked = false; }, LOCK_MS);
    const s = run.stage;
    if (!s) return;

    if (i === s.answer) {
      const elapsed = run.mode === 'normal' || run.mode === 'case' ? timer.elapsed() : (performance.now() - run.stageStart) / 1000;
      run.reactions.push(elapsed);
      run.ratios.push(elapsed / s.timeLimit);
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.wrongStreak = 0;
      const gain = scoreOf(s, elapsed, run.combo);
      run.points += gain;
      Audio.sfx.correct(run.combo); // 콤보가 쌓일수록 음이 올라간다
      const power = run.combo >= 10 ? 3 : run.combo >= 5 ? 2 : 1; // 콤보가 쌓일수록 연출이 커진다
      const milestone = run.combo === 5 || run.combo === 10;
      if (milestone) Audio.sfx.combo();
      Audio.vibrate(milestone ? 24 : 8);
      const today = todayKeyKST();
      let coins = 0;
      if (run.mode === 'case' && run.mod) { // 변주 라운드의 정답 보상
        coins = MODS[run.mod].coins;
        run.bonus += coins;
        Audio.sfx.coin();
        Missions.bump(store, today, run.mod);
      }
      if (run.mode !== 'practice') { Missions.bump(store, today, 'finds'); Missions.bump(store, today, 'combo', run.combo); }
      fx({ type: 'correct', index: i, power, hue: s.hue, milestone, gain, fast: elapsed / s.timeLimit < 0.3, combo: run.combo, coins });
      setMood('happy');
      if (run.mode !== 'practice') { // 도감: 찾은 물건을 센다 (마일스톤을 넘으면 코인 보상)
        const bonus = addCodex(store, s.kind);
        if (bonus) { store.coins += bonus; toastState = { id: ++seq, msg: `📖 도감 보상 +${bonus} 코인` }; }
        store = Save.save(store);
      }
      if (run.mode === 'case') {
        const boss = bossOf(CASES[run.caseIdx].id);
        if (boss) { // 정답 = 보스에게 한 방
          bossHp = Math.max(0, bossHp - 1);
          bossHit++;
          if (bossHp === 1) say(boss.low, 2600);
        }
        if (run.round >= CASES[run.caseIdx].rounds) {
          if (boss) { fx({ type: 'bossDown' }); Audio.sfx.boom(); }
          finishCase(true);
          return;
        }
        run.round++;
      }
      run.n++;
      nextStage();
    } else {
      run.wrongs++;
      run.wrongStreak++;
      run.combo = 0;
      Audio.sfx.wrong();
      Audio.vibrate(20);
      announce('오답');
      if (run.mode === 'case') { // 보스는 오답을 놀린다
        const boss = bossOf(CASES[run.caseIdx].id);
        if (boss) say(boss.taunts[Math.floor(Math.random() * boss.taunts.length)]); // 연출용 난수 (퍼즐 시드와 무관)
      }
      fx({ type: 'wrong', index: i });
      setMood('dizzy');
      if (run.mode !== 'practice') { // 연습: 페널티 없음
        timer.penalty(1.0); // 즉사 대신 시간 차감
        if (timer.left() <= 0) { gameOver(run.wrongStreak >= 3 ? 'wrong_streak' : 'timeout'); return; }
      }
      emit();
    }
  }

  function scoreOf(s: Stage, elapsed: number, combo: number): number {
    const gridBonus = s.total / 12;
    const speed = Math.max(0.1, 1 - elapsed / s.timeLimit); // 블리츠·연습에서도 단계별 기준 시간으로 환산
    const comboMul = 1 + Math.min(combo, 10) * 0.1;
    return Math.round(100 * gridBonus * (0.4 + speed * 0.6) * comboMul);
  }

  // ── 일시정지 ────────────────────────────────────────────
  function pauseNow() { timer.pause(); run.pausedAt = performance.now(); show('PAUSED'); emit(); }
  function togglePause() {
    if (screen === 'PLAY') pauseNow();
    else if (screen === 'PAUSED') {
      run.stageStart += performance.now() - run.pausedAt;
      show('PLAY');
      timer.resume();
      emit();
    }
  }
  const autoPause = () => { if (screen === 'PLAY') pauseNow(); };

  // ── 종료 ────────────────────────────────────────────────
  function gameOver(reason: FailReason) {
    if (screen === 'RESULT' || screen === 'CASE_RESULT') return;
    if (run.mode === 'case') { finishCase(false); return; }
    timer.stop();
    Audio.sfx.over();
    fx({ type: 'over' });

    const stages = run.n - 1;
    const survivedMs = Math.round(performance.now() - run.startedAt);
    const best = store.best;
    const blitz = run.mode === 'blitz';
    const isBest = blitz ? stages > store.bestBlitz : stages > best.stages;
    const prevTier = tierOf(best.stages); // 갱신 전 등급 (승급 여부 판단)

    const rs = run.reactions;
    const bestReaction = rs.length ? Math.min(...rs) : null;
    const avgReaction = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;

    if (isBest) { if (blitz) store.bestBlitz = stages; else best.stages = stages; Audio.sfx.best(); }
    if (!blitz && run.points > best.points) best.points = run.points;
    if (bestReaction != null && (best.reaction == null || bestReaction < best.reaction)) {
      best.reaction = +bestReaction.toFixed(2);
    }

    const today = todayKeyKST();
    if (challenge.type === 'daily' && challenge.key === today) {
      if (store.daily.lastKey !== today) { store.daily.lastKey = today; store.daily.bestStages = 0; }
      store.daily.bestStages = Math.max(store.daily.bestStages, stages);
    }
    store.stats.played++;
    store.stats.totalStages += stages;
    store.stats.totalTimeMs += survivedMs;
    Save.bumpStreak(store, today);
    const unlocked = evaluate({
      store, mode: run.mode, stages, maxCombo: run.maxCombo, wrongs: run.wrongs,
      bestReaction, challengeType: challenge.type,
    });
    store = Save.save(store);

    // 난이도 로그는 일반 모드만 — 모드가 섞이면 T별 중앙값이 의미를 잃는다
    if (run.mode === 'normal') Log.add({ tuneT: store.settings.tuneT, stages, survivedMs, points: run.points, reason });

    const tier = Math.max(tierOf(stages), heroTier(store));
    const promoted = !blitz && tier > prevTier;
    const who = `${store.hero.name} · ${rankOf(stages)}`;
    const card: CardData = {
      stages, bestReaction, avgReaction,
      label: blitz ? '30초 도전' : challengeLabel(challenge),
      stage: run.stage, isBest, who,
    };
    const fmt = (v: number | null) => (v == null ? '-' : v.toFixed(2));
    result = {
      stages, isBest, tier, promoted, card,
      title: blitz ? '종료 — 30초 도전' : reason === 'wrong_streak' ? '실패 — 오답 누적' : '실패 — 시간 초과',
      sub: `${run.points.toLocaleString('ko-KR')}점 · 최고 반응 ${fmt(bestReaction)}초 · 평균 ${fmt(avgReaction)}초`,
      best: isBest ? '★ 최고 기록 갱신' : `최고 ${blitz ? store.bestBlitz : best.stages}단계`,
      rank: who + (promoted ? '  ▲ 승급!' : ''),
      npc: `렌즈: “${closingLine(stages, isBest, reason)}”`,
      ach: unlocked.length ? '🏆 업적 달성: ' + unlocked.map(a => a.name).join(', ') : '',
    };
    show('RESULT');
    setMood('idle');
    announce(`${result.title}. ${stages}단계. ${result.ach}`);
    emit();

    // 카드는 미리 만들어 둔다 (공유 버튼을 눌렀을 때 지연이 없어야 iOS에서 시트가 뜬다)
    try {
      const off = document.createElement('canvas');
      drawCard(off, card);
      void toBlob(off).then(b => { cardBlob = b; });
    } catch { cardBlob = null; }
  }

  // ── 공유 ────────────────────────────────────────────────
  async function doShare() {
    if (!result) return;
    const stages = run.n - 1;
    const normal = run.mode === 'normal';
    const url = shareUrl(challenge, normal ? stages : 0); // 다른 모드 점수가 '친구의 기록'으로 비교되면 안 된다
    const text = `딱 하나 이상함${normal ? '' : ` [${MODES[run.mode].label}]`} — ${stages}단계\n${challengeLabel(challenge)}, 넘어볼래?`;
    fallback = { visible: false, text: text + '\n' + url, url };
    emit();
    const r = await Share.share({
      blob: cardBlob, text, url,
      onFallback: () => { fallback = { ...fallback, visible: true }; emit(); },
      onToast: toast,
    });
    // 이미지를 클립보드에 넣었더라도 링크 복사·이미지 저장은 남겨둔다.
    if (r === 'clipboard-image') { fallback = { ...fallback, visible: true }; emit(); }
    if (r === 'files' || r === 'text') toast('공유했습니다');
  }

  // ── 대사 ────────────────────────────────────────────────
  function play(lines: DialogLine[], card: DialogRequest['card'], hold: number, onDone: () => void, cine: CineInfo | null = null) {
    dialog = { id: ++seq, lines, hero: store.hero, card, hold, cine };
    dialogDone = onDone;
  }
  function finishDialog() {
    const cb = dialogDone;
    dialog = null;
    dialogDone = null;
    cb?.();
    emit();
  }

  // ── 캐릭터 만들기 · 프롤로그 ───────────────────────────────
  function openCreator() { show('HERO'); emit(); }

  function confirmHero(h: Hero) {
    const hero: Hero = enforceUnlocks(store, normalizeHero(h));
    if (!hero.name) hero.name = '감별사';
    store.hero = hero;
    store = Save.save(store);
    if (!store.prologue) {
      store.prologue = true;
      store = Save.save(store);
      play(PROLOGUE.map(l => ({ ...l, text: fill(l.text, hero.name) })), null, 900, () => { show('TITLE'); emit(); });
      show('STORY');
    } else show('TITLE');
    emit();
  }

  // ── 설정 · 기록 ──────────────────────────────────────────
  function setSetting<K extends keyof Store['settings']>(key: K, value: Store['settings'][K]) {
    store.settings[key] = value;
    store = Save.save(store);
    applySettings();
    emit();
  }
  function setMode(m: Mode) {
    if (!MODES[m]) return;
    store.mode = m; store = Save.save(store); emit();
  }
  function setPracticeAxis(a: string) {
    store.practiceAxis = a; store = Save.save(store); emit();
  }
  function resetAll() {
    store = Save.reset();
    Log.clear();
    applySettings();
    toast('기록을 초기화했습니다');
  }

  /** 시작 버튼: 오늘의 문제를 하고 온 뒤라면 자유 플레이로 돌아간다 (모드 선택이 다시 보이게) */
  function startPlay() {
    if (challenge.type === 'daily') challenge = freeChallenge();
    if (store.mode === 'case') { openMap(); return; }
    newGame();
  }
  function playDaily() {
    challenge = dailyChallenge(todayKeyKST());
    newGame();
  }
  /** 자유 플레이 재시작 시 새 시드 (도전장/오늘의 문제는 시드를 유지해야 한다) */
  function restart() {
    if (challenge.type === 'free') challenge = freeChallenge();
    newGame();
  }
  function goTitle() {
    timer.stop();
    run = freshRun();
    result = null;
    caseResult = null;
    hintIndex = null;
    show('TITLE');
    emit();
  }

  // ── 사건부 (캠페인) ─────────────────────────────────────
  function openMap() { bossTaunt = null; show('MAP'); emit(); }

  function startCase(i: number, skipIntro = false) {
    const def = CASES[i];
    if (!def) return;
    if (!isCaseUnlocked(store, i)) { toast('앞선 사건을 먼저 해결해야 해요'); return; }
    run = freshRun();
    run.mode = 'case';
    run.caseIdx = i;
    run.round = 1;
    run.n = def.startN;
    run.rootKey = `k:${def.id}:${freeChallenge().key}`; // 시도할 때마다 다른 문제 (같은 위치를 외울 수 없다)
    run.startedAt = performance.now();
    cardBlob = null; result = null; caseResult = null; hintIndex = null;
    bossHp = def.rounds; bossTaunt = null;
    setMood('idle');
    themeHue = zoneHue(def.zone);

    const first = starsOf(store, i) === 0;
    if (skipIntro || !first) { show('PLAY'); nextStage(); return; }
    const name = store.hero.name;
    const hue = zoneHue(def.zone);
    const tier = heroTier(store);
    const boss = bossOf(def.id);
    fx({ type: 'zone', hue });

    if (boss) { // ── 보스 등장 컷신: 경보 · WARNING 띠 · 보스 대사
      Audio.sfx.alarm();
      const lines = boss.intro.map(l => ({ ...l, text: fill(l.text, name) }));
      play(lines, { k: 'BOSS', n: boss.name }, 700, () => { show('PLAY'); nextStage(); }, { hue, tier, banner: 'WARNING', boss });
      show('STORY');
      emit();
      return;
    }
    const zoneFirst = i % 3 === 0; // 구역의 첫 사건이면 구역 소개 컷신도 함께
    const lines: DialogLine[] = [
      ...(zoneFirst ? zoneOf(def.startN).lines.map(t => ({ who: 'npc' as const, text: fill(t, name) })) : []),
      { who: 'npc', text: fill(def.brief, name) },
    ];
    play(lines, { k: `CASE ${def.id}`, n: def.title }, 650, () => { show('PLAY'); nextStage(); },
      zoneFirst ? { hue, tier } : null);
    show('STORY');
    emit();
  }

  function finishCase(success: boolean) {
    timer.stop();
    const def = CASES[run.caseIdx];
    const idx = run.caseIdx;
    const rs = run.reactions;
    const bestReaction = rs.length ? Math.min(...rs) : null;
    const avgReaction = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
    const prevTierC = campaignTier(store);
    const prevStars = starsOf(store, idx);
    let stars = 0, coins = 0, unlockText = '';
    const firstClear = success && prevStars === 0;

    if (success) {
      const avgRatio = run.ratios.length ? run.ratios.reduce((a, b) => a + b, 0) / run.ratios.length : 1;
      stars = rateCase(run.wrongs, avgRatio);
      coins = caseCoins(stars, firstClear, Math.max(0, stars - prevStars));
      setStars(store, idx, stars);
      const job = FINALE_JOB[def.id];
      if (job && !isUnlocked(store, 'job', job)) { unlock(store, 'job', job); unlockText = `새 복장 해금: ${jobLabel(job)}`; }
      if (def.id === CASES.length && firstClear) { coins += FINALE_COINS; unlockText = (unlockText ? unlockText + ' · ' : '') + '모든 사건 해결! 보너스 코인 +' + FINALE_COINS; }
      coins += run.bonus; // 번개·황금 판 보너스
      store.coins += coins;
      Missions.bump(store, todayKeyKST(), 'cases');
      if (stars === 3) Missions.bump(store, todayKeyKST(), 'star3');
      Audio.sfx.best();
    } else {
      Audio.sfx.over();
    }
    fx({ type: success ? 'stage' : 'over' });
    if (success) fx({ type: 'zone', hue: zoneHue(def.zone) });

    store.stats.played++;
    store.stats.totalStages += run.round - (success ? 0 : 1);
    store.stats.totalTimeMs += Math.round(performance.now() - run.startedAt);
    Save.bumpStreak(store, todayKeyKST());
    const unlocked = success ? evaluate({
      store, mode: 'case', stages: run.round, maxCombo: run.maxCombo, wrongs: run.wrongs,
      bestReaction, challengeType: 'free',
    }) : [];
    store = Save.save(store);

    const tier = heroTier(store);
    caseResult = {
      idx, title: def.title, success, stars, prevStars, coins, firstClear, bonus: success ? run.bonus : 0,
      wrongs: run.wrongs, avgReaction, roundsDone: success ? def.rounds : run.round - 1, rounds: def.rounds,
      unlockText, ach: unlocked.length ? '🏆 업적 달성: ' + unlocked.map(a => a.name).join(', ') : '',
      hasNext: success && idx + 1 < CASES.length, tier, promoted: success && campaignTier(store) > prevTierC,
      npc: success
        ? stars === 3 ? '완벽해요! 현장 요원이 따로 없네요.' : stars === 2 ? '좋아요, 훌륭한 수사였어요!' : '해결은 했어요. 별 3개에 도전해 볼래요?'
        : '아쉬워요. 시간이 부족했어요. 한 번 더 도전해 봐요!',
    };
    announce(success ? `사건 해결. 별 ${stars}개` : '수사 실패');

    // 보스를 처음 쓰러뜨렸다면: 격파 컷신 → (복장 해금 장면) → 결과 화면
    const boss = bossOf(def.id);
    if (success && boss && firstClear) {
      const name = store.hero.name;
      const hue = zoneHue(def.zone);
      const lines: DialogLine[] = boss.defeat.map(l => ({ ...l, text: fill(l.text, name) }));
      const jobReward = FINALE_JOB[def.id];
      if (jobReward) {
        lines.push({
          who: 'sys', tier, hero: { ...store.hero, job: jobReward },
          text: `새 복장 해금: ${jobLabel(jobReward)}! 캐릭터 바꾸기에서 입어 보세요.`,
        });
      }
      Audio.sfx.fanfare();
      play(lines, { k: 'CLEAR', n: boss.name }, 750, () => { show('CASE_RESULT'); celebrate(); emit(); }, { hue, tier, boss, defeated: true });
      show('STORY');
      emit();
      return;
    }
    show('CASE_RESULT');
    celebrate();
    emit();
  }

  /** 사건을 해결했으면 결과 화면에서 색종이를 터뜨린다 */
  function celebrate() {
    if (caseResult?.success) fx({ type: 'confetti', big: caseResult.stars === 3 });
  }

  const jobLabel = (j: string) =>
    JOBS.find(([v]) => v === j)?.[1] ?? j;

  const nextCase = () => { if (caseResult?.hasNext) startCase(caseResult.idx + 1); else openMap(); };
  const retryCase = () => { if (run.caseIdx >= 0) startCase(run.caseIdx, true); };

  /** 힌트: 정답 칸을 잠깐 비춘다 (사건부 전용) */
  function useHint() {
    if (screen !== 'PLAY' || run.mode !== 'case' || !run.stage || hintIndex !== null) return;
    if (store.hints <= 0) { toast('힌트가 없어요. 도감·상점에서 살 수 있어요'); return; }
    store.hints--;
    store = Save.save(store);
    hintIndex = run.stage.answer;
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hintIndex = null; emit(); }, 1500);
    emit();
  }

  // ── 도감 · 상점 · 옷장 ────────────────────────────────────
  function openCodex() { codexBack = screen === 'MAP' ? 'MAP' : 'TITLE'; show('CODEX'); emit(); }
  function closeCodex() { show(codexBack); emit(); }

  function buyHints() {
    if (store.coins < HINT_PRICE) { toast('코인이 부족해요'); return; }
    store.coins -= HINT_PRICE;
    store.hints += HINT_PACK;
    store = Save.save(store);
    toast(`💡 힌트 ${HINT_PACK}개를 샀어요`);
  }

  /** 소품·옷색을 코인으로 산다. 복장은 사건 보상이라 살 수 없다. 이미 쓸 수 있으면 true. */
  function buyUnlock(kind: UnlockKind, key: string | number): boolean {
    if (isUnlocked(store, kind, key)) return true;
    const price = priceOf(kind, key);
    if (price == null) {
      const need = Object.entries(FINALE_JOB).find(([, j]) => j === key)?.[0];
      toast(need ? `사건 ${need}을(를) 해결하면 해금돼요` : '아직 해금할 수 없어요');
      return false;
    }
    if (store.coins < price) { toast(`코인이 부족해요 (필요 ${price})`); return false; }
    store.coins -= price;
    unlock(store, kind, key);
    store = Save.save(store);
    toast('해금했어요!');
    return true;
  }

  /** 해금 안 된 값이 섞인 캐릭터를 쓸 수 있는 값으로 되돌린다 */
  const allowedHero = (h: Hero): Hero => enforceUnlocks(store, normalizeHero(h));

  // ── 배경음악 · 시계 아이템 · 임무 ─────────────────────────────
  const CLOCK_PRICE = 25, CLOCK_PACK = 2;

  /** 화면에 맞는 곡을 튼다. 게임 중에는 구역(보스전은 보스 곡), 그 밖에는 메뉴 곡. */
  function syncMusic() {
    const on = store.settings.sound && store.settings.music;
    Music.setEnabled(on);
    if (!on) return;
    const playing = screen === 'PLAY' || screen === 'PAUSED' || (screen === 'STORY' && !!run.stage);
    if (playing) {
      const caseDef = run.mode === 'case' && run.caseIdx >= 0 ? CASES[run.caseIdx] : null;
      Music.play(caseDef ? (bossOf(caseDef.id) ? 'boss' : caseDef.zone) : zoneOf(run.n).idx);
      Music.duck(screen !== 'PLAY');
    } else {
      Music.play('menu');
      Music.setIntensity(0);
      Music.duck(false);
    }
  }

  /** 시계: 지금 라운드의 시간을 5초 늘린다 */
  function useClock() {
    if (screen !== 'PLAY' || (run.mode !== 'case' && run.mode !== 'normal') || !run.stage) return;
    if (store.clocks <= 0) { toast('시계가 없어요. 도감·상점에서 살 수 있어요'); return; }
    store.clocks--;
    store = Save.save(store);
    timer.penalty(-5);
    Audio.sfx.clock();
    toast('⏱ 시간 +5초');
  }

  function buyClocks() {
    if (store.coins < CLOCK_PRICE) { toast('코인이 부족해요'); return; }
    store.coins -= CLOCK_PRICE;
    store.clocks += CLOCK_PACK;
    store = Save.save(store);
    toast(`⏱ 시계 ${CLOCK_PACK}개를 샀어요`);
  }

  function claimMission(i: number) {
    const c = Missions.claim(store, todayKeyKST(), i);
    if (!c) return;
    store.coins += c;
    store = Save.save(store);
    Audio.sfx.coin();
    toast(`🎯 임무 보상 +${c}코인`);
  }

  // ── 포커스 이탈 / 탭 전환 시 부당한 실패 방지 (과제 카드 2) ───
  const onVisibility = () => { if (document.hidden) autoPause(); };
  function attach(): () => void {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', autoPause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', autoPause);
      timer.destroy();
    };
  }

  function boot() {
    applySettings();
    // 출석 보상 + 오늘의 임무 초기화
    const today = todayKeyKST();
    Missions.ensure(store, today);
    const b = Missions.loginBonus(store, today);
    if (b.coins) {
      store.coins += b.coins;
      toastState = { id: ++seq, msg: `📅 출석 보상 +${b.coins}코인 (${b.streak}일 연속)` };
    }
    store = Save.save(store);
    show(store.hero.name ? 'TITLE' : 'HERO'); // 첫 실행: 캐릭터부터 만든다
    emit();
  }

  snapshot = build();

  const api = {
    subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
    getSnapshot: () => snapshot,
    onTick(l: (left: number, limit: number) => void) { tickListeners.add(l); return () => { tickListeners.delete(l); }; },
    onFx(l: (e: FxEvent) => void) { fxListeners.add(l); return () => { fxListeners.delete(l); }; },
    attach, boot,
    newGame, startPlay, playDaily, restart, goTitle, togglePause, select,
    openCreator, confirmHero, finishDialog,
    openMap, startCase, nextCase, retryCase, useHint,
    openCodex, closeCodex, buyHints, buyUnlock, allowedHero,
    setSetting, setMode, setPracticeAxis, resetAll, doShare, toast,
    exportCSV: () => Log.toCSV(),
    copyShareText: () => Share.copy(fallback.text, toast),
    copyShareUrl: () => Share.copy(fallback.url, toast),
    saveCard: () => Share.saveImage(cardBlob, toast),
    copyText: (s: string) => Share.copy(s, toast),
    unlock: () => { Audio.unlock(); syncMusic(); },
    useClock, buyClocks, claimMission,
    achievements: () => ({ list: ACHIEVEMENTS, have: owned(store) }),
    // 개발·검증용 — 배포본에서도 해가 없다 (개인정보 없음)
    get run() { return run; },
    get store() { return store; },
    get challenge() { return challenge; },
    get cardBlob() { return cardBlob; },
  };
  return api;
}

export type Engine = ReturnType<typeof createEngine>;
