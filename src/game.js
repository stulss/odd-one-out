// GameManager — 상태 머신과 화면 전환의 단일 진입점.
// 상태: HERO(캐릭터 만들기) → STORY(프롤로그) → TITLE → PLAY ⇄ PAUSED → RESULT
//       PLAY 도중 구역이 바뀌면 STORY(구역 소개)를 거쳐 PLAY로 돌아온다 (소개 중에는 타이머가 멈춰 있다)
import { makeStage, axisLabel, DIFF_AXES } from './stage.js';
import { ACHIEVEMENTS, owned, evaluate } from './achieve.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createTimer } from './timer.js';
import * as Save from './save.js';
import * as Log from './logger.js';
import * as Audio from './audio.js';
import * as Share from './share.js';
import { drawCard, toBlob } from './card.js';
import { readChallenge, todayKeyKST, shareUrl, challengeLabel, freeKey } from './daily.js';
import { PROLOGUE, zoneOf, rankOf, closingLine, fill } from './story.js';
import { mountHero, setMood, createCreator, sanitizeName } from './hero.js';
import { createDialog } from './dialog.js';
import { createFx } from './fx.js';

const $ = id => document.getElementById(id);

export const MODES = {
  normal:   { label:'일반',      desc:'단계마다 제한 시간. 시간이 0이 되면 종료.' },
  blitz:    { label:'30초 도전', desc:'전체 30초 안에 몇 단계까지? 오답은 1초 차감.' },
  practice: { label:'연습',      desc:'시간 제한 없음. 약한 차이 유형만 골라 연습. 기록은 남지 않습니다.' },
};
const BLITZ_SEC = 30;

