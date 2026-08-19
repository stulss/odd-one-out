// STEP 3 — 화면 4개 + 규칙 상시 표시 + 일시정지
// 이 단계에서 답할 질문: "처음 보는 사람이 규칙을 알 수 있는가? 어떤 해상도에서도 안 깨지는가?"
//
// STEP 2에서 바뀐 것
//  - 화면 상태를 ui.js 한 곳에서만 바꾼다 (TITLE / PLAY / PAUSE / RESULT)
//  - 규칙·조작·상태 3줄을 화면 아래에 항상 띄운다
//  - P / Esc / 버튼으로 일시정지, 남은 시간을 정확히 보존
//  - 게임판 크기를 실제 여유 높이에서 계산 → 해상도가 달라져도 잘리지 않는다
//
// 아직 없는 것: 차이 축 다양화, 도형, 키보드 이동, 저장, 공유, 소리

import { makeStage, scoreOf, MAX_CELLS, TUNE_T } from './stage.js';
import { createTimer } from './timer.js';
import { createUI } from './ui.js';

const GAP = 8;
const $ = id => document.getElementById(id);
const app = $('app'), board = $('board'), area = $('area');

const ROOT_KEY = new URLSearchParams(location.search).get('s') || 'STEP3';
$('seed').textContent = ROOT_KEY;

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

let n = 1, points = 0, combo = 0;
let stage = null, prevAnswer = -1, locked = false;

const timer = createTimer({
  onTick(left, limit){
    const ratio = Math.max(0, left / limit);
    $('fill').style.transform = `scaleX(${ratio})`;
    $('fill').classList.toggle('warn', ratio < 0.3);
  },
  onZero(){ gameOver(); },
});

function status(){ ui.status({ stage: n, tuneT: TUNE_T }); }

// 게임판은 남은 세로 공간(#area의 실제 높이)에 맞춰 계산한다.
// vh를 그대로 쓰면 헤더·푸터 높이를 빼먹어서 큰 화면에서 판이 잘린다.
function layout(){
  if (!stage) return 0;
  const maxW = Math.min(window.innerWidth * 0.92, 520);
  const maxH = Math.max(140, area.clientHeight - 8);
  const size = Math.floor(Math.min(
    (maxW - GAP * (stage.cols - 1)) / stage.cols,
    (maxH - GAP * (stage.rows - 1)) / stage.rows,
  ));
  board.style.width  = (size * stage.cols + GAP * (stage.cols - 1)) + 'px';
  board.style.height = (size * stage.rows + GAP * (stage.rows - 1)) + 'px';
  return size;
}

function render(s){
  board.style.setProperty('--cols', s.cols);
  board.style.setProperty('--rows', s.rows);
  for (let i = 0; i < MAX_CELLS; i++){
    const el = cells[i];
    if (i >= s.total){ el.hidden = true; continue; }
    el.hidden = false;
    el.classList.remove('wrong', 'answer');
    el.style.cssText = (i === s.answer) ? `rotate:${s.delta.toFixed(2)}deg` : '';
  }
  $('stage').textContent = s.n;
  layout();
}

function nextStage(){
  stage = makeStage(ROOT_KEY, n, prevAnswer);
  prevAnswer = stage.answer;
  render(stage);
  timer.start(stage.timeLimit);
  status();
}

function newGame(){
  n = 1; points = 0; combo = 0; prevAnswer = -1;
  $('points').textContent = '0';
  cells.forEach(c => c.classList.remove('answer', 'wrong'));
  ui.set('PLAY');
  nextStage();
}

function goTitle(){
  timer.stop();
  n = 1; stage = null;
  ui.set('TITLE');
  status();
}

function gameOver(){
  if (ui.is('RESULT')) return;
  timer.stop();
  cells[stage.answer]?.classList.add('answer');
  $('finalStage').textContent = n - 1;
  $('finalPoints').textContent = points.toLocaleString('ko-KR');
  ui.set('RESULT');
  status();
}

// 일시정지는 상태와 타이머를 함께 움직여야 한다.
// 둘 중 하나만 바꾸면 "화면은 멈췄는데 시간은 간다" 같은 버그가 생긴다.
function togglePause(){
  if (ui.is('PLAY')){ timer.pause(); ui.set('PAUSE'); }
  else if (ui.is('PAUSE')){ ui.set('PLAY'); timer.resume(); }
  status();
}

board.addEventListener('pointerdown', e => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.hidden || locked || !ui.is('PLAY')) return;
  locked = true;
  setTimeout(() => { locked = false; }, 120);

  if (Number(cell.dataset.i) === stage.answer){
    const elapsed = timer.elapsed();
    combo++;
    points += scoreOf(stage, elapsed, combo);
    $('points').textContent = points.toLocaleString('ko-KR');
    n++;
    nextStage();
  } else {
    combo = 0;
    cell.classList.add('wrong');
    setTimeout(() => cell.classList.remove('wrong'), 200);
    timer.penalty(1.0);
    if (timer.left() <= 0) gameOver();
  }
}, { passive: true });

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape'){ e.preventDefault(); togglePause(); }
});

$('bStart').addEventListener('click', newGame);
$('bAgain').addEventListener('click', newGame);
$('bPause').addEventListener('click', togglePause);
$('bResume').addEventListener('click', togglePause);
$('bHome').addEventListener('click', goTitle);
$('bHome2').addEventListener('click', goTitle);
window.addEventListener('resize', layout);

status();

// 스크린샷/자동검증용 훅: ?auto=1 이면 타이틀을 건너뛰고 바로 플레이 상태로 만든다.
// 게임 규칙에는 영향을 주지 않는다. (증거 스크린샷을 찍기 위해 추가)
if (new URLSearchParams(location.search).has('auto')) newGame();

window.__step3 = {
  get stage(){ return stage; }, get n(){ return n; }, get points(){ return points; },
  ui, timer, cells, layout, newGame, togglePause, goTitle, TUNE_T,
};
