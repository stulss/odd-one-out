// STEP 5 — 저장 + 오늘의 문제 + 공유 + 소리
// 이 단계에서 답할 질문: "친구에게 보낼 이유가 있는가? 저장값이 깨져도 게임이 열리는가?"
//
// STEP 4에서 바뀐 것
//  - localStorage 최고 기록 (현재 판 값은 저장하지 않는다 → 새 판에서 자동 초기화)
//  - 오늘의 문제 `?d=YYYYMMDD` (KST 고정) / 도전장 `?c=CODE`
//  - Canvas 결과 카드 + Web Share (+ 폴백 복사 버튼)
//  - WebAudio 합성음 · 음소거 · 움직임 줄이기
//
// 아직 없는 것: 포커스 이탈 자동 정지, 플레이 로거, 난이도 슬라이더

import { makeStage, scoreOf, MAX_CELLS, TUNE_T, AXES } from './stage.js';
import { createTimer } from './timer.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import * as Share from './share.js';
import { drawCard, toBlob } from './card.js';
import { readChallenge, todayKeyKST, shareUrl, label as chLabel } from './daily.js';

const GAP = 8;
const $ = id => document.getElementById(id);
const app = $('app'), board = $('board'), area = $('area');

let store = Save.load();
let challenge = readChallenge();
let cardBlob = null;

const ui = createUI(app, $('status'));

const cells = Array.from({ length: MAX_CELLS }, (_, i) => {
  const el = document.createElement('button');
  el.className = 'cell';
  el.type = 'button';
  el.dataset.i = String(i);
  el.setAttribute('aria-label', `칸 ${i + 1}`);
  board.appendChild(el);
  return el;
});

// 현재 판 상태 — 저장하지 않는다. 새 게임에서 이 객체를 새로 만들면 그게 곧 초기화다.
const fresh = () => ({ n:1, points:0, combo:0, prevAnswer:-1, reactions:[], stage:null });
let run = fresh();

const timer = createTimer({
  onTick(left, limit){
    const ratio = Math.max(0, left / limit);
    $('fill').style.transform = `scaleX(${ratio})`;
    $('fill').classList.toggle('warn', ratio < 0.3);
  },
  onZero(){ gameOver(); },
});

const input = createInput(board, {
  canSelect: () => ui.is('PLAY'),
  getStage: () => run.stage,
  cellAt: i => cells[i],
  onSelect: i => { Audio.unlock(); onSelect(i); },
  onPause: () => togglePause(),
});

function status(){ ui.status({ stage: run.n, tuneT: TUNE_T }); }

function layout(){
  if (!run.stage) return 0;
  const s = run.stage;
  const maxW = Math.min(window.innerWidth * 0.92, 520);
  const maxH = Math.max(140, area.clientHeight - 8);
  const size = Math.floor(Math.min(
    (maxW - GAP * (s.cols - 1)) / s.cols,
    (maxH - GAP * (s.rows - 1)) / s.rows,
  ));
  board.style.width  = (size * s.cols + GAP * (s.cols - 1)) + 'px';
  board.style.height = (size * s.rows + GAP * (s.rows - 1)) + 'px';
  return size;
}

function render(s){
  board.style.setProperty('--cols', s.cols);
  board.style.setProperty('--rows', s.rows);
  const spec = AXES[s.axis];
  for (let i = 0; i < MAX_CELLS; i++){
    const el = cells[i];
    if (i >= s.total){ el.hidden = true; continue; }
    el.hidden = false;
    el.className = 'cell shape-' + s.shape;
    el.style.cssText = `--hue:${s.hue};` + (i === s.answer ? spec.css(s.delta) : '');
  }
  $('stage').textContent = s.n;
  input.resetFocus();
  layout();
}

function nextStage(){
  run.stage = makeStage(challenge.rootKey, run.n, run.prevAnswer);
  run.prevAnswer = run.stage.answer;
  render(run.stage);
  timer.start(run.stage.timeLimit);
  status();
}

function newGame(){
  run = fresh();                       // 현재 판 값 전부 초기화
  cardBlob = null;
  $('points').textContent = '0';
  $('hint').textContent = '';
  $('fallback').hidden = true;
  cells.forEach(c => c.classList.remove('answer', 'wrong'));
  ui.set('PLAY');
  nextStage();
}

function goTitle(){
  timer.stop();
  run = fresh();
  ui.set('TITLE');
  updateTitle();
  status();
}

function togglePause(){
  if (ui.is('PLAY')){ timer.pause(); ui.set('PAUSE'); }
  else if (ui.is('PAUSE')){ ui.set('PLAY'); timer.resume(); }
  status();
}

function onSelect(i){
  const s = run.stage;
  if (i === s.answer){
    const elapsed = timer.elapsed();
    run.reactions.push(elapsed);
    run.combo++;
    run.points += scoreOf(s, elapsed, run.combo);
    $('points').textContent = run.points.toLocaleString('ko-KR');
    $('hint').textContent = `${AXES[s.axis].label} · ${elapsed.toFixed(2)}초`;
    Audio.sfx.correct();
    run.n++;
    nextStage();
  } else {
    run.combo = 0;
    const el = cells[i];
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 220);
    Audio.sfx.wrong();
    timer.penalty(1.0);
    $('hint').textContent = '아닙니다 · 시간 -1초';
    if (timer.left() <= 0) gameOver();
  }
}