export function createGame(){
  // ── 영속 상태 (localStorage) ─────────────────────────────
  let store = Save.load();

  // ── 현재 판 상태 — 저장하지 않는다. 새 게임에서 자동 초기화된다.
  const fresh = () => ({
    n: 1, points: 0, combo: 0, maxCombo: 0,
    reactions: [], wrongs: 0, wrongStreak: 0,
    startedAt: 0, stage: null, prev: null, stageStart: 0, pausedAt: 0, mode: 'normal',
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
    modeBox: $('modeBox'), modeDesc: $('modeDesc'), axisBox: $('axisBox'), practiceAxis: $('practiceAxis'),
    resultAch: $('resultAch'), achList: $('achList'), achCount: $('achCount'), srLive: $('srLive'),
    zoneName: $('zoneName'), comboChip: $('comboChip'), heroMini: $('heroMini'), titleHero: $('titleHero'),
    heroLine: $('heroLine'), resultHero: $('resultHero'), resultRank: $('resultRank'), resultNpc: $('resultNpc'),
    heroName: $('heroName'), btnHeroCancel: $('btnHeroCancel'),
  };

  const fx = createFx({ app: el.app, layer: $('fxLayer'), flash: $('flash'), shakeTarget: el.stageArea, board: el.board });
  fx.attachTilt($('screenTitle'), $('titleTilt'));
  fx.attachTilt($('screenResult'), $('resultTilt'), 10);
  const creator = createCreator({
    preview: $('heroPreview'), nameInput: el.heroName,
    pickShape: $('pickShape'), pickHue: $('pickHue'), pickAcc: $('pickAcc'),
  });
  const playDialog = createDialog({
    zoneCard: $('zoneCard'), zoneK: $('zoneK'), zoneN: $('zoneN'),
    avatar: $('dlgAvatar'), who: $('dlgWho'), text: $('dlgText'), next: $('btnStoryNext'),
  });
  let miniHero = null, moodTimer = 0;

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

  // 도전장·오늘의 문제는 항상 일반 모드다 (같은 규칙이어야 점수 비교가 성립한다)
  const activeMode = () => challenge.type === 'free' ? store.mode : 'normal';
  const announce = msg => { el.srLive.textContent = ''; el.srLive.textContent = msg; };

  // ── 화면 ────────────────────────────────────────────────
  function show(screen){
    state = screen;
    el.app.dataset.screen = screen;
    updateStatus();
  }

  function updateStatus(){
    const map = { TITLE:'대기 중', PLAY:'진행 중', PAUSED:'일시정지', RESULT:'종료', HERO:'캐릭터 만들기', STORY:'이야기' };
    el.statusLine.textContent =
      `상태: ${map[state] ?? state} · 단계 ${run.n} · 난이도 T=${store.settings.tuneT.toFixed(1)}`;
    el.tuneOut.textContent = store.settings.tuneT.toFixed(1);
    if (el.tuneOut2) el.tuneOut2.value = store.settings.tuneT;
  }

  function updateHud(){
    el.stageNo.textContent = run.n;
    el.points.textContent = run.points.toLocaleString('ko-KR');
    const z = zoneOf(run.n);
    el.zoneName.textContent = `ZONE ${z.idx + 1} · ${z.name}`;
    setTheme(z.hue);
    updateStatus();
  }

  const setTheme = hue => document.documentElement.style.setProperty('--zh', hue);

  function updateCombo(bump){
    const c = run.combo;
    el.comboChip.hidden = c < 3;
    el.comboChip.textContent = `🔥 x${c}`;
    el.comboChip.classList.toggle('hot', c >= 10);
    if (bump && c >= 3){ el.comboChip.classList.remove('bump'); void el.comboChip.offsetWidth; el.comboChip.classList.add('bump'); }
  }

  // 캐릭터 표정은 잠깐만 바뀌고 돌아온다
  function mood(m, ms = 650){
    setMood(miniHero, m);
    clearTimeout(moodTimer);
    if (m !== 'idle') moodTimer = setTimeout(() => setMood(miniHero, 'idle'), ms);
  }

  function refreshHero(){
    const h = store.hero;
    miniHero = mountHero(el.heroMini, h);
    mountHero(el.titleHero, h, 'happy');
    const rank = rankOf(store.best.stages);
    el.heroLine.replaceChildren(document.createTextNode(h.name || '감별사'));
    const small = document.createElement('small'); small.textContent = rank;
    el.heroLine.append(small);
  }

  function updateTitle(){
    el.challengeLabel.textContent = challengeLabel(challenge);
    const b = store.best;
    el.bestLine.textContent = b.stages
      ? `최고 ${b.stages}단계 · ${b.points.toLocaleString('ko-KR')}점` +
        (store.streak.count > 1 ? ` · ${store.streak.count}일 연속` : '')
      : '아직 기록이 없습니다';
    el.modeBox.hidden = challenge.type !== 'free';
    for (const b of el.modeBox.querySelectorAll('[data-mode]'))
      b.setAttribute('aria-pressed', String(b.dataset.mode === store.mode));
    el.modeDesc.textContent = MODES[store.mode].desc +
      (store.mode === 'blitz' && store.bestBlitz ? ` (최고 ${store.bestBlitz}단계)` : '');
    el.axisBox.hidden = store.mode !== 'practice';
    el.practiceAxis.value = store.practiceAxis;
    refreshHero();
    setTheme(zoneOf(store.best.stages + 1).hue);   // 타이틀은 도달했던 구역의 색
    el.rivalBanner.hidden = !challenge.rival;
    if (challenge.rival) el.rivalBanner.textContent = `친구의 기록 ${challenge.rival}단계 — 넘어보세요`;
  }

  // ── 판 진행 ─────────────────────────────────────────────
  function newGame(){
    run = fresh();                      // ★ 현재 판 값은 전부 초기화 (과제 완료기준 3)
    run.mode = activeMode();
    run.startedAt = performance.now();
    renderer.clearReveal();
    cardBlob = null;
    mood('idle');
    updateCombo();
    show('PLAY');
    nextStage();
  }

  function nextStage(){
    const s = makeStage(challenge.rootKey, run.n, store.settings.tuneT, run.prev,
                        run.mode === 'practice' ? store.practiceAxis : undefined);
    run.stage = s;
    run.prev = s;
    run.stageStart = performance.now();
    renderer.draw(s);
    fx.boardIn();
    updateHud();
    announce(`단계 ${run.n}`);

    // 일반 모드에서 새 구역에 들어서면 이야기를 먼저 보여 준다. 소개가 끝나야 타이머가 돈다.
    const z = zoneOf(run.n);
    if (run.mode === 'normal' && run.n > 1 && z.first){
      timer.stop();
      fx.pulse(`hsl(${z.hue} 80% 55%)`, .6);
      show('STORY');
      const lines = z.lines.map(t => ({ who: 'npc', text: fill(t, store.hero.name) }));
      playDialog(lines, { hero: store.hero, zone: z }, () => { show('PLAY'); startClock(s); });
      return;
    }
    startClock(s);
  }

  function startClock(s){
    run.stageStart = performance.now();
    if (run.mode === 'normal') timer.start(s.timeLimit);
    else if (run.mode === 'blitz' && run.n === 1) timer.start(BLITZ_SEC);   // 전체 시계는 한 번만 시작
    else if (run.mode === 'practice'){
      el.gauge.style.transform = 'scaleX(1)'; el.gauge.classList.remove('warn');
    }
  }

  function onSelect(i){
    const s = run.stage;
    if (!s) return;

    if (i === s.answer){
      const elapsed = run.mode === 'normal' ? timer.elapsed() : (performance.now() - run.stageStart) / 1000;
      run.reactions.push(elapsed);
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.wrongStreak = 0;
      run.points += scoreOf(s, elapsed, run.combo);
      Audio.sfx.correct();
      renderer.markCorrect(i);
      const power = run.combo >= 10 ? 3 : run.combo >= 5 ? 2 : 1;      // 콤보가 쌓일수록 연출이 커진다
      fx.burst(renderer.cells[i], power, s.hue);
      if (run.combo === 5 || run.combo === 10){ fx.shake(.35); fx.pulse('rgb(255 180 84)', .45); }
      mood('happy');
      updateCombo(true);
      run.n++;
      nextStage();
    } else {
      run.wrongs++;
      run.wrongStreak++;
      run.combo = 0;
      Audio.sfx.wrong();
      Audio.vibrate(20);
      renderer.markWrong(i);
      announce('오답');
      fx.shake(.55);
      fx.pulse('rgb(255 107 107)', .55);
      mood('dizzy');
      updateCombo();
      if (run.mode === 'practice'){ updateHud(); return; }   // 연습: 페널티 없음
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
    if (state === 'PLAY') pauseNow();
    else if (state === 'PAUSED'){ run.stageStart += performance.now() - run.pausedAt; show('PLAY'); timer.resume(); }
  }
  function pauseNow(){ timer.pause(); run.pausedAt = performance.now(); show('PAUSED'); }
  function autoPause(){ if (state === 'PLAY') pauseNow(); }

  // ── 종료 ────────────────────────────────────────────────
  function gameOver(reason){
    if (state === 'RESULT') return;
    timer.stop();
    renderer.revealAnswer();
    Audio.sfx.over();
    fx.shake(.7);
    fx.pulse('rgb(255 107 107)', .5);

    const stages = run.n - 1;
    const survivedMs = Math.round(performance.now() - run.startedAt);
    const best = store.best;
    const blitz = run.mode === 'blitz';
    const isBest = blitz ? stages > store.bestBlitz : stages > best.stages;

    const rs = run.reactions;
    const bestReaction = rs.length ? Math.min(...rs) : null;
    const avgReaction  = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;

    if (isBest){ if (blitz) store.bestBlitz = stages; else best.stages = stages; Audio.sfx.best(); }
    if (!blitz && run.points > best.points) best.points = run.points;
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
    const unlocked = evaluate({
      store, mode: run.mode, stages, maxCombo: run.maxCombo, wrongs: run.wrongs,
      bestReaction, challengeType: challenge.type,
    });
    store = Save.save(store);

    // 난이도 로그는 일반 모드만 — 모드가 섞이면 T별 중앙값이 의미를 잃는다
    if (run.mode === 'normal') Log.add({ tuneT: store.settings.tuneT, stages, survivedMs, points: run.points, reason });
    refreshLogPanel();
    renderAch();

    el.resultRank.textContent = `${store.hero.name} · ${rankOf(stages)}`;
    el.resultNpc.textContent = '렌즈: “' + closingLine(stages, isBest, reason) + '”';
    mountHero(el.resultHero, store.hero, isBest ? 'happy' : 'dizzy');
    el.resultAch.textContent = unlocked.length ? '🏆 업적 달성: ' + unlocked.map(a => a.name).join(', ') : '';
    el.resultTitle.textContent = blitz ? '종료 — 30초 도전'
      : reason === 'wrong_streak' ? '실패 — 오답 누적' : '실패 — 시간 초과';
    el.resultStages.textContent = stages;
    el.resultSub.textContent =
      `${run.points.toLocaleString('ko-KR')}점 · 최고 반응 ${fmt(bestReaction)}초 · 평균 ${fmt(avgReaction)}초`;
    el.resultBest.textContent = isBest ? '★ 최고 기록 갱신'
      : `최고 ${blitz ? store.bestBlitz : best.stages}단계`;
    el.resultBest.classList.toggle('is-best', isBest);

    show('RESULT');
    announce(`${el.resultTitle.textContent}. ${stages}단계. ${el.resultAch.textContent}`);
    updateTitle();

    // 카드는 미리 만들어 둔다 (공유 버튼을 눌렀을 때 지연이 없어야 iOS에서 시트가 뜬다)
    try {
      drawCard(el.cardCanvas, {
        stages, bestReaction, avgReaction,
        label: blitz ? '30초 도전' : challengeLabel(challenge), stage: run.stage, isBest,
        who: `${store.hero.name} · ${rankOf(stages)}`,
      });
      toBlob(el.cardCanvas).then(b => { cardBlob = b; });
    } catch { cardBlob = null; }
  }

  const fmt = v => (v == null ? '-' : v.toFixed(2));

  // ── 공유 ────────────────────────────────────────────────
  async function doShare(){
    const stages = run.n - 1;
    const normal = run.mode === 'normal';
    const url = shareUrl(challenge, normal ? stages : 0);   // 다른 모드 점수가 '친구의 기록'으로 비교되면 안 된다
    const text = `딱 하나 이상함${normal ? '' : ` [${MODES[run.mode].label}]`} — ${stages}단계\n${challengeLabel(challenge)}, 넘어볼래?`;
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
    $('optColor').checked = s.colorSafe;
    $('optContrast').checked = s.highContrast;
    document.documentElement.dataset.contrast = s.highContrast ? 'on' : 'off';
    renderer.setColorSafe(s.colorSafe);
    updateStatus();
  }

  function setSetting(key, value){
    store.settings[key] = value;
    store = Save.save(store);
    applySettings();
  }

  function renderAch(){
    const have = owned(store);
    el.achCount.textContent = `${have.size}/${ACHIEVEMENTS.length}`;
    el.achList.replaceChildren(...ACHIEVEMENTS.map(a => {
      const li = document.createElement('li');
      li.className = have.has(a.id) ? 'on' : '';
      const t = document.createElement('span');
      t.textContent = (have.has(a.id) ? a.icon : '🔒') + ' ' + a.name;
      const d = document.createElement('small');
      d.textContent = a.desc;
      t.appendChild(d);
      li.appendChild(t);
      return li;
    }));
  }

  // ── 캐릭터 만들기 · 프롤로그 ───────────────────────────────
  function openCreator(first){
    creator.set(store.hero);
    el.btnHeroCancel.hidden = !!first;
    show('HERO');
    el.heroName.focus({ preventScroll: true });
  }

  function confirmHero(){
    const h = creator.get();
    h.name = sanitizeName(h.name) || '감별사';
    store.hero = h;
    store = Save.save(store);
    refreshHero(); updateTitle();
    if (!store.prologue){
      store.prologue = true; store = Save.save(store);
      show('STORY');
      playDialog(PROLOGUE.map(l => ({ ...l, text: fill(l.text, h.name) })), { hero: h, zone: null }, () => show('TITLE'));
    } else show('TITLE');
  }

  function setMode(m){
    if (!MODES[m]) return;
    store.mode = m; store = Save.save(store); updateTitle();
  }
  function setPracticeAxis(a){
    store.practiceAxis = DIFF_AXES[a] ? a : ''; store = Save.save(store);
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
    renderAch();
    toast('기록을 초기화했습니다');
  }

  // ── 자유 플레이 재시작 시 새 시드 (도전장/오늘의 문제는 시드를 유지해야 한다)
  // 시작 버튼: 오늘의 문제를 하고 온 뒤라면 자유 플레이로 돌아간다 (모드 선택이 다시 보이게)
  function startPlay(){
    if (challenge.type === 'daily'){ const k = freeKey(); challenge = { type:'free', key:k, rootKey:'c:' + k, rival:null }; }
    updateTitle(); newGame();
  }
  function goTitleNow(){ timer.stop(); run = fresh(); renderer.clearReveal(); show('TITLE'); updateHud(); }

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
      renderAch();
      if (!store.hero.name) openCreator(true);       // 첫 실행: 캐릭터부터 만든다
      else show('TITLE');
    },
    openCreator, confirmHero,
    newGame, startPlay, setMode, setPracticeAxis, restart, togglePause, doShare, setSetting, resetAll, toast,
    goTitle: goTitleNow,
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
