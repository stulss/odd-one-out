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
import { PROLOGUE, zoneOf, rankOf, tierOf, closingLine, fill, type DialogLine, type Zone } from './story';
import { sanitizeName } from './heroData';

export const MODES: Record<Mode, { label: string; desc: string }> = {
  normal:   { label: '일반',      desc: '단계마다 제한 시간. 시간이 0이 되면 종료.' },
  blitz:    { label: '30초 도전', desc: '전체 30초 안에 몇 단계까지? 오답은 1초 차감.' },
  practice: { label: '연습',      desc: '시간 제한 없음. 약한 차이 유형만 골라 연습. 기록은 남지 않습니다.' },
};
const BLITZ_SEC = 30;
const LOCK_MS = 120; // 조작 1회 = 결과 1회. 연타·멀티터치로 상태가 꼬이면 안 된다.

export type Screen = 'TITLE' | 'PLAY' | 'PAUSED' | 'RESULT' | 'HERO' | 'STORY';
export type Mood = 'idle' | 'happy' | 'dizzy';
type FailReason = 'timeout' | 'wrong_streak';

interface Run {
  n: number; points: number; combo: number; maxCombo: number;
  reactions: number[]; wrongs: number; wrongStreak: number;
  startedAt: number; stage: Stage | null; prev: Stage | null;
  stageStart: number; pausedAt: number; mode: Mode;
}

export interface DialogRequest {
  id: number;
  lines: DialogLine[];
  hero: Hero;
  zone: Zone | null;
  hold: number;
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
  fallback: { visible: boolean; text: string; url: string };
  toast: { id: number; msg: string } | null;
  announce: { id: number; msg: string };
  log: { count: number; lines: string[] };
}

export type FxEvent =
  | { type: 'correct'; index: number; power: number; hue: number; milestone: boolean }
  | { type: 'wrong'; index: number }
  | { type: 'over' }
  | { type: 'stage' }
  | { type: 'zone'; hue: number };

type Listener = () => void;

export function createEngine() {
  let store = Save.load();
  let challenge = readChallenge();
  let screen: Screen = 'TITLE';
  let mood: Mood = 'idle';
  let themeHue = zoneOf(1).hue;
  let dialog: DialogRequest | null = null;
  let dialogDone: (() => void) | null = null;
  let result: ResultInfo | null = null;
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
  });
  let run = freshRun();

  // ── 구독 ────────────────────────────────────────────────
  const listeners = new Set<Listener>();
  const tickListeners = new Set<(left: number, limit: number) => void>();
  const fxListeners = new Set<(e: FxEvent) => void>();
  let snapshot: Snapshot;

  function build(): Snapshot {
    const logRows = Log.read();
    return {
      screen, store, challenge, stage: run.stage, stageId,
      n: run.n, points: run.points, combo: run.combo, mode: run.mode,
      mood, themeHue, dialog, result, fallback, toast: toastState, announce: announceState,
      log: {
        count: logRows.length,
        lines: Log.summary().map(g => `T=${g.tuneT}: ${g.n}회 · 중앙값 ${g.medianStages}단계 / ${g.medianSurvivalSec}초`),
      },
    };
  }
  function emit() {
    snapshot = build();
    listeners.forEach(l => l());
  }
  const fx = (e: FxEvent) => fxListeners.forEach(l => l(e));

  const timer: Timer = createTimer({
    onTick: (left, limit) => tickListeners.forEach(l => l(left, limit)),
    onZero: () => gameOver('timeout'),
  });

  // ── 보조 ────────────────────────────────────────────────
  // 도전장·오늘의 문제는 항상 일반 모드다 (같은 규칙이어야 점수 비교가 성립한다)
  const activeMode = (): Mode => (challenge.type === 'free' ? store.mode : 'normal');
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
    const s = makeStage(challenge.rootKey, run.n, store.settings.tuneT, run.prev,
      run.mode === 'practice' ? store.practiceAxis : undefined);
    run.stage = s;
    run.prev = s;
    run.stageStart = performance.now();
    stageId++;
    themeHue = zoneOf(run.n).hue;
    announce(`단계 ${run.n}`);
    fx({ type: 'stage' });

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
      play(lines, z, 550, () => { show('PLAY'); startClock(s); emit(); });
      show('STORY');
    } else {
      startClock(s);
    }
    emit();
  }

  function startClock(s: Stage) {
    run.stageStart = performance.now();
    if (run.mode === 'normal') timer.start(s.timeLimit);
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
      const elapsed = run.mode === 'normal' ? timer.elapsed() : (performance.now() - run.stageStart) / 1000;
      run.reactions.push(elapsed);
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.wrongStreak = 0;
      run.points += scoreOf(s, elapsed, run.combo);
      Audio.sfx.correct();
      const power = run.combo >= 10 ? 3 : run.combo >= 5 ? 2 : 1; // 콤보가 쌓일수록 연출이 커진다
      fx({ type: 'correct', index: i, power, hue: s.hue, milestone: run.combo === 5 || run.combo === 10 });
      setMood('happy');
      run.n++;
      nextStage();
    } else {
      run.wrongs++;
      run.wrongStreak++;
      run.combo = 0;
      Audio.sfx.wrong();
      Audio.vibrate(20);
      announce('오답');
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
    if (screen === 'RESULT') return;
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

    const tier = tierOf(stages);
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
  function play(lines: DialogLine[], zone: Zone | null, hold: number, onDone: () => void) {
    dialog = { id: ++seq, lines, hero: store.hero, zone, hold };
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
    const hero: Hero = { ...h, name: sanitizeName(h.name) || '감별사' };
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
    show('TITLE');
    emit();
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
    setSetting, setMode, setPracticeAxis, resetAll, doShare, toast,
    exportCSV: () => Log.toCSV(),
    copyShareText: () => Share.copy(fallback.text, toast),
    copyShareUrl: () => Share.copy(fallback.url, toast),
    saveCard: () => Share.saveImage(cardBlob, toast),
    copyText: (s: string) => Share.copy(s, toast),
    unlock: Audio.unlock,
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
