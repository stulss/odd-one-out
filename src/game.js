// GameManager — 상태 머신과 화면 전환의 단일 진입점.
// 상태: TITLE → PLAY ⇄ PAUSED → RESULT
import { makeStage, axisLabel } from './stage.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createTimer } from './timer.js';
import * as Save from './save.js';
import * as Log from './logger.js';
import * as Audio from './audio.js';
import * as Share from './share.js';
import { drawCard, toBlob } from './card.js';
import { readChallenge, todayKeyKST, shareUrl, challengeLabel, freeKey } from './daily.js';

const $ = id => document.getElementById(id);

export function createGame(){
  // ── 영속 상태 (localStorage) ─────────────────────────────
  let store = Save.load();

  // ── 현재 판 상태 — 저장하지 않는다. 새 게임에서 자동 초기화된다.
  const fresh = () => ({
    n: 1, points: 0, combo: 0, maxCombo: 0,
    reactions: [], wrongs: 0, wrongStreak: 0,
    startedAt: 0, stage: null, prev: null,
  });
  let run = fresh();
  let state = 'TITLE';
  let challenge = readChallenge();
  let cardBlob = null;

  const el = {
    app: $('app'), board: $('board'), stageArea: $('stageArea'),
    gauge: $('gauge'), stageNo: $('stageNo'), points: $('points'),
    statusLine: $('statusLine'), tuneOut: $('tuneOut'), tuneOut2: $('tuneOut2'),
    challengeLabel: $('challengeLabel'), rivalBanner: $('rivalBanner'),
    bestLine: $('bestLine'), toast: $('toast'),
    resultTitle: $('resultTitle'), resultStages: $('resultStages'),
    resultSub: $('resultSub'), resultBest: $('resultBest'),
    cardCanvas: $('cardCanvas'), fallback: $('fallback'),
    logCount: $('logCount'), logSummary: $('logSummary'),
  };

  const renderer = createRenderer(el.board, el.stageArea, null);

  const timer = createTimer({
    onTick(left, limit){
      el.gauge.style.transform = `scaleX(${Math.max(0, left / limit)})`;
      el.gauge.classList.toggle('warn', left / limit < 0.3);
    },
    onZero(){ gameOver('timeout'); },
  });

  createInput(el.board, {
    canSelect: () => state === 'PLAY',
    getFocus: () => renderer.getFocus(),
    onMoveFocus: k => renderer.moveFocus(k),
    onSelect: i => onSelect(i),
    onPause: () => togglePause(),
    onFirstGesture: () => Audio.unlock(),
  });

  // ── 화면 ────────────────────────────────────────────────
  function show(screen){
    state = screen;
    el.app.dataset.screen = screen;
    updateStatus();
  }

  function updateStatus(){
    const map = { TITLE:'대기 중', PLAY:'진행 중', PAUSED:'일시정지', RESULT:'종료' };
    el.statusLine.textContent =
      `상태: ${map[state] ?? state} · 단계 ${run.n} · 난이도 T=${store.settings.tuneT.toFixed(1)}`;
    el.tuneOut.textContent = store.settings.tuneT.toFixed(1);
    if (el.tuneOut2) el.tuneOut2.value = store.settings.tuneT;
  }

  function updateHud(){
    el.stageNo.textContent = run.n;
    el.points.textContent = run.points.toLocaleString('ko-KR');
    updateStatus();
  }

  function updateTitle(){
    el.challengeLabel.textContent = challengeLabel(challenge);
    const b = store.best;
    el.bestLine.textContent = b.stages
      ? `최고 ${b.stages}단계 · ${b.points.toLocaleString('ko-KR')}점` +
        (store.streak.count > 1 ? ` · ${store.streak.count}일 연속` : '')
      : '아직 기록이 없습니다';
    el.rivalBanner.hidden = !challenge.rival;
    if (challenge.rival) el.rivalBanner.textContent = `친구의 기록 ${challenge.rival}단계 — 넘어보세요`;
  }

  // ── 판 진행 ─────────────────────────────────────────────
  function newGame(){
    run = fresh();                      // ★ 현재 판 값은 전부 초기화 (과제 완료기준 3)
    run.startedAt = performance.now();
    renderer.clearReveal();
    cardBlob = null;
    show('PLAY');
    nextStage();
  }

  function nextStage(){
    const s = makeStage(challenge.rootKey, run.n, store.settings.tuneT, run.prev);
    run.stage = s;
    run.prev = s;
    renderer.draw(s);
    timer.start(s.timeLimit);
    updateHud();
  }

  function onSelect(i){
    const s = run.stage;
    if (!s) return;

    if (i === s.answer){
      const elapsed = timer.elapsed();
      run.reactions.push(elapsed);
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.wrongStreak = 0;
      run.points += scoreOf(s, elapsed, run.combo);
      Audio.sfx.correct();
      renderer.markCorrect(i);
      run.n++;
      nextStage();
    } else {
      run.wrongs++;
      run.wrongStreak++;
      run.combo = 0;
      Audio.sfx.wrong();
      Audio.vibrate(20);
      renderer.markWrong(i);
      timer.penalty(1.0);               // 즉사 대신 시간 차감
      if (timer.left() <= 0) gameOver(run.wrongStreak >= 3 ? 'wrong_streak' : 'timeout');
      updateHud();
    }
  }

  function scoreOf(s, elapsed, combo){
    const gridBonus = (s.total) / 12;
    const speed     = Math.max(0.1, 1 - elapsed / s.timeLimit);
    const comboMul  = 1 + Math.min(combo, 10) * 0.1;
    return Math.round(100 * gridBonus * (0.4 + speed * 0.6) * comboMul);
  }

  // ── 일시정지 ────────────────────────────────────────────
  function togglePause(){
    if (state === 'PLAY'){ timer.pause(); show('PAUSED'); }
    else if (state === 'PAUSED'){ show('PLAY'); timer.resume(); }
  }
  function autoPause(){ if (state === 'PLAY'){ timer.pause(); show('PAUSED'); } }

  // ── 종료 ────────────────────────────────────────────────
  function gameOver(reason){
    if (state === 'RESULT') return;
    timer.stop();
    renderer.revealAnswer();
    Audio.sfx.over();

    const stages = run.n - 1;
    const survivedMs = Math.round(performance.now() - run.startedAt);
    const best = store.best;
    const isBest = stages > best.stages;

    const rs = run.reactions;
    const bestReaction = rs.length ? Math.min(...rs) : null;
    const avgReaction  = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;

    if (isBest){ best.stages = stages; Audio.sfx.best(); }
    if (run.points > best.points) best.points = run.points;
    if (bestReaction != null && (best.reaction == null || bestReaction < best.reaction))
      best.reaction = +bestReaction.toFixed(2);

    const today = todayKeyKST();
    if (challenge.type === 'daily' && challenge.key === today){
      if (store.daily.lastKey !== today){ store.daily.lastKey = today; store.daily.bestStages = 0; }
      store.daily.bestStages = Math.max(store.daily.bestStages, stages);
    }
    store.stats.played++;
    store.stats.totalStages += stages;
    store.stats.totalTimeMs += survivedMs;
    Save.bumpStreak(store, today);
    store = Save.save(store);

    Log.add({ tuneT: store.settings.tuneT, stages, survivedMs, points: run.points, reason });
    refreshLogPanel();

    el.resultTitle.textContent = reason === 'wrong_streak' ? '실패 — 오답 누적' : '실패 — 시간 초과';
    el.resultStages.textContent = stages;
    el.resultSub.textContent =
      `${run.points.toLocaleString('ko-KR')}점 · 최고 반응 ${fmt(bestReaction)}초 · 평균 ${fmt(avgReaction)}초`;
    el.resultBest.textContent = isBest ? '★ 최고 기록 갱신' : `최고 ${best.stages}단계`;
    el.resultBest.classList.toggle('is-best', isBest);

    show('RESULT');
    updateTitle();

    // 카드는 미리 만들어 둔다 (공유 버튼을 눌렀을 때 지연이 없어야 iOS에서 시트가 뜬다)
    try {
      drawCard(el.cardCanvas, {
        stages, bestReaction, avgReaction,
        label: challengeLabel(challenge), stage: run.stage, isBest,
      });
      toBlob(el.cardCanvas).then(b => { cardBlob = b; });
    } catch { cardBlob = null; }
  }

  const fmt = v => (v == null ? '-' : v.toFixed(2));

  // ── 공유 ────────────────────────────────────────────────
  async function doShare(){
    const stages = run.n - 1;
    const url = shareUrl(challenge, stages);
    const text = `딱 하나 이상함 — ${stages}단계\n${challengeLabel(challenge)}, 넘어볼래?`;
    el.fallback.hidden = true;
    el.fallback.dataset.text = text + '\n' + url;
    el.fallback.dataset.url = url;
    const r = await Share.share({
      blob: cardBlob, text, url,
      onFallback: () => { el.fallback.hidden = false; },
      onToast: toast,
    });
    // 이미지를 클립보드에 넣었더라도 링크 복사·이미지 저장은 남겨둔다.
    // 주 동작은 이미 끝났고, 링크만 필요한 사람의 선택지를 없앨 이유가 없다.
    if (r === 'clipboard-image') el.fallback.hidden = false;
    if (r === 'files' || r === 'text') toast('공유했습니다');
  }

  function toast(msg){
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  // ── 설정 ────────────────────────────────────────────────
  function applySettings(){
    const s = store.settings;
    document.documentElement.dataset.reduced = s.reducedMotion ? 'on' : 'off';
    Audio.setMuted(!s.sound);
    $('optSound').checked = s.sound;
    $('optMotion').checked = s.reducedMotion;
    updateStatus();
  }

  function setSetting(key, value){
    store.settings[key] = value;
    store = Save.save(store);
    applySettings();
  }

  function refreshLogPanel(){
    const rows = Log.read();
    el.logCount.textContent = rows.length;
    el.logSummary.textContent = Log.summary()
      .map(g => `T=${g.tuneT}: ${g.n}회 · 중앙값 ${g.medianStages}단계 / ${g.medianSurvivalSec}초`)
      .join('\n') || '아직 기록이 없습니다';
  }

  function resetAll(){
    store = Save.reset();
    Log.clear();
    applySettings();
    updateTitle();
    refreshLogPanel();
    toast('기록을 초기화했습니다');
  }

  // ── 자유 플레이 재시작 시 새 시드 (도전장/오늘의 문제는 시드를 유지해야 한다)
  function restart(){
    if (challenge.type === 'free') challenge = { ...challenge, key: freeKey(), rootKey: 'c:' + freeKey() };
    newGame();
  }

  // ── 포커스 이탈 / 탭 전환 시 부당한 실패 방지 (과제 카드 2)
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);

  return {
    boot(){
      applySettings();
      updateTitle();
      updateStatus();
      refreshLogPanel();
      show('TITLE');
    },
    newGame, restart, togglePause, doShare, setSetting, resetAll, toast,
    goTitle(){ timer.stop(); run = fresh(); renderer.clearReveal(); show('TITLE'); updateHud(); },
    playDaily(){
      const k = todayKeyKST();
      challenge = { type:'daily', key:k, rootKey:`d:${k}`, rival:null };
      updateTitle(); newGame();
    },
    exportCSV(){ return Log.toCSV(); },
    get cardBlob(){ return cardBlob; },
    get store(){ return store; },
    get challenge(){ return challenge; },
    get run(){ return run; },
  };
}