function gameOver(){
  if (ui.is('RESULT')) return;
  timer.stop();
  cells[run.stage.answer]?.classList.add('answer');
  Audio.sfx.over();

  const stages = run.n - 1;
  const isBest = stages > store.best.stages;
  const bestReaction = run.reactions.length ? Math.min(...run.reactions) : null;

  if (isBest){ store.best.stages = stages; Audio.sfx.best(); }
  if (run.points > store.best.points) store.best.points = run.points;

  const today = todayKeyKST();
  if (challenge.type === 'daily' && challenge.key === today){
    if (store.daily.lastKey !== today){ store.daily.lastKey = today; store.daily.bestStages = 0; }
    store.daily.bestStages = Math.max(store.daily.bestStages, stages);
  }
  Save.bumpStreak(store, today);
  store = Save.save(store);

  $('finalStage').textContent = stages;
  $('finalPoints').textContent = run.points.toLocaleString('ko-KR');
  $('finalAxis').textContent = AXES[run.stage.axis].label;
  $('finalBest').textContent = isBest ? '최고 기록 갱신' : `최고 ${store.best.stages}단계`;
  $('finalBest').classList.toggle('is-best', isBest);

  // 카드는 미리 만들어 둔다. 공유 버튼을 누른 순간에 만들면
  // iOS에서 사용자 제스처 컨텍스트가 끊겨 공유 시트가 뜨지 않는다.
  try {
    drawCard($('card'), { stages, points: run.points, bestReaction,
                          label: chLabel(challenge), stage: run.stage, isBest });
    toBlob($('card')).then(b => { cardBlob = b; });
  } catch { cardBlob = null; }

  ui.set('RESULT');
  updateTitle();
  status();
}

async function doShare(){
  const stages = run.n - 1;
  const url = shareUrl(challenge, stages);
  const text = `딱 하나 이상함 — ${stages}단계\n${chLabel(challenge)}, 넘어볼래?`;
  $('fallback').hidden = true;
  $('fallback').dataset.text = `${text}\n${url}`;
  $('fallback').dataset.url = url;
  const r = await Share.share({ blob: cardBlob, text, url,
    onFallback: () => { $('fallback').hidden = false; }, onToast: toast });
  if (r === 'files' || r === 'text') toast('공유했습니다');
}

function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

function applySettings(){
  document.documentElement.dataset.reduced = store.settings.reducedMotion ? 'on' : 'off';
  Audio.setMuted(!store.settings.sound);
  $('optSound').checked = store.settings.sound;
  $('optMotion').checked = store.settings.reducedMotion;
}

function setSetting(key, value){
  store.settings[key] = value;
  store = Save.save(store);
  applySettings();
}

function updateTitle(){
  $('chLabel').textContent = chLabel(challenge);
  $('bestLine').textContent = store.best.stages
    ? `최고 ${store.best.stages}단계 · ${store.best.points.toLocaleString('ko-KR')}점` +
      (store.streak.count > 1 ? ` · ${store.streak.count}일 연속` : '')
    : '아직 기록이 없습니다';
  $('rival').hidden = !challenge.rival;
  if (challenge.rival) $('rival').textContent = `친구의 기록 ${challenge.rival}단계 — 넘어보세요`;
}

$('bStart').addEventListener('click', () => { Audio.unlock(); newGame(); });
$('bAgain').addEventListener('click', newGame);
$('bPause').addEventListener('click', togglePause);
$('bResume').addEventListener('click', togglePause);
$('bHome').addEventListener('click', goTitle);
$('bHome2').addEventListener('click', goTitle);
$('bShare').addEventListener('click', doShare);
$('bDaily').addEventListener('click', () => {
  const k = todayKeyKST();
  challenge = { type:'daily', key:k, rootKey:`d:${k}`, rival:null };
  Audio.unlock(); updateTitle(); newGame();
});
$('fbText').addEventListener('click', () => Share.copy($('fallback').dataset.text || '', toast));
$('fbUrl').addEventListener('click',  () => Share.copy($('fallback').dataset.url  || '', toast));
$('bSettings').addEventListener('click', () => { $('settings').hidden = false; });
$('bCloseSet').addEventListener('click', () => { $('settings').hidden = true; });
$('optSound').addEventListener('change',  e => setSetting('sound', e.target.checked));
$('optMotion').addEventListener('change', e => setSetting('reducedMotion', e.target.checked));
$('bReset').addEventListener('click', () => {
  store = Save.reset(); applySettings(); updateTitle(); toast('기록을 초기화했습니다');
});
window.addEventListener('resize', layout);

applySettings();
updateTitle();
status();

if (new URLSearchParams(location.search).has('auto')) newGame();

window.__step5 = {
  get stage(){ return run.stage; }, get n(){ return run.n; }, get points(){ return run.points; },
  get store(){ return store; }, get challenge(){ return challenge; }, get cardBlob(){ return cardBlob; },
  ui, timer, input, cells, newGame, togglePause, goTitle, doShare, setSetting,
  makeStage, AXES, TUNE_T, Save,
};
