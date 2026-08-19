// STEP 1 — 격자를 그리고, 다른 하나를 누르면 다음 격자가 나온다.
// 이 단계에서 답할 질문: "다른 하나를 찾는 그 1초가 재미있는가?"
//
// 아직 없는 것: 타이머, 점수, 화면 전환, 색, 소리, 저장, 키보드
// (없는 이유: 재미 여부를 판정하는 데 필요 없기 때문. 필요해지면 그때 추가한다)

const MAX_CELLS = 24;      // 4x6 상한. 이보다 촘촘하면 손가락으로 못 누른다.
const GAP = 8;
const MIN_TOUCH = 44;      // 최소 터치 타깃(px). 이걸 못 지키면 난이도가 아니라 조작 실패다.

// 스테이지 번호로만 결정한다. 화면 크기에 따라 칸 수가 달라지면
// 나중에 "같은 문제 공유"가 성립하지 않는다. (지금 미리 못 박아 둔다)
const GRIDS = [
  { c:2, r:3 }, { c:2, r:3 }, { c:3, r:3 }, { c:3, r:4 }, { c:3, r:4 },
  { c:4, r:4 }, { c:4, r:4 }, { c:4, r:5 }, { c:4, r:5 }, { c:4, r:6 },
];

const board  = document.getElementById('board');
const stageEl = document.getElementById('stage');
const msgEl   = document.getElementById('msg');

// 노드는 최초 1회만 만든다. 스테이지가 바뀌어도 생성/삭제하지 않는다.
const cells = Array.from({ length: MAX_CELLS }, (_, i) => {
  const el = document.createElement('button');
  el.className = 'cell';
  el.type = 'button';
  el.dataset.i = String(i);
  el.setAttribute('aria-label', `칸 ${i + 1}`);
  board.appendChild(el);
  return el;
});

let n = 1;
let stage = null;
let prevAnswer = -1;
let locked = false;        // 연타로 상태가 꼬이지 않게 한다

function makeStage(no){
  const g = GRIDS[Math.min(no - 1, GRIDS.length - 1)];
  const total = g.c * g.r;

  // 난이도는 "칸 수"가 아니라 "차이의 미묘함"으로 올린다.
  // 20도에서 시작해 3도까지 좁힌다.
  const t = Math.min((no - 1) / 40, 1);
  const ease = t * t * (3 - 2 * t);
  const delta = Math.max(2.5, 20 - ease * 17);

  let answer = Math.floor(Math.random() * total);          // STEP 2에서 시드 난수로 교체한다
  if (answer === prevAnswer && total > 1) answer = (answer + 1) % total;
  prevAnswer = answer;

  return { no, cols: g.c, rows: g.r, total, answer, delta };
}

// 칸 수는 고정, 셀의 픽셀 크기만 화면에 맞춘다.
function layout(){
  if (!stage) return;
  const maxW = Math.min(window.innerWidth * 0.92, 520);
  const maxH = Math.max(160, window.innerHeight * 0.62);
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
    el.classList.remove('wrong');
    el.style.cssText = (i === s.answer) ? `rotate:${s.delta.toFixed(2)}deg` : '';
  }
  stageEl.textContent = s.no;
  layout();
}

function next(){
  stage = makeStage(n);
  render(stage);
}

board.addEventListener('pointerdown', e => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.hidden || locked) return;
  locked = true;
  setTimeout(() => { locked = false; }, 120);

  if (Number(cell.dataset.i) === stage.answer){
    n++;
    msgEl.textContent = `찾았습니다 · 차이 ${stage.delta.toFixed(1)}도`;
    next();
  } else {
    cell.classList.add('wrong');
    msgEl.textContent = '아닙니다';
    setTimeout(() => cell.classList.remove('wrong'), 200);
  }
}, { passive: true });

window.addEventListener('resize', layout);

next();

// 검증용 — STEP 2에서 시드 난수를 넣으면 이 훅으로 재현성을 확인한다
window.__step1 = { get stage(){ return stage; }, makeStage, layout, cells, get n(){ return n; } };
