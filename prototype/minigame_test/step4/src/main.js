// STEP 4 — 차이 축 10종 + 도형 4종 + 키보드 조작
// 이 단계에서 답할 질문: "10판을 해도 반복으로 느껴지지 않는가? 마우스 없이 완주되는가?"
//
// STEP 3에서 바뀐 것
//  - 차이 축 1종(회전) → 10종. 각 축에 지각 임계값(min)을 두어 "못 푸는 판"을 막는다
//  - 도형 4종 (사각/원/마름모/육각) — clip-path로 그린다. 이미지 파일은 여전히 0개
//  - 입력을 input.js로 분리하고 키보드(방향키 + Enter) 추가
//  - 스테이지마다 어떤 축이 나왔는지 화면에 표시 (플레이어가 규칙을 배우는 데 도움)
//
// 아직 없는 것: 저장, 오늘의 문제, 공유, 소리, 설정

import { makeStage, scoreOf, MAX_CELLS, TUNE_T, AXES } from './stage.js';
import { createTimer } from './timer.js';
import { createUI } from './ui.js';
import { createInput } from './input.js';

const GAP = 8;
const $ = id => document.getElementById(id);
const app = $('app'), board = $('board'), area = $('area');

const ROOT_KEY = new URLSearchParams(location.search).get('s') || 'STEP4';
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
let stage = null, prevAnswer = -1;

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
  getStage: () => stage,
  cellAt: i => cells[i],
  onSelect: i => onSelect(i),
  onPause: () => togglePause(),
});

function status(){ ui.status({ stage: n, tuneT: TUNE_T }); }

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
  const spec = AXES[s.axis];
  for (let i = 0; i < MAX_CELLS; i++){
    const el = cells[i];
    if (i >= s.total){ el.hidden = true; continue; }
    el.hidden = false;
    el.className = 'cell shape-' + s.shape;              // 도형은 클래스로
    el.style.cssText = `--hue:${s.hue};` + (i === s.answer ? spec.css(s.delta) : '');
  }
  $('stage').textContent = s.n;
  input.resetFocus();
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
  $('hint').textContent = '';
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
  $('finalAxis').textContent = AXES[stage.axis].label;
  ui.set('RESULT');
  status();
}

function togglePause(){
  if (ui.is('PLAY')){ timer.pause(); ui.set('PAUSE'); }
  else if (ui.is('PAUSE')){ ui.set('PLAY'); timer.resume(); }
  status();
}

function onSelect(i){
  if (i === stage.answer){
    const elapsed = timer.elapsed();
    combo++;
    points += scoreOf(stage, elapsed, combo);
    $('points').textContent = points.toLocaleString('ko-KR');
    // 어떤 축이었는지 알려준다. 플레이어는 이걸 보면서 "무엇을 봐야 하는지"를 배운다.
    $('hint').textContent = `${AXES[stage.axis].label} · ${elapsed.toFixed(2)}초`;
    n++;
    nextStage();
  } else {
    combo = 0;
    const el = cells[i];
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 220);
    timer.penalty(1.0);
    $('hint').textContent = '아닙니다 · 시간 -1초';
    if (timer.left() <= 0) gameOver();
  }
}

$('bStart').addEventListener('click', newGame);
$('bAgain').addEventListener('click', newGame);
$('bPause').addEventListener('click', togglePause);
$('bResume').addEventListener('click', togglePause);
$('bHome').addEventListener('click', goTitle);
$('bHome2').addEventListener('click', goTitle);
window.addEventListener('resize', layout);

status();

// 스크린샷/자동검증용 훅: ?auto=1 이면 타이틀을 건너뛰고 바로 플레이 상태로 만든다.
if (new URLSearchParams(location.search).has('auto')) newGame();

window.__step4 = {
  get stage(){ return stage; }, get n(){ return n; }, get points(){ return points; },
  ui, timer, input, cells, layout, newGame, togglePause, goTitle, TUNE_T, makeStage, AXES,
};
