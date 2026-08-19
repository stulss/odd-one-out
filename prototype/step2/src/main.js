// STEP 2 — 시드 난수 + 제한 시간 + 점수 + 한 판이 끝나는 구조
// 이 단계에서 답할 질문: "한 판이 성립하는가? 같은 시드는 같은 문제를 주는가?"
//
// STEP 1에서 바뀐 것
//  - Math.random() → 시드 난수 (rng.js)
//  - makeStage를 stage.js로 분리, 제한 시간·점수 추가
//  - 타이머 게이지, 게임 오버, 다시 하기
//  - 오답 = 시간 1초 차감 (즉사 아님)
//
// 아직 없는 것: 화면 전환, 일시정지, 도형/차이 축 다양화, 키보드, 저장, 공유, 소리

import { makeStage, scoreOf, MAX_CELLS } from './stage.js';
import { createTimer } from './timer.js';

const GAP = 8;
const $ = id => document.getElementById(id);
const board = $('board');

// 시드는 URL로 받는다. 없으면 고정 기본값 — STEP 2에서는 재현성 확인이 목적이라 랜덤을 쓰지 않는다.
const ROOT_KEY = new URLSearchParams(location.search).get('s') || 'STEP2';
$('seed').textContent = ROOT_KEY;

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
let stage = null, prevAnswer = -1, locked = false, over = false;

const timer = createTimer({
  onTick(left, limit){
    const ratio = Math.max(0, left / limit);
    $('fill').style.transform = `scaleX(${ratio})`;
    $('fill').classList.toggle('warn', ratio < 0.3);
  },
  onZero(){ gameOver(); },
});

function layout(){
  if (!stage) return;
  const maxW = Math.min(window.innerWidth * 0.92, 520);
  const maxH = Math.max(160, window.innerHeight * 0.55);
  const size = Math.floor(Math.min(
    (maxW - GAP * (stage.cols - 1)) / stage.cols,
    (maxH - GAP * (stage.rows - 1)) / stage.rows,
  ));
  board.style.width  = (size * stage.cols + GAP * (stage.cols - 1)) + 'px';
  board.style.height = (size * stage.rows + GAP * (stage.rows - 1)) + 'px';
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
}

function newGame(){
  n = 1; points = 0; combo = 0; prevAnswer = -1; over = false;
  $('points').textContent = '0';
  $('over').hidden = true;
  board.hidden = false;
  $('msg').textContent = '다른 하나를 찾아 누르세요';
  nextStage();
}

function gameOver(){
  if (over) return;
  over = true;
  timer.stop();
  cells[stage.answer]?.classList.add('answer');   // 정답을 보여준다. 안 보여주면 속았다고 느낀다.
  $('finalStage').textContent = n - 1;
  $('finalPoints').textContent = points.toLocaleString('ko-KR');
  $('over').hidden = false;
}

board.addEventListener('pointerdown', e => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.hidden || locked || over) return;
  locked = true;
  setTimeout(() => { locked = false; }, 120);

  if (Number(cell.dataset.i) === stage.answer){
    const elapsed = timer.elapsed();
    combo++;
    points += scoreOf(stage, elapsed, combo);
    $('points').textContent = points.toLocaleString('ko-KR');
    $('msg').textContent = `${elapsed.toFixed(2)}초`;
    n++;
    nextStage();
  } else {
    combo = 0;
    cell.classList.add('wrong');
    setTimeout(() => cell.classList.remove('wrong'), 200);
    timer.penalty(1.0);
    $('msg').textContent = '아닙니다 · 시간 -1초';
    if (timer.left() <= 0) gameOver();
  }
}, { passive: true });

$('again').addEventListener('click', newGame);
window.addEventListener('resize', layout);

newGame();

// 검증용 훅
window.__step2 = {
  get stage(){ return stage; }, get n(){ return n; }, get points(){ return points; },
  get over(){ return over; }, makeStage, timer, cells, ROOT_KEY, newGame,
};
